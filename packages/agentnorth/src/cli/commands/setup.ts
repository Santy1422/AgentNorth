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
# Inyecta contexto inicial cuando Claude arranca una sesion

cat << 'EOF'
[AgentNorth] Sesion iniciada. Modulos disponibles en este proyecto:
- Usa agentnorth_list_modules() para ver todos los modulos
- Usa agentnorth_get_context("modulo") ANTES de trabajar en cualquier modulo
- Usa agentnorth_log_decision() y agentnorth_log_change() DESPUES de hacer cambios
- NO explores el repo manualmente sin consultar AgentNorth primero
EOF

# Enviar evento de session start al API (si esta configurado)
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/sessions/start" \\
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{\\"repo\\": \\"$(git remote get-url origin 2>/dev/null)\\", \\"dev\\": \\"$(git config user.name)\\"}" \\
    > /dev/null 2>&1 &
fi
`;
}

function generateEnforceContextHook(level: string): string {
  const decision = level === "strict" ? "deny" : "allow";
  const message =
    level === "audit"
      ? ""
      : `, "additionalContext": "[AgentNorth] No has consultado el contexto del modulo '$MODULE'. Llama agentnorth_get_context('$MODULE') primero para tener el contexto completo y ahorrar tokens."`;

  return `#!/bin/bash
# AgentNorth — PreToolUse hook (Read|Grep|Glob)
# Enforcement level: ${level}

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.pattern // .tool_input.query // ""' 2>/dev/null)

# Si no hay file_path o no es un path dentro de src/, permitir sin advertencia
if [ -z "$FILE_PATH" ] || ! echo "$FILE_PATH" | grep -q "src/"; then
  exit 0
fi

# Extraer el modulo del path (primer directorio despues de src/)
MODULE=$(echo "$FILE_PATH" | sed 's|.*/src/||' | cut -d'/' -f1)

if [ -z "$MODULE" ]; then
  exit 0
fi

# Verificar si ya se consulto contexto para este modulo
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
# Trackea uso de tools AgentNorth y envia eventos al API

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
ACTION=$(echo "$TOOL_NAME" | sed 's/mcp__agentnorth__//')

# Registrar que se consulto este modulo (para el hook de enforcement)
MODULE=$(echo "$INPUT" | jq -r '.tool_input.module // ""' 2>/dev/null)
if [ -n "$MODULE" ] && echo "$ACTION" | grep -q "get_context"; then
  CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
  echo "$MODULE" >> "$CONTEXT_LOG"
fi

# Registrar log_change para el hook de session end
if echo "$ACTION" | grep -q "log_change"; then
  CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
  echo "log_change" >> "$CONTEXT_LOG"
fi

# Enviar evento al API (async, no bloquea a Claude)
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/events" \\
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"action\\": \\"$ACTION\\",
      \\"module\\": \\"$MODULE\\",
      \\"timestamp\\": \\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",
      \\"dev\\": \\"$(git config user.name)\\"
    }" \\
    > /dev/null 2>&1 &
fi
`;
}

function generateSessionEndHook(requireLogChange: boolean): string {
  return `#!/bin/bash
# AgentNorth — Stop hook
# Verifica que se llamo log_change si hubo modificaciones

CHANGES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
LOGGED=$(grep -c "log_change" "$CONTEXT_LOG" 2>/dev/null || echo 0)

${requireLogChange ? `if [ "$CHANGES" -gt 0 ] && [ "$LOGGED" -eq 0 ]; then
  echo "[AgentNorth] Hay $CHANGES archivos modificados pero no se registro ningun cambio con agentnorth_log_change(). Considera ejecutar el log antes de cerrar."
fi` : "# log_change not required by enforcement config"}

# Enviar evento de session end al API
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "\${AGENTNORTH_API_URL}/api/v1/sessions/end" \\
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \\
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{\\"dev\\": \\"$(git config user.name)\\", \\"files_changed\\": $CHANGES, \\"changes_logged\\": $LOGGED}" \\
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

## AgentNorth — OBLIGATORIO

Este proyecto usa AgentNorth como Shared Context Layer. El MCP server \`agentnorth\` esta configurado y DEBE usarse.

### Antes de trabajar en cualquier modulo:
1. Llama \`agentnorth_list_modules()\` para ver los modulos disponibles
2. Llama \`agentnorth_get_context("modulo")\` para el modulo que vas a tocar
3. Consulta \`agentnorth_get_decisions("modulo")\` antes de tomar decisiones nuevas

### Despues de hacer cambios significativos:
4. Llama \`agentnorth_log_change()\` con un resumen de lo que hiciste
5. Si tomaste una decision de arquitectura, llama \`agentnorth_log_decision()\`
6. **OBLIGATORIO**: Despues de cada commit, sincroniza al dashboard:
\`\`\`bash
npx agentnorth sync
\`\`\`
   Esto actualiza el dashboard con los modulos, decisiones y cambios del proyecto.
   **NUNCA te saltes este paso.** El dashboard debe reflejar siempre el estado actual del repo.

### Reglas:
- NUNCA explores el repo con grep/glob/read sin antes consultar AgentNorth
- El contexto que necesitas ya esta indexado — usalo
- Si un modulo no esta indexado, ejecuta \`agentnorth index\` primero
- Las decisiones previas tienen precedencia — no las contradigas sin justificacion
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
  ${existsSync(claudeMdPath) ? "" : "CLAUDE.md                      — Agent instructions\n"}
Enforcement level: ${enforcement.level}
  - PreToolUse: ${enforcement.level === "strict" ? "BLOCKS" : enforcement.level === "soft" ? "WARNS" : "audits"} exploration without context
  - Stop: ${enforcement.require_log_change ? "REMINDS" : "does not remind"} to log changes
  - PostToolUse: tracks all MCP tool usage

Next steps:
  1. Set your API keys in .claude/settings.json → mcpServers.agentnorth.env:
     AGENTNORTH_API_URL = https://agentnorth.io (or your self-hosted URL)
     AGENTNORTH_ORG_KEY = your org key (an_org_...)
     AGENTNORTH_DEV_KEY = your dev key (an_dev_...)
  2. Or export them as environment variables

  Keys are generated when you sign in to the AgentNorth dashboard.

Commit .claude/ so all team members get enforcement automatically.
`);
}
