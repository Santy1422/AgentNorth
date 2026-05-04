"use client";

import { useMemo } from "react";
import type { FeedRow, DashboardData, FileData } from "@/app/page";
import { useT } from "@/i18n/provider";

const KIND_COLORS: Record<string, string> = {
  page: "#f97316",
  component: "#a78bfa",
  hook: "#4ade80",
  lib: "#fbbf24",
  model: "#60a5fa",
  route: "#f472b6",
};

function shortName(path: string): string {
  return path.split("/").pop() || path;
}

function ModuleHoverCard({ module, allFiles, t }: { module: { name: string; description: string; files_count: number; loc: number; files?: FileData[]; dependencies?: { internal: string[]; external: string[] } }; allFiles: FileData[]; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const files = module.files || [];
  const documented = files.filter((f) => f.summary?.trim()).length;
  const docPct = files.length > 0 ? Math.round((documented / files.length) * 100) : 0;
  const hasTests = files.some((f) => f.kind === "test");
  const largeFiles = files.filter((f) => f.loc > 300).length;
  let score = 100;
  if (!hasTests) score -= 20;
  if (largeFiles > 0) score -= largeFiles * 5;
  score = Math.max(0, Math.min(100, score));
  const scoreColor = score >= 80 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";
  const kinds: Record<string, number> = {};
  for (const f of files) kinds[f.kind] = (kinds[f.kind] || 0) + 1;

  return (
    <div className="hover-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="hover-card-title">{module.name}</div>
          {module.description && <div className="hover-card-desc">{module.description}</div>}
        </div>
        <div className="hover-card-score" style={{ background: scoreColor, color: "#000" }}>{score}</div>
      </div>
      <div className="hover-card-meta">
        <span>{module.files_count} {t("main.files")}</span>
        <span>{module.loc.toLocaleString("en")} LOC</span>
        <span>{docPct}% docs</span>
        <span style={{ color: hasTests ? "var(--green)" : "var(--red)" }}>{hasTests ? t("main.testFilesDetected") : t("main.noTestFiles")}</span>
      </div>
      <div className="hover-card-tags">
        {Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => (
          <span key={k} className="hover-card-tag">{v} {k}</span>
        ))}
      </div>
    </div>
  );
}

export function MainView({
  feedRows,
  savedTokens,
  data,
}: {
  feedRows: FeedRow[];
  savedTokens: number;
  data: DashboardData | null;
}) {
  const { t } = useT();
  const dollars = (savedTokens / 100000).toFixed(2);
  const savedDisplay = savedTokens >= 1_000_000 ? (savedTokens / 1_000_000).toFixed(1) + "M" : savedTokens >= 1_000 ? (savedTokens / 1_000).toFixed(1) + "K" : String(savedTokens);
  const totalEvents = data?.total_events || 0;
  const modulesCount = data?.project.modules?.length || 0;
  const decisionsCount = data?.decisions?.length || 0;
  const sessionsCount = data?.sessions?.length || 0;

  const allFiles = useMemo((): FileData[] => {
    if (!data) return [];
    const seen = new Set<string>();
    return (data.project.modules || []).flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [data]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of allFiles) counts[f.kind] = (counts[f.kind] || 0) + 1;
    return counts;
  }, [allFiles]);

  const totalLoc = useMemo(
    () => (data?.project.modules || []).reduce((s, m) => s + (m.loc || 0), 0),
    [data]
  );

  const depsCount = data?.project.deps?.length || 0;
  const vulnCount = data?.project.audit?.length || 0;
  const routeCount = kindCounts["route"] || 0;

  // Doc freshness alerts
  const staleDocs = useMemo(() => {
    if (!data) return [];
    return (data.project.modules || [])
      .map((m) => {
        const files = m.files || [];
        const documented = files.filter((f) => f.summary?.trim()).length;
        const total = files.length;
        const pct = total > 0 ? Math.round((documented / total) * 100) : 0;
        return { name: m.name, documented, total, pct };
      })
      .filter((m) => m.pct < 80 && m.total > 0)
      .sort((a, b) => a.pct - b.pct);
  }, [data]);

  // Health scorecard
  const healthScore = useMemo(() => {
    if (!data) return null;
    const modules = data.project.modules || [];
    let score = 100;
    const checks: { name: string; status: "pass" | "warn" | "fail"; detail: string }[] = [];

    const hasTests = allFiles.some((f) => f.kind === "test");
    if (hasTests) {
      checks.push({ name: "Tests", status: "pass", detail: t("main.testFilesDetected") });
    } else {
      score -= 15;
      checks.push({ name: "Tests", status: "fail", detail: t("main.noTestFiles") });
    }

    if (vulnCount === 0) {
      checks.push({ name: "Security", status: "pass", detail: t("main.noVulnerabilities") });
    } else {
      score -= Math.min(25, vulnCount * 5);
      checks.push({ name: "Security", status: "fail", detail: `${vulnCount} vulnerabilities` });
    }

    const giantFiles = allFiles.filter((f) => f.loc > 500);
    if (giantFiles.length === 0) {
      checks.push({ name: "Complexity", status: "pass", detail: t("main.noLargeFiles") });
    } else {
      score -= Math.min(15, giantFiles.length * 3);
      checks.push({ name: "Complexity", status: "warn", detail: `${giantFiles.length} files >500 LOC` });
    }

    const decCount = data.decisions?.length || 0;
    if (decCount >= 3) {
      checks.push({ name: "Documentation", status: "pass", detail: `${decCount} ${t("main.decisions")}` });
    } else if (decCount > 0) {
      score -= 5;
      checks.push({ name: "Documentation", status: "warn", detail: `Only ${decCount} ${t("main.decisions")}` });
    } else {
      score -= 10;
      checks.push({ name: "Documentation", status: "fail", detail: t("main.noDecisions") });
    }

    const deadCount = allFiles.filter((f) => {
      if (["page", "route", "test", "config"].includes(f.kind)) return false;
      const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
      if (shortName(f.path).startsWith("index.")) return false;
      return !allFiles.some(
        (other) =>
          other.path !== f.path &&
          other.imports?.some(
            (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
          )
      );
    }).length;
    if (deadCount === 0) {
      checks.push({ name: "Dead code", status: "pass", detail: t("main.noOrphans") });
    } else {
      score -= Math.min(10, deadCount * 2);
      checks.push({ name: "Dead code", status: "warn", detail: `${deadCount} possible dead files` });
    }

    if (modules.length >= 2) {
      checks.push({ name: "Modularization", status: "pass", detail: `${modules.length} ${t("main.modules")}` });
    } else {
      score -= 10;
      checks.push({ name: "Modularization", status: "warn", detail: t("main.lowModularization") });
    }

    score = Math.max(0, Math.min(100, score));
    return { score, checks };
  }, [data, allFiles, vulnCount]);

  return (
    <>
      {/* Free version banner */}
      <div className="free-banner">
        <span className="free-banner-badge">{t("main.free")}</span>
        <span>{t("main.freeBanner")}</span>
      </div>

      <section className="hero-v2">
        <div className="hero-v2-left">
          <div className="hero-v2-label">{t("main.tokensSaved")}</div>
          <div className="hero-v2-num">{savedDisplay}</div>
          <div className="hero-v2-sub">
            {"\u2248"} <span className="hero-money">${dollars}</span> {t("main.inCosts")}
          </div>
        </div>
        <div className="hero-v2-stats">
          <div className="hero-v2-stat">
            <span className="hero-v2-stat-num">{modulesCount}</span>
            <span className="hero-v2-stat-label">{t("main.modules")}</span>
          </div>
          <div className="hero-v2-divider" />
          <div className="hero-v2-stat">
            <span className="hero-v2-stat-num">{decisionsCount}</span>
            <span className="hero-v2-stat-label">{t("main.decisions")}</span>
          </div>
          <div className="hero-v2-divider" />
          <div className="hero-v2-stat">
            <span className="hero-v2-stat-num">{totalEvents}</span>
            <span className="hero-v2-stat-label">{t("main.events")}</span>
          </div>
          <div className="hero-v2-divider" />
          <div className="hero-v2-stat">
            <span className="hero-v2-stat-num">{allFiles.length}</span>
            <span className="hero-v2-stat-label">{t("main.files")}</span>
          </div>
          {sessionsCount > 0 && (
            <>
              <div className="hero-v2-divider" />
              <div className="hero-v2-stat">
                <span className="hero-v2-stat-num">{sessionsCount}</span>
                <span className="hero-v2-stat-label">Sessions</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Codebase overview card */}
      {allFiles.length > 0 && (
        <section className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("main.codebaseOverview")}</h2>
            <span className="meta">{t("main.autoGenerated")}</span>
          </div>
          <div className="overview-grid">
            <div className="ov-stat">
              <div className="ov-stat-num">{allFiles.length}</div>
              <div className="ov-stat-label">{t("main.files")}</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num">{totalLoc.toLocaleString("en")}</div>
              <div className="ov-stat-label">{t("main.lines")}</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num">{routeCount}</div>
              <div className="ov-stat-label">{t("main.apis")}</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num">{depsCount}</div>
              <div className="ov-stat-label">{t("main.deps")}</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num" style={{ color: vulnCount > 0 ? "var(--red)" : "var(--green)" }}>
                {vulnCount}
              </div>
              <div className="ov-stat-label">{t("main.vulns")}</div>
            </div>
          </div>
          <div className="overview-kinds">
            {Object.entries(kindCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([kind, count]) => (
                <span key={kind} className="ov-kind">
                  <span className="ov-kind-dot" style={{ background: KIND_COLORS[kind] || "#71717a" }}></span>
                  {count} {kind}
                </span>
              ))}
          </div>
          {modulesCount > 0 && (
            <div className="overview-modules">
              {(data?.project.modules || []).map((m) => (
                <div key={m.name} className="ov-mod hover-card-anchor">
                  <span className="ov-mod-name mono">{m.name}</span>
                  {m.description && <span className="ov-mod-desc">{m.description}</span>}
                  <span className="ov-mod-stats">{m.files_count} files · {(m.loc || 0).toLocaleString("en")} LOC</span>
                  <ModuleHoverCard module={m} allFiles={allFiles} t={t} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Activity Sparkline */}
      {data && data.events && data.events.length > 0 && (
        <section className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("main.recentActivity")}</h2>
            <span className="meta">{t("main.tokensSavedPerDay")}</span>
          </div>
          <div className="spark-chart">
            {(() => {
              const dayMs = 86400000;
              const now = Date.now();
              const days: { date: string; tokens: number; events: number }[] = [];
              for (let i = 13; i >= 0; i--) {
                const d = new Date(now - i * dayMs);
                const key = d.toISOString().slice(0, 10);
                const dayEvents = data.events.filter(
                  (e) => e.timestamp && e.timestamp.slice(0, 10) === key
                );
                const tokens = dayEvents.reduce((s, e) => s + (e.tokens_saved_estimate || 0), 0);
                days.push({ date: key, tokens, events: dayEvents.length });
              }
              const maxTokens = Math.max(1, ...days.map((d) => d.tokens));
              return days.map((d) => (
                <div key={d.date} className="spark-bar-wrap" title={`${new Date(d.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${d.events} events · ${d.tokens.toLocaleString("en")} tokens saved`}>
                  <div
                    className="spark-bar"
                    style={{
                      height: `${Math.max(4, (d.tokens / maxTokens) * 100)}%`,
                      background: d.tokens > 0 ? "var(--accent)" : "var(--bg-4)",
                    }}
                  ></div>
                  <div className="spark-label">{d.date.slice(8)}</div>
                </div>
              ));
            })()}
          </div>
        </section>
      )}

      {/* Health Scorecard */}
      {healthScore && (
        <section className="card-simple health-scorecard" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("main.projectHealth")}</h2>
            <span className="meta">{t("main.autoScorecard")}</span>
          </div>
          <div className="hs-content">
            <div className="hs-score-ring">
              <svg viewBox="0 0 100 100" className="hs-ring-svg">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-3)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={healthScore.score >= 80 ? "var(--green)" : healthScore.score >= 50 ? "var(--yellow)" : "var(--red)"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(healthScore.score / 100) * 264} 264`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="hs-score-num">{healthScore.score}</div>
              <div className="hs-score-label">{t("main.outOf100")}</div>
            </div>
            <div className="hs-checks">
              {healthScore.checks.map((c) => (
                <div key={c.name} className={"hs-check " + c.status}>
                  <span className="hs-check-icon">
                    {c.status === "pass" ? "\u2713" : c.status === "warn" ? "\u26A0" : "\u2717"}
                  </span>
                  <span className="hs-check-name">{c.name}</span>
                  <span className="hs-check-detail">{c.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Health Score History */}
      {data?.health_history && data.health_history.length > 1 && (
        <section className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("main.healthHistory")}</h2>
            <span className="meta">{t("main.lastSnapshots", { n: data.health_history.length })}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, padding: "8px 0" }}>
            {data.health_history.slice().reverse().map((snap, i) => {
              const color = snap.score >= 80 ? "var(--green)" : snap.score >= 50 ? "var(--yellow)" : "var(--red)";
              return (
                <div
                  key={snap.created_at + i}
                  title={`${new Date(snap.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}: Score ${snap.score}/100 · ${snap.modules_count} modules · ${snap.files_count} files · ${snap.loc.toLocaleString("en")} LOC`}
                  style={{
                    flex: 1,
                    height: `${Math.max(4, snap.score)}%`,
                    background: color,
                    borderRadius: "2px 2px 0 0",
                    minWidth: 6,
                    transition: "height 0.3s ease",
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-4)" }}>
            <span>{data.health_history[data.health_history.length - 1]?.created_at.slice(0, 10)}</span>
            <span>{data.health_history[0]?.created_at.slice(0, 10)}</span>
          </div>
        </section>
      )}

      {/* Embeddable Badges */}
      {data?.project.id && (
        <section className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("main.badges")}</h2>
            <span className="meta">{t("main.badgesDesc")}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 0" }}>
            {["health", "modules", "coverage", "deps"].map((type) => (
              <img
                key={type}
                src={`/api/badge/${type}?project=${data.project.id}`}
                alt={`${type} badge`}
                style={{ height: 20 }}
              />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-4)", marginTop: 4 }}>
            <code style={{ fontSize: 10, background: "var(--bg-3)", padding: "2px 6px", borderRadius: 4 }}>
              {`![health](${typeof window !== "undefined" ? window.location.origin : ""}/api/badge/health?project=${data.project.id})`}
            </code>
          </div>
        </section>
      )}

      {/* Doc Freshness Alerts */}
      {staleDocs.length > 0 && (
        <section className="card-simple" style={{ marginBottom: 16, borderLeft: "3px solid var(--yellow)" }}>
          <div className="card-simple-head">
            <h2>{t("main.staleDocs")}</h2>
            <span className="meta">{t("main.underdocModules", { n: staleDocs.length })}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {staleDocs.slice(0, 5).map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ color: s.pct >= 40 ? "var(--yellow)" : "var(--red)", fontSize: 11, fontWeight: 600, minWidth: 36 }}>
                  {s.pct}%
                </span>
                <span className="mono" style={{ fontSize: 12 }}>{s.name}</span>
                <span style={{ fontSize: 10, color: "var(--text-4)", marginLeft: "auto" }}>
                  {t("main.filesWithSummary", { n: s.documented, total: s.total })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="two-col">
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>{t("main.sessions")}</h2>
            {data?.sessions?.some((s) => !s.ended_at) && (
              <span className="live-indicator">
                <span className="live-dot" />
                {t("main.live")}
              </span>
            )}
          </div>
          {data?.sessions && data.sessions.length > 0 ? (
            data.sessions.slice(0, 6).map((s) => {
              const isActive = !s.ended_at;
              const duration = (() => {
                if (s.duration_mins) {
                  const mins = s.duration_mins;
                  if (mins < 60) return `${mins}m`;
                  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                }
                const start = new Date(s.started_at).getTime();
                const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
                const mins = Math.floor((end - start) / 60000);
                if (mins < 60) return `${mins}m`;
                return `${Math.floor(mins / 60)}h ${mins % 60}m`;
              })();
              return (
                <div key={s._id} className={"session-card" + (isActive ? " active" : "")}>
                  <div className="session-card-top">
                    <div className="session-avatar" style={{ background: isActive ? "var(--green)" : "var(--bg-4)" }}>
                      {(s.dev_id?.name || "A").charAt(0).toUpperCase()}
                    </div>
                    <div className="session-card-info">
                      <div className="session-card-name">
                        {s.dev_id?.name || t("main.claudeAgent")}
                        {isActive && <span className="session-live-badge">{t("main.liveLabel")}</span>}
                      </div>
                      <div className="session-card-meta">
                        {s.branch && <span className="session-branch">{s.branch}</span>}
                        <span>{duration}</span>
                        <span className="session-ago">{timeAgo(s.started_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="session-card-stats">
                      {(s.tokens_input || 0) > 0 && <span className="session-stat">{((s.tokens_input || 0) / 1000).toFixed(1)}K in</span>}
                      {(s.tokens_output || 0) > 0 && <span className="session-stat">{((s.tokens_output || 0) / 1000).toFixed(1)}K out</span>}
                      {(s.files_changed_count || 0) > 0 && <span className="session-stat">{s.files_changed_count} {t("main.files")}</span>}
                      {(s.commit_shas?.length || 0) > 0 && <span className="session-stat">{s.commit_shas?.length} commits</span>}
                      {s.modules_visited && s.modules_visited.length > 0 ? <span className="session-stat">{s.modules_visited.length} {t("main.modules")}</span> : null}
                      {s.tokens_saved_total ? <span className="session-stat accent">{(s.tokens_saved_total / 1000).toFixed(1)}k saved</span> : null}
                      {s.claude_model ? <span className="session-stat model">{s.claude_model.replace("claude-", "")}</span> : null}
                    </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: 11, color: "var(--text-4)" }}>{t("main.noSessions")}</div>
              <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 4 }}>
                {t("main.sessionsHint")}
              </div>
            </div>
          )}
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>{t("main.recentActivity")}</h2>
            <span className="meta">{t("main.realtimeSSE")}</span>
          </div>
          {/* Recent decisions inline */}
          {data?.decisions && data.decisions.length > 0 && (
            <div className="main-decisions-mini">
              {data.decisions.slice(0, 3).map((d) => (
                <div key={d._id} className="main-decision-row">
                  <span className="mdr-icon">&#x2713;</span>
                  <div className="mdr-content">
                    <span className="mdr-title">{d.title}</span>
                    <span className="mdr-meta">{d.module || "global"} · {d.author_name} · {timeAgo(d.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="simple-feed">
            {feedRows.length > 0 ? (
              feedRows.map((r, i) => (
                <FeedRowComponent key={r.id} row={r} isNew={i === 0 && !!r.fresh} />
              ))
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: 11, color: "var(--text-4)" }}>{t("main.noActivity")}</div>
                <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 4 }}>
                  {t("main.activityHint")}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

  if (mins < 1) return `now · ${time}`;
  if (mins < 60) return `${mins}m ago · ${time}`;
  if (isToday) return `${Math.floor(mins / 60)}h ago · ${time}`;
  if (isYesterday) return `yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

function FeedRowComponent({ row, isNew }: { row: FeedRow; isNew: boolean }) {
  const tag = row.badges?.find((b) => b.t.includes("token"));

  return (
    <div className={"simple-feed-row" + (isNew ? " new" : "")}>
      <div className="claude-avatar sm">
        {row.who === "Claude" ? "C" : row.who.charAt(0).toUpperCase()}
      </div>
      <div className="sfr-body">
        <span className="sfr-who">{row.who}</span>
        <span className="sfr-verb"> {row.verb} </span>
        <span className="sfr-obj">{row.obj}</span>
      </div>
      {tag && <span className="sfr-tag">{tag.t}</span>}
      <span className="sfr-time">{row.ago}</span>
    </div>
  );
}
