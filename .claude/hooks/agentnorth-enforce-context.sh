#!/bin/bash
# AgentNorth — PreToolUse hook (Read|Grep|Glob)
# Advierte si Claude explora un modulo sin consultar contexto primero

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

if ! grep -q "^${MODULE}$" "$CONTEXT_LOG" 2>/dev/null; then
  # Soft enforcement: permitir pero advertir
  cat << EOF
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "additionalContext": "[AgentNorth] No has consultado el contexto del modulo '$MODULE'. Llama agentnorth_get_context('$MODULE') primero para tener el contexto completo y ahorrar tokens."}}
EOF
  exit 0
fi

# Modulo ya consultado, permitir silenciosamente
exit 0
