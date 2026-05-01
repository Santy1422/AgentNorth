#!/bin/bash
# AgentNorth — Stop hook
# Verifica que se llamo log_change si hubo modificaciones

CHANGES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
LOGGED=$(grep -c "log_change" "$CONTEXT_LOG" 2>/dev/null || echo 0)

if [ "$CHANGES" -gt 0 ] && [ "$LOGGED" -eq 0 ]; then
  echo "[AgentNorth] Hay $CHANGES archivos modificados pero no se registro ningun cambio con agentnorth_log_change(). Considera ejecutar el log antes de cerrar."
fi

# Enviar evento de session end al API
if [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST https://api.agentnorth.dev/v1/sessions/end \
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"dev\": \"$(git config user.name)\", \"files_changed\": $CHANGES, \"changes_logged\": $LOGGED}" \
    > /dev/null 2>&1 &
fi
