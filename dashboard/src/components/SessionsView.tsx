"use client";

import type { SessionData } from "@/app/page";

// Pricing per 1M tokens (Opus 4.6 as default)
const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 0.8, output: 4, cacheRead: 0.08 },
};

function getPrice(model: string) {
  for (const [key, val] of Object.entries(PRICING)) {
    if (model?.includes(key) || model?.includes(key.replace(/-/g, ""))) return val;
  }
  return PRICING["claude-opus-4-6"];
}

function formatTokens(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

function calcCost(s: SessionData): number {
  const p = getPrice(s.claude_model || "");
  const input = (s.tokens_input || 0) / 1_000_000 * p.input;
  const output = (s.tokens_output || 0) / 1_000_000 * p.output;
  const cache = ((s as any).tokens_cache_read || 0) / 1_000_000 * p.cacheRead;
  return input + output + cache;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ToolBar({ tools }: { tools: Record<string, number> }) {
  if (!tools || Object.keys(tools).length === 0) return null;
  const sorted = Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  return (
    <div className="tool-bar-chart">
      {sorted.map(([name, count]) => (
        <div key={name} className="tool-bar-row">
          <span className="tool-bar-label">{name}</span>
          <div className="tool-bar-track">
            <div className="tool-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="tool-bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

export function SessionsView({ sessions }: { sessions: SessionData[] }) {
  const totalCost = sessions.reduce((sum, s) => sum + calcCost(s), 0);
  const totalInput = sessions.reduce((sum, s) => sum + (s.tokens_input || 0), 0);
  const totalOutput = sessions.reduce((sum, s) => sum + (s.tokens_output || 0), 0);
  const totalCacheRead = sessions.reduce((sum, s) => sum + ((s as any).tokens_cache_read || 0), 0);
  const totalSaved = sessions.reduce((sum, s) => sum + (s.tokens_saved_total || 0), 0);
  const activeSessions = sessions.filter(s => !s.ended_at);
  const avgDuration = sessions.filter(s => s.duration_mins).reduce((sum, s) => sum + (s.duration_mins || 0), 0) / (sessions.filter(s => s.duration_mins).length || 1);

  return (
    <div className="sessions-view">
      {/* Summary cards */}
      <div className="sessions-summary">
        <div className="session-stat-card">
          <div className="session-stat-value">{formatCost(totalCost)}</div>
          <div className="session-stat-label">Total Cost</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{formatTokens(totalInput + totalOutput)}</div>
          <div className="session-stat-label">Tokens Used</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{formatTokens(totalCacheRead)}</div>
          <div className="session-stat-label">Cache Read</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{formatTokens(totalSaved)}</div>
          <div className="session-stat-label">Tokens Saved</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{sessions.length}</div>
          <div className="session-stat-label">Sessions</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{activeSessions.length}</div>
          <div className="session-stat-label">Active Now</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{Math.round(avgDuration)}m</div>
          <div className="session-stat-label">Avg Duration</div>
        </div>
      </div>

      {/* Session list */}
      <div className="sessions-list">
        {sessions.map((s) => {
          const cost = calcCost(s);
          const isActive = !s.ended_at;
          const toolCalls = (s as any).tool_calls as Record<string, number> | undefined;
          const assistantTurns = (s as any).assistant_turns as number | undefined;
          const userTurns = (s as any).user_turns as number | undefined;
          const cacheRead = (s as any).tokens_cache_read as number | undefined;

          return (
            <div key={s._id} className={"session-detail-card" + (isActive ? " active" : "")}>
              <div className="session-detail-header">
                <div className="session-detail-left">
                  <span className="session-detail-dev">
                    {s.dev_id?.name || "agent"}
                  </span>
                  {isActive && <span className="session-live-dot" />}
                  {s.claude_model && (
                    <span className="session-model-badge">{s.claude_model.replace("claude-", "")}</span>
                  )}
                  {s.branch && (
                    <span className="session-branch-badge">{s.branch}</span>
                  )}
                </div>
                <div className="session-detail-right">
                  <span className="session-detail-cost">{formatCost(cost)}</span>
                  <span className="session-detail-time">{timeAgo(s.started_at)}</span>
                </div>
              </div>

              <div className="session-detail-metrics">
                <div className="session-metric">
                  <span className="session-metric-val">{formatTokens(s.tokens_input || 0)}</span>
                  <span className="session-metric-lbl">in</span>
                </div>
                <div className="session-metric">
                  <span className="session-metric-val">{formatTokens(s.tokens_output || 0)}</span>
                  <span className="session-metric-lbl">out</span>
                </div>
                {cacheRead ? (
                  <div className="session-metric">
                    <span className="session-metric-val">{formatTokens(cacheRead)}</span>
                    <span className="session-metric-lbl">cache</span>
                  </div>
                ) : null}
                {assistantTurns ? (
                  <div className="session-metric">
                    <span className="session-metric-val">{assistantTurns}</span>
                    <span className="session-metric-lbl">turns</span>
                  </div>
                ) : null}
                {userTurns ? (
                  <div className="session-metric">
                    <span className="session-metric-val">{userTurns}</span>
                    <span className="session-metric-lbl">prompts</span>
                  </div>
                ) : null}
                {s.duration_mins ? (
                  <div className="session-metric">
                    <span className="session-metric-val">{s.duration_mins}m</span>
                    <span className="session-metric-lbl">duration</span>
                  </div>
                ) : null}
                {(s.files_changed_count || 0) > 0 && (
                  <div className="session-metric">
                    <span className="session-metric-val">{s.files_changed_count}</span>
                    <span className="session-metric-lbl">files</span>
                  </div>
                )}
                {(s.decisions_logged || 0) > 0 && (
                  <div className="session-metric">
                    <span className="session-metric-val">{s.decisions_logged}</span>
                    <span className="session-metric-lbl">decisions</span>
                  </div>
                )}
                {(s.changes_logged || 0) > 0 && (
                  <div className="session-metric">
                    <span className="session-metric-val">{s.changes_logged}</span>
                    <span className="session-metric-lbl">changes</span>
                  </div>
                )}
                {(s.commit_shas?.length || 0) > 0 && (
                  <div className="session-metric">
                    <span className="session-metric-val">{s.commit_shas?.length}</span>
                    <span className="session-metric-lbl">commits</span>
                  </div>
                )}
                {(s.errors_count || 0) > 0 && (
                  <div className="session-metric error">
                    <span className="session-metric-val">{s.errors_count}</span>
                    <span className="session-metric-lbl">errors</span>
                  </div>
                )}
              </div>

              {/* Modules visited */}
              {s.modules_visited && s.modules_visited.length > 0 && (
                <div className="session-detail-modules">
                  {s.modules_visited.map(m => (
                    <span key={m} className="session-module-tag">{m}</span>
                  ))}
                </div>
              )}

              {/* Tool calls breakdown */}
              {toolCalls && <ToolBar tools={toolCalls} />}

              {/* Files touched */}
              {s.files_touched && s.files_touched.length > 0 && (
                <div className="session-detail-files">
                  <span className="session-files-label">{s.files_touched.length} files touched:</span>
                  <span className="session-files-list">
                    {s.files_touched.slice(0, 5).map(f => f.split("/").pop()).join(", ")}
                    {s.files_touched.length > 5 ? ` +${s.files_touched.length - 5} more` : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="sessions-empty">
            No sessions yet. Sessions are tracked automatically when Claude Code connects via hooks.
          </div>
        )}
      </div>
    </div>
  );
}
