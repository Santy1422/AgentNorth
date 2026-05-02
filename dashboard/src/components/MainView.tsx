"use client";

import { useMemo, useState } from "react";
import type { FeedRow, DashboardData, FileData, HealthSnapshotData } from "@/app/page";

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

function ModuleHoverCard({ module, allFiles }: { module: { name: string; description: string; files_count: number; loc: number; files?: FileData[]; dependencies?: { internal: string[]; external: string[] } }; allFiles: FileData[] }) {
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
        <span>{module.files_count} archivos</span>
        <span>{module.loc.toLocaleString("es")} LOC</span>
        <span>{docPct}% docs</span>
        <span style={{ color: hasTests ? "var(--green)" : "var(--red)" }}>{hasTests ? "con tests" : "sin tests"}</span>
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
  const dollars = (savedTokens / 100000).toFixed(2);
  const totalEvents = data?.total_events || 0;
  const modulesCount = data?.project.modules?.length || 0;
  const decisionsCount = data?.decisions?.length || 0;

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

  // Health scorecard (Backstage-inspired)
  const healthScore = useMemo(() => {
    if (!data) return null;
    const modules = data.project.modules || [];
    let score = 100;
    const checks: { name: string; status: "pass" | "warn" | "fail"; detail: string }[] = [];

    // Check: has tests
    const hasTests = allFiles.some((f) => f.kind === "test");
    if (hasTests) {
      checks.push({ name: "Tests", status: "pass", detail: "Archivos de test detectados" });
    } else {
      score -= 15;
      checks.push({ name: "Tests", status: "fail", detail: "Sin archivos de test" });
    }

    // Check: no vulnerabilities
    if (vulnCount === 0) {
      checks.push({ name: "Seguridad", status: "pass", detail: "Sin vulnerabilidades" });
    } else {
      score -= Math.min(25, vulnCount * 5);
      checks.push({ name: "Seguridad", status: "fail", detail: `${vulnCount} vulnerabilidades` });
    }

    // Check: no giant files
    const giantFiles = allFiles.filter((f) => f.loc > 500);
    if (giantFiles.length === 0) {
      checks.push({ name: "Complejidad", status: "pass", detail: "Sin archivos >500 LOC" });
    } else {
      score -= Math.min(15, giantFiles.length * 3);
      checks.push({ name: "Complejidad", status: "warn", detail: `${giantFiles.length} archivos >500 LOC` });
    }

    // Check: documentation (decisions)
    const decCount = data.decisions?.length || 0;
    if (decCount >= 3) {
      checks.push({ name: "Documentacion", status: "pass", detail: `${decCount} decisiones documentadas` });
    } else if (decCount > 0) {
      score -= 5;
      checks.push({ name: "Documentacion", status: "warn", detail: `Solo ${decCount} decisiones` });
    } else {
      score -= 10;
      checks.push({ name: "Documentacion", status: "fail", detail: "Sin decisiones documentadas" });
    }

    // Check: dead files
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
      checks.push({ name: "Codigo muerto", status: "pass", detail: "Sin archivos huerfanos" });
    } else {
      score -= Math.min(10, deadCount * 2);
      checks.push({ name: "Codigo muerto", status: "warn", detail: `${deadCount} posibles archivos muertos` });
    }

    // Check: modularization
    if (modules.length >= 2) {
      checks.push({ name: "Modularizacion", status: "pass", detail: `${modules.length} modulos definidos` });
    } else {
      score -= 10;
      checks.push({ name: "Modularizacion", status: "warn", detail: "Poca modularizacion" });
    }

    score = Math.max(0, Math.min(100, score));
    return { score, checks };
  }, [data, allFiles, vulnCount]);

  return (
    <>
      <section className="hero">
        <div className="hero-label">Tokens ahorrados con AgentNorth</div>
        <div className="hero-num">{savedTokens.toLocaleString("es")}</div>
        <div className="hero-sub">
          {"\u2248"} <span className="hero-money">${dollars}</span> en API
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-num">{modulesCount}</span>
            <span className="hero-stat-label">modulos</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">{decisionsCount}</span>
            <span className="hero-stat-label">decisiones</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">{totalEvents}</span>
            <span className="hero-stat-label">eventos</span>
          </div>
        </div>
      </section>

      {/* Codebase overview card */}
      {allFiles.length > 0 && (
        <section className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>Resumen del codebase</h2>
            <span className="meta">auto-generado</span>
          </div>
          <div className="overview-grid">
            <div className="ov-stat">
              <div className="ov-stat-num">{allFiles.length}</div>
              <div className="ov-stat-label">archivos</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num">{totalLoc.toLocaleString("es")}</div>
              <div className="ov-stat-label">lineas</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num">{routeCount}</div>
              <div className="ov-stat-label">APIs</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num">{depsCount}</div>
              <div className="ov-stat-label">deps</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num" style={{ color: vulnCount > 0 ? "var(--red)" : "var(--green)" }}>
                {vulnCount}
              </div>
              <div className="ov-stat-label">vulns</div>
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
                  <span className="ov-mod-stats">{m.files_count} files · {(m.loc || 0).toLocaleString("es")} LOC</span>
                  <ModuleHoverCard module={m} allFiles={allFiles} />
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
            <h2>Actividad reciente</h2>
            <span className="meta">tokens ahorrados por dia</span>
          </div>
          <div className="spark-chart">
            {(() => {
              // Group events by day
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
                <div key={d.date} className="spark-bar-wrap" title={`${d.date}: ${d.events} eventos, ${d.tokens.toLocaleString("es")} tokens`}>
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
            <h2>Salud del proyecto</h2>
            <span className="meta">scorecard automatico</span>
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
              <div className="hs-score-label">/ 100</div>
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
            <h2>Historial de salud</h2>
            <span className="meta">ultimos {data.health_history.length} snapshots</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, padding: "8px 0" }}>
            {data.health_history.slice().reverse().map((snap, i) => {
              const color = snap.score >= 80 ? "var(--green)" : snap.score >= 50 ? "var(--yellow)" : "var(--red)";
              return (
                <div
                  key={snap.created_at + i}
                  title={`${snap.created_at.slice(0, 10)}: ${snap.score}/100 · ${snap.modules_count} mods · ${snap.files_count} files · ${snap.loc} LOC`}
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
            <h2>Badges embebibles</h2>
            <span className="meta">para README, Notion, Slack</span>
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
            <h2>Documentacion desactualizada</h2>
            <span className="meta">{staleDocs.length} modulos sin documentar</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {staleDocs.slice(0, 5).map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ color: s.pct >= 40 ? "var(--yellow)" : "var(--red)", fontSize: 11, fontWeight: 600, minWidth: 36 }}>
                  {s.pct}%
                </span>
                <span className="mono" style={{ fontSize: 12 }}>{s.name}</span>
                <span style={{ fontSize: 10, color: "var(--text-4)", marginLeft: "auto" }}>
                  {s.documented}/{s.total} archivos con summary
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="two-col">
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Sesiones de agentes</h2>
            <span className="meta">en vivo</span>
          </div>
          {data?.sessions && data.sessions.length > 0 ? (
            data.sessions.slice(0, 6).map((s) => {
              const isActive = !s.ended_at;
              const duration = (() => {
                const start = new Date(s.started_at).getTime();
                const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
                const mins = Math.floor((end - start) / 60000);
                if (mins < 60) return `${mins}m`;
                return `${Math.floor(mins / 60)}h ${mins % 60}m`;
              })();
              return (
                <div key={s._id} className="simple-session">
                  <div className="claude-avatar sm" style={{ background: isActive ? "var(--green)" : "var(--bg-3)", color: isActive ? "#000" : "var(--text-3)" }}>C</div>
                  <div className="ss-body">
                    <div className="ss-task">
                      {s.dev_id?.name || "Claude Agent"}
                      {isActive && <span style={{ fontSize: 9, marginLeft: 6, color: "var(--green)", fontWeight: 600 }}>EN VIVO</span>}
                    </div>
                    <div className="ss-meta">
                      <span className="ss-dot" style={{ background: isActive ? "var(--green)" : "var(--text-4)" }}></span>
                      <span>{isActive ? "activa" : "terminada"}</span>
                      <span>{"\u00B7"}</span>
                      <span>{duration}</span>
                      <span>{"\u00B7"}</span>
                      <span>{timeAgo(s.started_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: 11, color: "var(--text-4)" }}>Sin sesiones activas</div>
              <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 4 }}>
                Las sesiones se crean automaticamente al ejecutar <code style={{ fontSize: 10 }}>agentnorth sync</code>
              </div>
            </div>
          )}
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Actividad reciente</h2>
            <span className="meta">tiempo real via SSE</span>
          </div>
          <div className="simple-feed">
            {feedRows.length > 0 ? (
              feedRows.map((r, i) => (
                <FeedRowComponent key={r.id} row={r} isNew={i === 0 && !!r.fresh} />
              ))
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: 11, color: "var(--text-4)" }}>Sin actividad aun</div>
                <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 4 }}>
                  La actividad aparece cuando agentes usan el contexto del proyecto
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
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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
