#!/bin/bash
# AgentNorth — SessionStart hook
# Load API keys
if [ -f ".agentnorth/.env" ]; then set -a; source .agentnorth/.env; set +a; fi

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
  curl -s -X POST "${AGENTNORTH_API_URL}/api/v1/sessions/start" \
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"repo\": \"$(git remote get-url origin 2>/dev/null)\", \"dev\": \"$(git config user.name)\", \"branch\": \"$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')\", \"model\": \"$(echo $CLAUDE_MODEL 2>/dev/null)\", \"conversation_id\": \"$(echo $CLAUDE_CONVERSATION_ID 2>/dev/null)\"}" \
    > /dev/null 2>&1 &
fi
