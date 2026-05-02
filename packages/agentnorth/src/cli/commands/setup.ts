import { mkdir, writeFile, chmod, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../../core/config.js";
import type { EnforcementConfig } from "../../core/types.js";

const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  level: "strict",
  track_sessions: true,
  require_log_change: true,
  require_log_decision: true,
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

function generateEnforceEditHook(level: string): string {
  const decision = level === "strict" ? "deny" : "allow";
  const message =
    level === "audit"
      ? ""
      : `, "additionalContext": "[AgentNorth] BLOCKED: You are editing a file in module '$MODULE' without context. Call agentnorth_get_context('$MODULE') first. This ensures you understand the module architecture, existing decisions, and conventions before making changes."`;

  return `#!/bin/bash
# AgentNorth — PreToolUse hook (Edit|Write)
# Enforcement level: ${level}
# Prevents modifications to modules without prior context check

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

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

function generateTrackEditsHook(): string {
  return `#!/bin/bash
# AgentNorth — PostToolUse hook (Edit|Write|Bash)
# Tracks every file modification and command execution

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)

EDIT_LOG="/tmp/agentnorth-edits-$(date +%Y%m%d).log"

if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $TOOL_NAME $FILE_PATH" >> "$EDIT_LOG"

  # Send file edit event to API
  if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
    curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/events" \\
      -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
      -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
      -H "Content-Type: application/json" \\
      -d "{
        \\"action\\": \\"file_edit\\",
        \\"module\\": \\"$(echo "$FILE_PATH" | sed 's|.*/src/||' | cut -d'/' -f1)\\",
        \\"file\\": \\"$FILE_PATH\\",
        \\"timestamp\\": \\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",
        \\"dev\\": \\"$(git config user.name)\\"
      }" \\
      > /dev/null 2>&1 &
  fi

elif [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null | head -c 200)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Bash: $COMMAND" >> "$EDIT_LOG"

  # Send bash command event to API
  if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
    # Sanitize command for JSON (escape quotes, truncate)
    SAFE_CMD=$(echo "$COMMAND" | head -c 150 | sed 's/"/\\\\"/g' | tr '\\n' ' ')
    curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/events" \\
      -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
      -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
      -H "Content-Type: application/json" \\
      -d "{
        \\"action\\": \\"bash_command\\",
        \\"module\\": \\"\\",
        \\"file\\": \\"\\",
        \\"timestamp\\": \\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",
        \\"dev\\": \\"$(git config user.name)\\"
      }" \\
      > /dev/null 2>&1 &
  fi
fi
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

function generateSessionEndHook(requireLogChange: boolean, requireLogDecision: boolean): string {
  return `#!/bin/bash
# AgentNorth — Stop hook
# Verifies that log_change and log_decision were called appropriately

CHANGES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
LOGGED=$(grep -c "log_change" "$CONTEXT_LOG" 2>/dev/null || echo 0)
DECISIONS_LOGGED=$(grep -c "log_decision" "$CONTEXT_LOG" 2>/dev/null || echo 0)

${requireLogChange ? `if [ "$CHANGES" -gt 0 ] && [ "$LOGGED" -eq 0 ]; then
  echo "[AgentNorth] WARNING: $CHANGES files modified but no changes were logged. Call agentnorth_log_change() to record what you did and why."
fi` : "# log_change not required by enforcement config"}

${requireLogDecision ? `# Check if significant changes were made without a decision log
if [ "$CHANGES" -gt 5 ] && [ "$DECISIONS_LOGGED" -eq 0 ]; then
  echo "[AgentNorth] WARNING: $CHANGES files modified but no architecture decisions were logged. If you made structural changes, call agentnorth_log_decision() to record the rationale."
fi` : "# log_decision not required by enforcement config"}

# Gather files touched and tokens saved for session summary
FILES_LIST=$(git diff --name-only 2>/dev/null | head -50 | jq -R -s 'split("\\n") | map(select(length > 0))')
TOKENS_LOG="/tmp/agentnorth-tokens-$(date +%Y%m%d).log"
TOKENS_SAVED=$(cat "$TOKENS_LOG" 2>/dev/null | awk '{s+=$1} END {print s+0}')

# Gather commit SHAs made during this session (last 2 hours)
COMMIT_SHAS=$(git log --since="2 hours ago" --format="%H" 2>/dev/null | head -20 | jq -R -s 'split("\\n") | map(select(length > 0))')

# Count decisions logged
DECISIONS_LOGGED=$(grep -c "log_decision" "$CONTEXT_LOG" 2>/dev/null || echo 0)

# Count edit/write operations from edit tracking log
EDIT_LOG="/tmp/agentnorth-edits-$(date +%Y%m%d).log"
EDITS_COUNT=$(grep -c "Edit\\|Write" "$EDIT_LOG" 2>/dev/null || echo 0)
BASH_COUNT=$(grep -c "Bash:" "$EDIT_LOG" 2>/dev/null || echo 0)

# Get list of modules that had context checked
MODULES_VISITED=$(grep -v "log_change\\|log_decision\\|Bash:" "$CONTEXT_LOG" 2>/dev/null | sort -u | jq -R -s 'split("\\n") | map(select(length > 0))')

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
      \\"tokens_saved\\": $TOKENS_SAVED,
      \\"edits_count\\": $EDITS_COUNT,
      \\"bash_commands_count\\": $BASH_COUNT
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
          {
            matcher: "Edit|Write",
            hooks: [
              { type: "command", command: ".claude/hooks/agentnorth-enforce-edit.sh" },
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
          {
            matcher: "Edit|Write|Bash",
            hooks: [
              { type: "command", command: ".claude/hooks/agentnorth-track-edits.sh" },
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

## AgentNorth — MANDATORY (enforced by hooks)

This project uses AgentNorth as its Shared Context Layer. The MCP server \`agentnorth\` is configured and **strictly enforced** via Claude Code hooks.

### BEFORE working on any module (MANDATORY):
1. Call \`agentnorth_list_modules()\` to see available modules
2. Call \`agentnorth_get_context("module")\` for the module you will work on
3. Check \`agentnorth_get_decisions("module")\` before making new decisions

> If you skip steps 1-3, the PreToolUse hook will BLOCK your Read, Grep, Glob, Edit, and Write operations on that module. This is intentional — it saves tokens and prevents working without context.

### AFTER making changes (MANDATORY):
4. Call \`agentnorth_log_change()\` with a summary of what you did
5. If you made ANY architecture/structural decision, call \`agentnorth_log_decision()\`
6. **REQUIRED**: After each commit, sync to the dashboard:
\`\`\`bash
npx agentnorth sync
\`\`\`

### Strict Rules:
- **NEVER** explore the repo with Read/Grep/Glob without calling \`agentnorth_get_context()\` first
- **NEVER** edit files with Edit/Write without calling \`agentnorth_get_context()\` first
- **ALWAYS** log changes with \`agentnorth_log_change()\` before ending the session
- **ALWAYS** log architecture decisions with \`agentnorth_log_decision()\` when making structural changes
- **NEVER** contradict previous decisions without explicit justification
- The context you need is already indexed — use it, don't rediscover it manually
- Every Edit, Write, and Bash command is tracked and sent to the dashboard
- The Stop hook will warn if you modified files without logging changes or decisions
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
    { name: "agentnorth-enforce-edit.sh", content: generateEnforceEditHook(enforcement.level) },
    { name: "agentnorth-track-usage.sh", content: generateTrackUsageHook() },
    { name: "agentnorth-track-edits.sh", content: generateTrackEditsHook() },
    { name: "agentnorth-session-end.sh", content: generateSessionEndHook(enforcement.require_log_change, enforcement.require_log_decision) },
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
  .claude/hooks/                 — 6 lifecycle hooks
  .git/hooks/post-commit         — Auto-sync on every commit
  ${existsSync(claudeMdPath) ? "" : "CLAUDE.md                      — Agent instructions\n"}
Enforcement level: ${enforcement.level}
  - PreToolUse (Read|Grep|Glob): ${enforcement.level === "strict" ? "BLOCKS" : enforcement.level === "soft" ? "WARNS" : "audits"} exploration without context
  - PreToolUse (Edit|Write):     ${enforcement.level === "strict" ? "BLOCKS" : enforcement.level === "soft" ? "WARNS" : "audits"} edits without context
  - PostToolUse (MCP tools):     tracks all AgentNorth tool usage + tokens saved
  - PostToolUse (Edit|Write|Bash): tracks every file edit and command execution
  - Stop: ${enforcement.require_log_change ? "REMINDS" : "does not remind"} to log changes, sends full session summary

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
