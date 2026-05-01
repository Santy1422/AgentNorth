"use client";

import { useMemo } from "react";
import type { FeedRow, DashboardData, FileData } from "@/app/page";

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
                <div key={m.name} className="ov-mod">
                  <span className="ov-mod-name mono">{m.name}</span>
                  {m.description && <span className="ov-mod-desc">{m.description}</span>}
                  <span className="ov-mod-stats">{m.files_count} files · {(m.loc || 0).toLocaleString("es")} LOC</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="two-col">
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Sesiones de agentes</h2>
            <span className="meta">en vivo</span>
          </div>
          {data?.sessions && data.sessions.length > 0 ? (
            data.sessions.slice(0, 6).map((s) => (
              <div key={s._id} className="simple-session">
                <div className="claude-avatar sm">C</div>
                <div className="ss-body">
                  <div className="ss-task">{s.dev_id?.name || "Agent"}</div>
                  <div className="ss-meta">
                    <span className="ss-dot" style={{ background: s.ended_at ? "var(--text-4)" : "var(--green)" }}></span>
                    <span>{s.ended_at ? "terminada" : "activa"}</span>
                    <span>{"\u00B7"}</span>
                    <span>{timeAgo(s.started_at)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">Sin sesiones aun</div>
          )}
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Actividad reciente</h2>
            <span className="meta">auto-refresh 30s</span>
          </div>
          <div className="simple-feed">
            {feedRows.length > 0 ? (
              feedRows.map((r, i) => (
                <FeedRowComponent key={r.id} row={r} isNew={i === 0 && !!r.fresh} />
              ))
            ) : (
              <div className="empty-state">Sin actividad aun</div>
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
