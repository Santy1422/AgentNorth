"use client";

import { personById, type FeedRow, type Session } from "@/data/mock";
import { Avatar, ClaudeAvatar } from "./Avatar";

export function MainView({
  feedRows,
  savedTokens,
  sessions,
  isLive,
}: {
  feedRows: FeedRow[];
  savedTokens: number;
  sessions: Session[];
  isLive?: boolean;
}) {
  const dollars = (savedTokens / 100000).toFixed(2);

  return (
    <>
      <section className="hero">
        <div className="hero-label">
          {isLive ? "Tokens ahorrados con AgentNorth" : "Tokens ahorrados hoy con AgentNorth"}
        </div>
        <div className="hero-num">{savedTokens.toLocaleString("es")}</div>
        <div className="hero-sub">
          ≈ <span className="hero-money">${dollars}</span> en API
          {!isLive && " · 92% menos exploracion por sesion"}
        </div>
        <div className="hero-bar">
          <div className="hero-bar-track">
            <div className="hero-bar-fill" style={{ width: "78%" }}></div>
          </div>
          <div className="hero-bar-labels">
            <span>Sin AgentNorth</span>
            <span>Con AgentNorth</span>
          </div>
        </div>
      </section>

      <section className="two-col">
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Sesiones de agentes</h2>
            <span className="meta">{isLive ? "en vivo" : "demo"}</span>
          </div>
          {sessions.slice(0, 4).map((s) => (
            <SessionRow key={s.id} s={s} isLive={isLive} />
          ))}
          {sessions.length === 0 && (
            <div className="empty-state">Sin sesiones aun</div>
          )}
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Que esta pasando</h2>
            <span className="meta">{isLive ? "en vivo" : "demo"}</span>
          </div>
          <div className="simple-feed">
            {feedRows.map((r, i) => (
              <FeedRowComponent
                key={r.id}
                row={r}
                isNew={i === 0 && !!r.fresh}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SessionRow({ s, isLive }: { s: Session; isLive?: boolean }) {
  const p = personById(s.who);
  const dotColor =
    s.status === "live"
      ? "var(--green)"
      : s.status === "idle"
        ? "var(--yellow)"
        : "var(--text-4)";

  return (
    <div className="simple-session">
      {p ? <Avatar p={p} /> : <ClaudeAvatar />}
      <div className="ss-body">
        <div className="ss-task">{s.task}</div>
        <div className="ss-meta">
          <span className="ss-dot" style={{ background: dotColor }}></span>
          <span>{p?.name || s.who}</span>
          {s.bundle && (
            <>
              <span>·</span>
              <span className="mono">{s.bundle}</span>
            </>
          )}
          {s.saved > 0 && (
            <>
              <span>·</span>
              <span style={{ color: "var(--accent)" }}>
                -{(s.saved / 1000).toFixed(1)}k tokens
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedRowComponent({ row, isNew }: { row: FeedRow; isNew: boolean }) {
  const p = row.who === "claude" ? undefined : personById(row.who);
  const isClaude = row.who === "claude";
  const tag = row.badges?.find((b) => b.t.includes("token"));

  return (
    <div className={"simple-feed-row" + (isNew ? " new" : "")}>
      {isClaude ? <ClaudeAvatar size="sm" /> : <Avatar p={p} size="sm" />}
      <div className="sfr-body">
        <span className="sfr-who">{isClaude ? "Claude" : p?.name || row.who}</span>
        <span className="sfr-verb"> {row.verb} </span>
        <span className="sfr-obj">{row.obj}</span>
      </div>
      {tag && <span className="sfr-tag">{tag.t}</span>}
      <span className="sfr-time">{row.ago}</span>
    </div>
  );
}
