#!/bin/bash
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
if [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST https://api.agentnorth.dev/v1/events \
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"action\": \"$ACTION\",
      \"module\": \"$MODULE\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"dev\": \"$(git config user.name)\"
    }" \
    > /dev/null 2>&1 &
fi
