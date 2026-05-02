import { mkdir, writeFile, chmod, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../../core/config.js";
import type { EnforcementConfig } from "../../core/types.js";

const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  level: "soft",
  track_sessions: true,
  require_log_change: true,
  require_log_decision: false,
};

function generateSessionStartHook(): string {
  return `#!/bin/bash
# AgentNorth — SessionStart hook
# Injects initial context when Claude starts a session

cat << 'EOF'
[AgentNorth] Session started. Modules available in this project:
- Use agentnorth_list_modules() to see all modules
- Use agentnorth_get_context("module") BEFORE working on any module
- Use agentnorth_log_decision() and agentnorth_log_change() AFTER making changes
- Do NOT explore the repo manually without checking AgentNorth first
EOF

# Send session start event to API (if configured)
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/sessions/start" \\
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{\\"repo\\": \\"$(git remote get-url origin 2>/dev/null)\\", \\"dev\\": \\"$(git config user.name)\\", \\"branch\\": \\"$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')\\", \\"model\\": \\"$(echo $CLAUDE_MODEL 2>/dev/null)\\", \\"conversation_id\\": \\"$(echo $CLAUDE_CONVERSATION_ID 2>/dev/null)\\"}" \\
    > /dev/null 2>&1 &
fi
`;
}

function generateEnforceContextHook(level: string): string {
  const decision = level === "strict" ? "deny" : "allow";
  const message =
    level === "audit"
      ? ""
      : `, "additionalContext": "[AgentNorth] You have not checked the context for module '$MODULE'. Call agentnorth_get_context('$MODULE') first to get the full context and save tokens."`;

  return `#!/bin/bash
# AgentNorth — PreToolUse hook (Read|Grep|Glob)
# Enforcement level: ${level}

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.pattern // .tool_input.query // ""' 2>/dev/null)

# If no file_path or not within src/, allow without warning
if [ -z "$FILE_PATH" ] || ! echo "$FILE_PATH" | grep -q "src/"; then
  exit 0
fi

# Extract module from path (first directory after src/)
MODULE=$(echo "$FILE_PATH" | sed 's|.*/src/||' | cut -d'/' -f1)

if [ -z "$MODULE" ]; then
  exit 0
fi

# Check if context was already fetched for this module
CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"

if ! grep -q "^\${MODULE}$" "$CONTEXT_LOG" 2>/dev/null; then
  cat << EOF
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "${decision}"${message}}}
EOF
  exit 0
fi

exit 0
`;
}

function generateTrackUsageHook(): string {
  return `#!/bin/bash
# AgentNorth — PostToolUse hook (mcp__agentnorth__*)
# Tracks AgentNorth tool usage and sends events to the API

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
ACTION=$(echo "$TOOL_NAME" | sed 's/mcp__agentnorth__//')

# Record that this module's context was fetched (for enforcement hook)
MODULE=$(echo "$INPUT" | jq -r '.tool_input.module // ""' 2>/dev/null)
if [ -n "$MODULE" ] && echo "$ACTION" | grep -q "get_context"; then
  CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
  echo "$MODULE" >> "$CONTEXT_LOG"
fi

# Record log_change and log_decision for session end hook
if echo "$ACTION" | grep -qE "log_change|log_decision"; then
  CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
  echo "$ACTION" >> "$CONTEXT_LOG"
fi

# Estimate token savings based on action
TOKENS_SAVED=0
if echo "$ACTION" | grep -q "get_context"; then
  FILE_COUNT=$(cat ".agentnorth/bundles/$MODULE.json" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('files',[])))" 2>/dev/null || echo 0)
  TOKENS_SAVED=$((FILE_COUNT * 1100))
elif echo "$ACTION" | grep -qE "get_decisions|get_schema"; then
  TOKENS_SAVED=5000
elif echo "$ACTION" | grep -q "list_modules"; then
  TOKENS_SAVED=2000
fi

# Append tokens saved to daily log (for session end hook)
if [ "$TOKENS_SAVED" -gt 0 ]; then
  echo "$TOKENS_SAVED" >> "/tmp/agentnorth-tokens-$(date +%Y%m%d).log"
fi

# Send event to API (async, does not block Claude)
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/events" \\
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"action\\": \\"$ACTION\\",
      \\"module\\": \\"$MODULE\\",
      \\"timestamp\\": \\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",
      \\"dev\\": \\"$(git config user.name)\\",
      \\"tokens_saved_estimate\\": $TOKENS_SAVED
    }" \\
    > /dev/null 2>&1 &
fi
`;
}

function generateSessionEndHook(requireLogChange: boolean): string {
  return `#!/bin/bash
# AgentNorth — Stop hook
# Verifies that log_change was called if there were modifications

CHANGES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
LOGGED=$(grep -c "log_change" "$CONTEXT_LOG" 2>/dev/null || echo 0)

${requireLogChange ? `if [ "$CHANGES" -gt 0 ] && [ "$LOGGED" -eq 0 ]; then
  echo "[AgentNorth] $CHANGES files modified but no changes were logged with agentnorth_log_change(). Consider logging changes before closing."
fi` : "# log_change not required by enforcement config"}

# Gather files touched and tokens saved for session summary
FILES_LIST=$(git diff --name-only 2>/dev/null | head -50 | jq -R -s 'split("\\n") | map(select(length > 0))')
TOKENS_LOG="/tmp/agentnorth-tokens-$(date +%Y%m%d).log"
TOKENS_SAVED=$(cat "$TOKENS_LOG" 2>/dev/null | awk '{s+=$1} END {print s+0}')

# Gather commit SHAs made during this session (last 2 hours)
COMMIT_SHAS=$(git log --since="2 hours ago" --format="%H" 2>/dev/null | head -20 | jq -R -s 'split("\\n") | map(select(length > 0))')

# Count decisions logged
DECISIONS_LOGGED=$(grep -c "log_decision" "$CONTEXT_LOG" 2>/dev/null || echo 0)

# Send session end event to API
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/sessions/end" \\
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"dev\\": \\"$(git config user.name)\\",
      \\"files_changed\\": $CHANGES,
      \\"changes_logged\\": $LOGGED,
      \\"decisions_logged\\": $DECISIONS_LOGGED,
      \\"files_touched\\": $FILES_LIST,
      \\"commit_shas\\": $COMMIT_SHAS,
      \\"tokens_saved\\": $TOKENS_SAVED
    }" \\
    > /dev/null 2>&1 &
fi
`;
}

function generateSettings(rootDir: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        agentnorth: {
          command: "npx",
          args: ["agentnorth", "serve"],
          env: {
            AGENTNORTH_API_URL: "",
            AGENTNORTH_ORG_KEY: "",
            AGENTNORTH_DEV_KEY: "",
          },
        },
      },
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: "command", command: ".claude/hooks/agentnorth-session-start.sh" },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: "Read|Grep|Glob",
            hooks: [
              { type: "command", command: ".claude/hooks/agentnorth-enforce-context.sh" },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: "mcp__agentnorth__.*",
            hooks: [
              { type: "command", command: ".claude/hooks/agentnorth-track-usage.sh" },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              { type: "command", command: ".claude/hooks/agentnorth-session-end.sh" },
            ],
          },
        ],
      },
    },
    null,
    2,
  );
}

function generateClaudeMd(projectName: string): string {
  return `# CLAUDE.md

## AgentNorth — REQUIRED

This project uses AgentNorth as its Shared Context Layer. The MCP server \`agentnorth\` is configured and MUST be used.

### Before working on any module:
1. Call \`agentnorth_list_modules()\` to see available modules
2. Call \`agentnorth_get_context("module")\` for the module you will work on
3. Check \`agentnorth_get_decisions("module")\` before making new decisions

### After making significant changes:
4. Call \`agentnorth_log_change()\` with a summary of what you did
5. If you made an architecture decision, call \`agentnorth_log_decision()\`
6. **REQUIRED**: After each commit, sync to the dashboard:
\`\`\`bash
npx agentnorth sync
\`\`\`
   This updates the dashboard with the project's modules, decisions, and changes.
   **NEVER skip this step.** The dashboard must always reflect the current repo state.

### Rules:
- NEVER explore the repo with grep/glob/read without checking AgentNorth first
- The context you need is already indexed — use it
- If a module is not indexed, run \`agentnorth index\` first
- Previous decisions take precedence — do not contradict them without justification
`;
}

function generateGitPostCommitHook(): string {
  return `#!/bin/bash
# AgentNorth — Bidirectional sync on every commit
# Runs pull + index + sync in the background so it doesn't block your workflow

# Load env from .agentnorth/.env if it exists
if [ -f ".agentnorth/.env" ]; then
  set -a
  source .agentnorth/.env
  set +a
fi

# Only sync if keys are configured
if [ -n "$AGENTNORTH_ORG_KEY" ] && [ -n "$AGENTNORTH_DEV_KEY" ]; then
  (
    npx agentnorth pull 2>/dev/null
    npx agentnorth index 2>/dev/null
    npx agentnorth sync 2>/dev/null
  ) &
fi
`;
}

export async function setupCommand(): Promise<void> {
  const rootDir = process.cwd();

  // Check if agentnorth is initialized
  const configPath = join(rootDir, ".agentnorth", "config.yaml");
  if (!existsSync(configPath)) {
    console.error("Error: AgentNorth not initialized. Run `agentnorth init` first.");
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const enforcement = config.enforcement ?? DEFAULT_ENFORCEMENT;

  const claudeDir = join(rootDir, ".claude");
  const hooksDir = join(claudeDir, "hooks");
  await mkdir(hooksDir, { recursive: true });

  // Install git post-commit hook for auto-sync
  const gitHooksDir = join(rootDir, ".git", "hooks");
  if (existsSync(join(rootDir, ".git"))) {
    await mkdir(gitHooksDir, { recursive: true });
    const postCommitPath = join(gitHooksDir, "post-commit");
    const hookContent = generateGitPostCommitHook();

    if (existsSync(postCommitPath)) {
      const existing = await readFile(postCommitPath, "utf-8");
      if (!existing.includes("agentnorth")) {
        // Append to existing hook
        await writeFile(postCommitPath, existing + "\n" + hookContent, "utf-8");
        await chmod(postCommitPath, 0o755);
        console.log("  Appended AgentNorth auto-sync to existing post-commit hook");
      } else {
        console.log("  post-commit hook already has AgentNorth (skipped)");
      }
    } else {
      await writeFile(postCommitPath, hookContent, "utf-8");
      await chmod(postCommitPath, 0o755);
      console.log("  Created git post-commit hook for auto-sync");
    }
  }

  // Generate hook files
  const hooks = [
    { name: "agentnorth-session-start.sh", content: generateSessionStartHook() },
    { name: "agentnorth-enforce-context.sh", content: generateEnforceContextHook(enforcement.level) },
    { name: "agentnorth-track-usage.sh", content: generateTrackUsageHook() },
    { name: "agentnorth-session-end.sh", content: generateSessionEndHook(enforcement.require_log_change) },
  ];

  for (const hook of hooks) {
    const hookPath = join(hooksDir, hook.name);
    await writeFile(hookPath, hook.content, "utf-8");
    await chmod(hookPath, 0o755);
  }

  // Generate .claude/settings.json (merge if exists)
  const settingsPath = join(claudeDir, "settings.json");
  if (existsSync(settingsPath)) {
    const existing = JSON.parse(await readFile(settingsPath, "utf-8"));
    const generated = JSON.parse(generateSettings(rootDir));
    // Merge: preserve existing mcpServers/hooks, add agentnorth ones
    existing.mcpServers = { ...existing.mcpServers, ...generated.mcpServers };
    existing.hooks = { ...existing.hooks, ...generated.hooks };
    await writeFile(settingsPath, JSON.stringify(existing, null, 2), "utf-8");
  } else {
    await writeFile(settingsPath, generateSettings(rootDir), "utf-8");
  }

  // Generate CLAUDE.md if it doesn't exist
  const claudeMdPath = join(rootDir, "CLAUDE.md");
  if (!existsSync(claudeMdPath)) {
    await writeFile(claudeMdPath, generateClaudeMd(config.project.name), "utf-8");
    console.log("  Created CLAUDE.md");
  } else {
    console.log("  CLAUDE.md already exists (skipped)");
  }

  console.log(`
AgentNorth enforcement setup complete!

  .claude/settings.json          — MCP server + hooks config
  .claude/hooks/                 — 4 lifecycle hooks
  .git/hooks/post-commit         — Auto-sync on every commit
  ${existsSync(claudeMdPath) ? "" : "CLAUDE.md                      — Agent instructions\n"}
Enforcement level: ${enforcement.level}
  - PreToolUse: ${enforcement.level === "strict" ? "BLOCKS" : enforcement.level === "soft" ? "WARNS" : "audits"} exploration without context
  - Stop: ${enforcement.require_log_change ? "REMINDS" : "does not remind"} to log changes
  - PostToolUse: tracks all MCP tool usage

Auto-sync:
  Every git commit automatically runs index + sync in the background.
  No manual sync needed — the dashboard stays up to date automatically.
  API keys are loaded from .agentnorth/.env

Next steps:
  1. Create .agentnorth/.env with your keys:
     AGENTNORTH_ORG_KEY=an_org_...
     AGENTNORTH_DEV_KEY=an_dev_...
     AGENTNORTH_API_URL=https://agentnorth.io
  2. Or set them in .claude/settings.json → mcpServers.agentnorth.env
  3. Or export as environment variables

  Keys are generated when you sign in to the AgentNorth dashboard.

Commit .claude/ so all team members get enforcement automatically.
`);
}
