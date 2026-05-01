# 08 — Forzar uso del MCP + Tracking Realtime

## Problema

Si el MCP esta configurado pero Claude no lo usa, perdemos:
- Tracking de quien hizo que
- Write-back de decisiones y cambios
- El ahorro de tokens (Claude explora el repo desde cero)
- Visibilidad en el dashboard

**El MCP tiene que ser obligatorio, no opcional.**

---

## 3 Capas de enforcement

```
Capa 1: CLAUDE.md          → Le dice a Claude QUE debe hacer (instrucciones)
Capa 2: Hooks               → FUERZA que lo haga (determinista, no negociable)
Capa 3: MCP server instructions → Refuerza el comportamiento desde el server
```

Las 3 capas juntas garantizan que Claude use TokenDoc en cada sesion.

---

## Capa 1: CLAUDE.md (instrucciones al agente)

El CLAUDE.md del repo incluye instrucciones explicitas para usar TokenDoc.

```markdown
# CLAUDE.md

## TokenDoc — OBLIGATORIO

Antes de trabajar en cualquier modulo:
1. Llama `tokendoc_list_modules()` para ver los modulos disponibles
2. Llama `tokendoc_get_context("modulo")` para el modulo que vas a tocar
3. Lee las decisiones existentes antes de tomar decisiones nuevas

Despues de hacer cambios significativos:
4. Llama `tokendoc_log_change()` con un resumen de lo que hiciste
5. Si tomaste una decision de arquitectura, llama `tokendoc_log_decision()`

NUNCA explores el repo con grep/glob/read sin antes consultar TokenDoc.
El contexto que necesitas ya esta indexado — usalo.
```

**Limitacion:** CLAUDE.md es una instruccion, no una garantia. Claude puede ignorarlo.

---

## Capa 2: Hooks (enforcement determinista)

Los hooks de Claude Code son **deterministicos** — se ejecutan siempre, Claude no puede saltarselos. Esta es la capa que FUERZA el comportamiento.

### Hook 1: SessionStart — Inyectar contexto automaticamente

Cuando arranca la sesion, el hook llama al MCP y le da a Claude el contexto del proyecto.

```json
// .claude/settings.json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/tokendoc-session-start.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/tokendoc-session-start.sh

# El stdout de SessionStart se inyecta como contexto a Claude
cat << 'EOF'
[TokenDoc] Sesion iniciada. Modulos disponibles en este proyecto:
- Usa tokendoc_list_modules() para ver todos los modulos
- Usa tokendoc_get_context("modulo") ANTES de trabajar en cualquier modulo
- Usa tokendoc_log_decision() y tokendoc_log_change() DESPUES de hacer cambios
- NO explores el repo manualmente sin consultar TokenDoc primero
EOF

# Opcional: enviar evento de session start al API
curl -s -X POST https://api.tokendoc.dev/v1/sessions/start \
  -H "X-Org-Key: $TOKENDOC_ORG_KEY" \
  -H "X-Dev-Key: $TOKENDOC_DEV_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"repo\": \"$(git remote get-url origin 2>/dev/null)\", \"dev\": \"$(git config user.name)\"}" \
  > /dev/null 2>&1 &
```

### Hook 2: PreToolUse — Bloquear exploracion sin contexto previo

Si Claude intenta leer archivos de un modulo sin haber llamado `tokendoc_get_context` primero, el hook lo bloquea.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Grep|Glob",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/tokendoc-enforce-context.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/tokendoc-enforce-context.sh
# Recibe tool input via stdin (JSON)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // .pattern // .query // ""')

# Verificar si el archivo esta en un modulo conocido
# y si ya se consulto el contexto de ese modulo en esta sesion
CONTEXT_LOG="/tmp/tokendoc-context-$(date +%Y%m%d).log"

# Si es un archivo dentro de src/ y no se ha consultado contexto
if echo "$FILE_PATH" | grep -q "src/"; then
  MODULE=$(echo "$FILE_PATH" | sed 's|src/||' | cut -d'/' -f1)

  if ! grep -q "$MODULE" "$CONTEXT_LOG" 2>/dev/null; then
    # Inyectar feedback a Claude (no bloquear, pero advertir)
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"allow\", \"additionalContext\": \"[TokenDoc] No has consultado el contexto del modulo '$MODULE'. Llama tokendoc_get_context('$MODULE') primero para tener el contexto completo y ahorrar tokens.\"}}"
    exit 0
  fi
fi

# Permitir la operacion
echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"allow\"}}"
```

### Hook 3: PostToolUse — Trackear llamadas al MCP en realtime

Cada vez que Claude usa una tool de TokenDoc, enviamos el evento al API inmediatamente.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__tokendoc__.*",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/tokendoc-track-usage.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/tokendoc-track-usage.sh

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
# Extraer el nombre del tool sin el prefijo mcp__tokendoc__
ACTION=$(echo "$TOOL_NAME" | sed 's/mcp__tokendoc__//')

# Enviar evento al API (async, no bloquea a Claude)
curl -s -X POST https://api.tokendoc.dev/v1/events \
  -H "X-Org-Key: $TOKENDOC_ORG_KEY" \
  -H "X-Dev-Key: $TOKENDOC_DEV_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"$ACTION\",
    \"tool_input\": $(echo "$INPUT" | jq '.tool_input // {}'),
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"dev\": \"$(git config user.name)\"
  }" \
  > /dev/null 2>&1 &

# Registrar que se consulto este modulo (para el hook de enforcement)
MODULE=$(echo "$INPUT" | jq -r '.tool_input.module // ""')
if [ -n "$MODULE" ] && echo "$ACTION" | grep -q "get_context"; then
  echo "$MODULE" >> "/tmp/tokendoc-context-$(date +%Y%m%d).log"
fi
```

### Hook 4: Stop — Forzar log_change al finalizar

Cuando Claude termina, si hizo cambios pero no llamo `tokendoc_log_change`, le recordamos.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/tokendoc-session-end.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/tokendoc-session-end.sh

# Verificar si hubo cambios en git pero no se llamo log_change
CHANGES=$(git diff --name-only 2>/dev/null | wc -l)
LOGGED=$(grep -c "log_change" "/tmp/tokendoc-context-$(date +%Y%m%d).log" 2>/dev/null || echo 0)

if [ "$CHANGES" -gt 0 ] && [ "$LOGGED" -eq 0 ]; then
  echo "[TokenDoc] Hay $CHANGES archivos modificados pero no se registro ningun cambio con tokendoc_log_change(). Considera ejecutar el log antes de cerrar."
fi

# Enviar evento de session end al API
curl -s -X POST https://api.tokendoc.dev/v1/sessions/end \
  -H "X-Org-Key: $TOKENDOC_ORG_KEY" \
  -H "X-Dev-Key: $TOKENDOC_DEV_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"dev\": \"$(git config user.name)\", \"files_changed\": $CHANGES, \"changes_logged\": $LOGGED}" \
  > /dev/null 2>&1 &
```

---

## Capa 3: MCP Server instructions

El SDK de MCP permite pasar `instructions` al crear el server. Estas instrucciones se inyectan en el contexto del agente cuando se conecta.

```typescript
const server = new McpServer(
  { name: "tokendoc", version: "1.0.0" },
  {
    instructions: `TokenDoc es tu fuente primaria de contexto para este proyecto.

REGLAS:
1. SIEMPRE llama tokendoc_get_context() antes de explorar un modulo con Read/Grep/Glob
2. SIEMPRE llama tokendoc_log_decision() cuando tomes una decision de arquitectura
3. SIEMPRE llama tokendoc_log_change() despues de modificar archivos
4. Consulta tokendoc_get_decisions() antes de tomar decisiones que podrian contradecir decisiones previas
5. El contexto de TokenDoc esta pre-indexado y optimizado — es mas rapido y barato que explorar el repo manualmente`
  }
);
```

---

## Flujo completo con enforcement

```
1. Dev abre Claude Code
   → Hook SessionStart se ejecuta
   → Inyecta instrucciones de TokenDoc + envia session start al API
   → Dashboard: "Santi inicio sesion en DGuard"

2. Claude intenta leer src/auth/middleware.ts
   → Hook PreToolUse se ejecuta
   → Detecta que no se consulto contexto de "auth"
   → Inyecta: "Llama tokendoc_get_context('auth') primero"
   → Claude llama tokendoc_get_context("auth")

3. Claude recibe bundle de auth (5K tokens en vez de 60K)
   → Hook PostToolUse se ejecuta
   → Envia evento al API: dev=santi, action=get_context, module=auth
   → Dashboard: "Santi consulto contexto de auth"

4. Claude trabaja, modifica codigo

5. Claude toma decision de arquitectura
   → Llama tokendoc_log_decision(...)
   → Hook PostToolUse envia evento al API
   → Dashboard: "Santi (via Claude) logo decision #024"

6. Claude termina
   → Hook Stop se ejecuta
   → Verifica que se llamo log_change
   → Si no, advierte
   → Envia session end al API
   → Dashboard: "Sesion de Santi finalizada. 3 tools usadas, 1 decision, 1 cambio"
```

---

## Setup completo: lo que se commitea al repo

```
.claude/
  settings.json               ← MCP server config + hooks config
  hooks/
    tokendoc-session-start.sh  ← Inyecta contexto al inicio
    tokendoc-enforce-context.sh ← Advierte si no consulto contexto
    tokendoc-track-usage.sh    ← Envia eventos al API (realtime)
    tokendoc-session-end.sh    ← Verifica log_change al final

CLAUDE.md                     ← Instrucciones para usar TokenDoc

.tokendoc/
  config.yaml                 ← Configuracion del proyecto
  bundles/                    ← Contexto indexado
  decisions/                  ← Decisiones (read + write)
  changelog/                  ← Cambios de agentes (write)
```

Todo se commitea. Cualquier dev que clone el repo tiene enforcement automatico.

---

## Lo que ve el dashboard en realtime

```
Timeline live:
  14:30:00  Santi  session_start   DGuard
  14:30:02  Santi  get_context     auth         ~5K tokens saved
  14:31:15  Santi  get_decisions   auth
  14:35:40  Santi  log_decision    auth         "JWT bearer over cookies"
  14:42:00  Santi  get_context     billing      ~8K tokens saved
  14:48:30  Santi  log_change      billing      3 files, non-breaking
  14:50:00  Santi  session_end     12min, 6 actions

  14:55:00  Juan   session_start   DGuard
  14:55:03  Juan   get_context     tenants      ~4K tokens saved
  ...
```

---

## Nivel de enforcement: configurable por org

| Nivel | PreToolUse | Comportamiento |
|-------|-----------|---------------|
| **Soft** (default) | `allow` + `additionalContext` | Advierte pero no bloquea. Claude recibe sugerencia. |
| **Strict** | `deny` si no hay contexto previo | Bloquea Read/Grep/Glob hasta que se llame get_context. |
| **Audit only** | `allow` siempre | Solo trackea, no interviene. Para equipos que quieren datos sin friccion. |

Configurable en `.tokendoc/config.yaml`:
```yaml
enforcement:
  level: soft    # soft | strict | audit
  track_sessions: true
  require_log_change: true
  require_log_decision: false
```

---

## Sources

- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code MCP Setup](https://code.claude.com/docs/en/mcp)
- [Claude Code Hooks: All 12 Lifecycle Events](https://claudefa.st/blog/tools/hooks/hooks-guide)
- [Claude Code Session Lifecycle Hooks](https://claudefa.st/blog/tools/hooks/session-lifecycle-hooks)
- [Claude Code Hooks Mastery (GitHub)](https://github.com/disler/claude-code-hooks-mastery)
