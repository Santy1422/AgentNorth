#!/bin/bash
# AgentNorth — PreToolUse hook (Edit|Write)
# Load API keys
if [ -f ".agentnorth/.env" ]; then set -a; source .agentnorth/.env; set +a; fi

# Enforcement level: strict
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

if ! grep -q "^${MODULE}$" "$CONTEXT_LOG" 2>/dev/null; then
  cat << EOF
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "additionalContext": "[AgentNorth] BLOCKED: You are editing a file in module '$MODULE' without context. Call agentnorth_get_context('$MODULE') first. This ensures you understand the module architecture, existing decisions, and conventions before making changes."}}
EOF
  exit 0
fi

exit 0
