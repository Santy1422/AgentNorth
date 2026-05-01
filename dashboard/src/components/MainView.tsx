"use client";

import type { FeedRow, DashboardData } from "@/app/page";

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

  return (
    <>
      <section className="hero">
        <div className="hero-label">Tokens ahorrados con AgentNorth</div>
        <div className="hero-num">{savedTokens.toLocaleString("es")}</div>
        <div className="hero-sub">
          ≈ <span className="hero-money">${dollars}</span> en API
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
                    <span>·</span>
                    <span>{timeAgo(s.started_at)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">Sin sesiones aun · ejecuta <code>npx agentnorth sync</code></div>
          )}
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Actividad reciente</h2>
            <span className="meta">en vivo · auto-refresh 30s</span>
          </div>
          <div className="simple-feed">
            {feedRows.length > 0 ? (
              feedRows.map((r, i) => (
                <FeedRowComponent key={r.id} row={r} isNew={i === 0 && !!r.fresh} />
              ))
            ) : (
              <div className="empty-state">Sin actividad aun · sincroniza decisiones y cambios</div>
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
