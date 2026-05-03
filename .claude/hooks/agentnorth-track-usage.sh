#!/bin/bash
# AgentNorth — PostToolUse hook (mcp__agentnorth__*)
# Load API keys
if [ -f ".agentnorth/.env" ]; then set -a; source .agentnorth/.env; set +a; fi

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
  curl -s -X POST "${AGENTNORTH_API_URL}/api/v1/events" \
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"action\": \"$ACTION\",
      \"module\": \"$MODULE\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"dev\": \"$(git config user.name)\",
      \"tokens_saved_estimate\": $TOKENS_SAVED
    }" \
    > /dev/null 2>&1 &
fi
