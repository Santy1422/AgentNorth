"use client";

import { useState } from "react";
import type { SessionData } from "@/app/page";

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
  return `$${usd.toFixed(2)}`;
}

function calcCost(s: SessionData): number {
  const p = getPrice(s.claude_model || "");
  const input = (s.tokens_input || 0) / 1_000_000 * p.input;
  const output = (s.tokens_output || 0) / 1_000_000 * p.output;
  const cache = (s.tokens_cache_read || 0) / 1_000_000 * p.cacheRead;
  return input + output + cache;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);

  // Show relative + absolute
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

  if (mins < 1) return `now · ${time}`;
  if (mins < 60) return `${mins}m ago · ${time}`;
  if (isToday) return `${Math.floor(mins / 60)}h ago · ${time}`;
  if (isYesterday) return `yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

function formatDuration(s: SessionData): string {
  if (s.duration_mins) {
    const m = s.duration_mins;
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  const start = new Date(s.started_at).getTime();
  const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
  const m = Math.floor((end - start) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ToolBar({ tools }: { tools: Record<string, number> }) {
  if (!tools || Object.keys(tools).length === 0) return null;
  const sorted = Object.entries(tools)
    .filter(([name]) => name !== "_progress")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (sorted.length === 0) return null;
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

function Metric({ val, label, accent }: { val: string | number; label: string; accent?: boolean }) {
  return (
    <div className={"session-metric" + (accent ? " accent" : "")}>
      <span className="session-metric-val">{val}</span>
      <span className="session-metric-lbl">{label}</span>
    </div>
  );
}

function ErrorMetric({ val }: { val: number }) {
  return (
    <div className="session-metric error">
      <span className="session-metric-val">{val}</span>
      <span className="session-metric-lbl">errors</span>
    </div>
  );
}

export function SessionsView({ sessions }: { sessions: SessionData[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalCost = sessions.reduce((sum, s) => sum + calcCost(s), 0);
  const totalInput = sessions.reduce((sum, s) => sum + (s.tokens_input || 0), 0);
  const totalOutput = sessions.reduce((sum, s) => sum + (s.tokens_output || 0), 0);
  const totalCacheRead = sessions.reduce((sum, s) => sum + (s.tokens_cache_read || 0), 0);
  const totalSaved = sessions.reduce((sum, s) => sum + (s.tokens_saved_total || 0), 0);
  const activeSessions = sessions.filter(s => !s.ended_at);
  const completedSessions = sessions.filter(s => s.duration_mins && s.duration_mins > 0);
  const avgDuration = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + (s.duration_mins || 0), 0) / completedSessions.length)
    : 0;
  const totalCommits = sessions.reduce((sum, s) => sum + (s.commit_shas?.length || 0), 0);
  const totalFiles = sessions.reduce((sum, s) => sum + (s.files_changed_count || 0), 0);
  const hasTokenData = totalInput > 0 || totalOutput > 0 || totalCacheRead > 0;
  const costPerCommit = totalCommits > 0 ? totalCost / totalCommits : 0;
  const costPerFile = totalFiles > 0 ? totalCost / totalFiles : 0;
  const cacheHitRate = (totalInput + totalCacheRead) > 0 ? Math.round((totalCacheRead / (totalInput + totalCacheRead)) * 100) : 0;

  return (
    <div className="sessions-view">
      {/* Summary cards */}
      <div className="sessions-summary">
        {hasTokenData ? (
          <>
            <div className="session-stat-card highlight">
              <div className="session-stat-value">{formatCost(totalCost)}</div>
              <div className="session-stat-label">Total Cost</div>
            </div>
            <div className="session-stat-card">
              <div className="session-stat-value">{formatTokens(totalInput)}</div>
              <div className="session-stat-label">Input Tokens</div>
            </div>
            <div className="session-stat-card">
              <div className="session-stat-value">{formatTokens(totalOutput)}</div>
              <div className="session-stat-label">Output Tokens</div>
            </div>
            <div className="session-stat-card">
              <div className="session-stat-value">{formatTokens(totalCacheRead)}</div>
              <div className="session-stat-label">Cache Hits</div>
            </div>
          </>
        ) : (
          <div className="session-stat-card highlight">
            <div className="session-stat-value">{formatTokens(totalSaved)}</div>
            <div className="session-stat-label">Tokens Saved</div>
          </div>
        )}
        <div className="session-stat-card">
          <div className="session-stat-value">{sessions.length}</div>
          <div className="session-stat-label">Sessions</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{activeSessions.length}</div>
          <div className="session-stat-label">Active Now</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{avgDuration > 0 ? `${avgDuration}m` : "-"}</div>
          <div className="session-stat-label">Avg Duration</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{totalCommits || "-"}</div>
          <div className="session-stat-label">Commits</div>
        </div>
        <div className="session-stat-card">
          <div className="session-stat-value">{totalFiles || "-"}</div>
          <div className="session-stat-label">Files Changed</div>
        </div>
        {hasTokenData && costPerCommit > 0 && (
          <div className="session-stat-card">
            <div className="session-stat-value">{formatCost(costPerCommit)}</div>
            <div className="session-stat-label">Cost / Commit</div>
          </div>
        )}
        {hasTokenData && cacheHitRate > 0 && (
          <div className="session-stat-card">
            <div className="session-stat-value">{cacheHitRate}%</div>
            <div className="session-stat-label">Cache Hit Rate</div>
          </div>
        )}
      </div>

      {!hasTokenData && sessions.length > 0 && (
        <div className="sessions-hint">
          Token usage data appears after sessions end with the transcript collector enabled.
          Restart Claude Code to activate the updated hooks.
        </div>
      )}

      {/* Session list */}
      <div className="sessions-list">
        {sessions.map((s) => {
          const cost = calcCost(s);
          const isActive = !s.ended_at;
          const isExpanded = expanded === s._id;
          const hasCost = cost > 0.001;
          const duration = formatDuration(s);

          return (
            <div
              key={s._id}
              className={"session-detail-card" + (isActive ? " active" : "") + (isExpanded ? " expanded" : "")}
              onClick={() => setExpanded(isExpanded ? null : s._id)}
            >
              <div className="session-detail-header">
                <div className="session-detail-left">
                  <div className="session-detail-avatar" style={{ background: isActive ? "#22c55e" : "var(--bg-4)" }}>
                    {(s.dev_id?.name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="session-detail-dev">
                      {s.dev_id?.name || "agent"}
                      {isActive && <span className="session-live-dot" />}
                    </div>
                    <div className="session-detail-sub">
                      {s.claude_model && (
                        <span className="session-model-badge">{s.claude_model.replace("claude-", "")}</span>
                      )}
                      {s.branch && <span className="session-branch-badge">{s.branch}</span>}
                      <span className="session-duration-badge">{duration}</span>
                    </div>
                  </div>
                </div>
                <div className="session-detail-right">
                  {hasCost && <span className="session-detail-cost">{formatCost(cost)}</span>}
                  <span className="session-detail-time">{formatDate(s.started_at)}</span>
                </div>
              </div>

              {/* Always-visible metrics row */}
              <div className="session-detail-metrics">
                {(s.tokens_input || 0) > 0 && <Metric val={formatTokens(s.tokens_input || 0)} label="in" />}
                {(s.tokens_output || 0) > 0 && <Metric val={formatTokens(s.tokens_output || 0)} label="out" />}
                {(s.tokens_cache_read || 0) > 0 && <Metric val={formatTokens(s.tokens_cache_read || 0)} label="cache" />}
                {(s.assistant_turns || 0) > 0 && <Metric val={s.assistant_turns || 0} label="turns" />}
                {(s.user_turns || 0) > 0 && <Metric val={s.user_turns || 0} label="prompts" />}
                {(s.files_changed_count || 0) > 0 && <Metric val={s.files_changed_count || 0} label="files" />}
                {(s.commit_shas?.length || 0) > 0 && <Metric val={s.commit_shas?.length || 0} label="commits" />}
                {(s.decisions_logged || 0) > 0 && <Metric val={s.decisions_logged || 0} label="decisions" />}
                {(s.changes_logged || 0) > 0 && <Metric val={s.changes_logged || 0} label="changes" />}
                {(s.tokens_saved_total || 0) > 0 && <Metric val={formatTokens(s.tokens_saved_total)} label="saved" accent />}
                {(s.errors_count || 0) > 0 && <ErrorMetric val={s.errors_count || 0} />}
                {/* Show something when no metrics available */}
                {!(s.tokens_input || s.tokens_output || s.assistant_turns || s.files_changed_count || s.tokens_saved_total) && (
                  <span className="session-no-data">Awaiting session end for telemetry</span>
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="session-expanded">
                  {s.modules_visited && s.modules_visited.length > 0 && (
                    <div className="session-detail-modules">
                      <span className="session-section-label">Modules</span>
                      {s.modules_visited.map(m => (
                        <span key={m} className="session-module-tag">{m}</span>
                      ))}
                    </div>
                  )}

                  {s.tool_calls && Object.keys(s.tool_calls).length > 0 && (
                    <div>
                      <span className="session-section-label">Tool Usage</span>
                      <ToolBar tools={s.tool_calls} />
                    </div>
                  )}

                  {s.files_touched && s.files_touched.length > 0 && (
                    <div className="session-detail-files">
                      <span className="session-section-label">{s.files_touched.length} files touched</span>
                      <div className="session-files-grid">
                        {s.files_touched.slice(0, 10).map(f => (
                          <span key={f} className="session-file-tag">{f.split("/").pop()}</span>
                        ))}
                        {s.files_touched.length > 10 && (
                          <span className="session-file-tag muted">+{s.files_touched.length - 10} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {s.commit_shas && s.commit_shas.length > 0 && (
                    <div className="session-detail-commits">
                      <span className="session-section-label">Commits</span>
                      {s.commit_shas.map(sha => (
                        <span key={sha} className="session-commit-sha">{sha.slice(0, 7)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="sessions-empty">
            <div style={{ fontSize: 14, marginBottom: 6 }}>No sessions yet</div>
            <div>Sessions are tracked automatically when Claude Code connects via hooks.</div>
            <div style={{ marginTop: 8 }}>Run <code>npx agentnorth setup</code> to enable session tracking.</div>
          </div>
        )}
      </div>
    </div>
  );
}
