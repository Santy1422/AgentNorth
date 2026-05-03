#!/bin/bash
# AgentNorth — Stop hook
# Load API keys
if [ -f ".agentnorth/.env" ]; then set -a; source .agentnorth/.env; set +a; fi

# Verifies that log_change and log_decision were called appropriately

CHANGES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
CONTEXT_LOG="/tmp/agentnorth-context-$(date +%Y%m%d).log"
LOGGED=$(grep -c "log_change" "$CONTEXT_LOG" 2>/dev/null || echo 0)
DECISIONS_LOGGED=$(grep -c "log_decision" "$CONTEXT_LOG" 2>/dev/null || echo 0)

if [ "$CHANGES" -gt 0 ] && [ "$LOGGED" -eq 0 ]; then
  echo "[AgentNorth] WARNING: $CHANGES files modified but no changes were logged. Call agentnorth_log_change() to record what you did and why."
fi

# Check if significant changes were made without a decision log
if [ "$CHANGES" -gt 5 ] && [ "$DECISIONS_LOGGED" -eq 0 ]; then
  echo "[AgentNorth] WARNING: $CHANGES files modified but no architecture decisions were logged. If you made structural changes, call agentnorth_log_decision() to record the rationale."
fi

# Gather files touched and tokens saved for session summary
FILES_LIST=$(git diff --name-only 2>/dev/null | head -50 | jq -R -s 'split("\n") | map(select(length > 0))')
TOKENS_LOG="/tmp/agentnorth-tokens-$(date +%Y%m%d).log"
TOKENS_SAVED=$(cat "$TOKENS_LOG" 2>/dev/null | awk '{s+=$1} END {print s+0}')

# Gather commit SHAs made during this session (last 2 hours)
COMMIT_SHAS=$(git log --since="2 hours ago" --format="%H" 2>/dev/null | head -20 | jq -R -s 'split("\n") | map(select(length > 0))')

# Count decisions logged
DECISIONS_LOGGED=$(grep -c "log_decision" "$CONTEXT_LOG" 2>/dev/null || echo 0)

# Count edit/write operations from edit tracking log
EDIT_LOG="/tmp/agentnorth-edits-$(date +%Y%m%d).log"
EDITS_COUNT=$(grep -c "Edit\|Write" "$EDIT_LOG" 2>/dev/null || echo 0)
BASH_COUNT=$(grep -c "Bash:" "$EDIT_LOG" 2>/dev/null || echo 0)

# Get list of modules that had context checked
MODULES_VISITED=$(grep -v "log_change\|log_decision\|Bash:" "$CONTEXT_LOG" 2>/dev/null | sort -u | jq -R -s 'split("\n") | map(select(length > 0))')

# Collect full transcript telemetry (real tokens, tool calls, conversation summary)
TRANSCRIPT_JSON=""
if command -v node >/dev/null 2>&1; then
  TRANSCRIPT_JSON=$(node -e "
    try {
      const { collectCurrentSession } = require('$(which agentnorth 2>/dev/null | xargs dirname 2>/dev/null)/../dist/index.js' || {});
      if (collectCurrentSession) {
        const summary = collectCurrentSession(process.cwd());
        if (summary) console.log(JSON.stringify(summary));
      }
    } catch {
      // Try direct path
      try {
        const path = require('path');
        const home = require('os').homedir();
        const fs = require('fs');
        const projectDir = path.join(home, '.claude', 'projects');
        const encoded = process.cwd().replace(/\\//g, '-');
        const dir = path.join(projectDir, encoded);
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
          const sorted = files.map(f => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a,b) => b.m - a.m);
          if (sorted[0]) {
            const lines = fs.readFileSync(path.join(dir, sorted[0].f), 'utf8').trim().split('\n');
            let ti=0, to=0, cr=0, cc=0, at=0, ut=0, model='';
            const tools = {};
            for (const l of lines) {
              try {
                const o = JSON.parse(l);
                if (o.type==='assistant') {
                  at++;
                  if (o.message?.model && !model) model = o.message.model;
                  if (o.message?.usage) {
                    ti += o.message.usage.input_tokens || 0;
                    to += o.message.usage.output_tokens || 0;
                    cr += o.message.usage.cache_read_input_tokens || 0;
                    cc += o.message.usage.cache_creation_input_tokens || 0;
                  }
                  if (Array.isArray(o.message?.content)) {
                    for (const b of o.message.content) {
                      if (b.type==='tool_use'&&b.name) tools[b.name]=(tools[b.name]||0)+1;
                    }
                  }
                } else if (o.type==='user') ut++;
              } catch {}
            }
            console.log(JSON.stringify({tokens_input:ti,tokens_output:to,tokens_cache_read:cr,tokens_cache_creation:cc,assistant_turns:at,user_turns:ut,claude_model:model,tool_calls:tools}));
          }
        }
      } catch {}
    }
  " 2>/dev/null)
fi

# Extract transcript fields
T_INPUT=$(echo "$TRANSCRIPT_JSON" | jq -r '.tokens_input // 0' 2>/dev/null || echo 0)
T_OUTPUT=$(echo "$TRANSCRIPT_JSON" | jq -r '.tokens_output // 0' 2>/dev/null || echo 0)
T_CACHE_READ=$(echo "$TRANSCRIPT_JSON" | jq -r '.tokens_cache_read // 0' 2>/dev/null || echo 0)
T_CACHE_CREATE=$(echo "$TRANSCRIPT_JSON" | jq -r '.tokens_cache_creation // 0' 2>/dev/null || echo 0)
T_MODEL=$(echo "$TRANSCRIPT_JSON" | jq -r '.claude_model // ""' 2>/dev/null || echo "")
T_ASSISTANT_TURNS=$(echo "$TRANSCRIPT_JSON" | jq -r '.assistant_turns // 0' 2>/dev/null || echo 0)
T_USER_TURNS=$(echo "$TRANSCRIPT_JSON" | jq -r '.user_turns // 0' 2>/dev/null || echo 0)
T_TOOL_CALLS=$(echo "$TRANSCRIPT_JSON" | jq -c '.tool_calls // {}' 2>/dev/null || echo "{}")

# Send session end event to API with full transcript telemetry
if [ -n "$AGENTNORTH_API_URL" ] && [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST "${AGENTNORTH_API_URL}/api/v1/sessions/end" \
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"dev\": \"$(git config user.name)\",
      \"files_changed\": $CHANGES,
      \"changes_logged\": $LOGGED,
      \"decisions_logged\": $DECISIONS_LOGGED,
      \"files_touched\": $FILES_LIST,
      \"commit_shas\": $COMMIT_SHAS,
      \"tokens_saved\": $TOKENS_SAVED,
      \"edits_count\": $EDITS_COUNT,
      \"bash_commands_count\": $BASH_COUNT,
      \"tokens_input\": $T_INPUT,
      \"tokens_output\": $T_OUTPUT,
      \"tokens_cache_read\": $T_CACHE_READ,
      \"tokens_cache_creation\": $T_CACHE_CREATE,
      \"claude_model\": \"$T_MODEL\",
      \"assistant_turns\": $T_ASSISTANT_TURNS,
      \"user_turns\": $T_USER_TURNS,
      \"tool_calls\": $T_TOOL_CALLS
    }" \
    > /dev/null 2>&1 &
fi
