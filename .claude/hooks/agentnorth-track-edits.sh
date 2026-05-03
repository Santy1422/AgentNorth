#!/bin/bash
# AgentNorth — PostToolUse hook (Edit|Write|Bash)
# Load API keys
if [ -f ".agentnorth/.env" ]; then set -a; source .agentnorth/.env; set +a; fi

# Tracks every file modification and command execution

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)

EDIT_LOG="/tmp/agentnorth-edits-$(date +%Y%m%d).log"

if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $TOOL_NAME $FILE_PATH" >> "$EDIT_LOG"

  # Send file edit event to API
  if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
    curl -s -X POST "${AGENTNORTH_API_URL}/api/v1/events" \
      -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
      -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"action\": \"file_edit\",
        \"module\": \"$(echo "$FILE_PATH" | sed 's|.*/src/||' | cut -d'/' -f1)\",
        \"file\": \"$FILE_PATH\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"dev\": \"$(git config user.name)\"
      }" \
      > /dev/null 2>&1 &
  fi

elif [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null | head -c 200)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Bash: $COMMAND" >> "$EDIT_LOG"

  # Send bash command event to API
  if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
    # Sanitize command for JSON (escape quotes, truncate)
    SAFE_CMD=$(echo "$COMMAND" | head -c 150 | sed 's/"/\\"/g' | tr '\n' ' ')
    curl -s -X POST "${AGENTNORTH_API_URL}/api/v1/events" \
      -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
      -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"action\": \"bash_command\",
        \"module\": \"\",
        \"file\": \"\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"dev\": \"$(git config user.name)\"
      }" \
      > /dev/null 2>&1 &
  fi
fi
