"use client";

import { useState } from "react";
import type { DecisionData, ChangeData } from "@/app/page";

export function RisksView({
  decisions,
  changes,
}: {
  decisions: DecisionData[];
  changes: ChangeData[];
}) {
  const [tab, setTab] = useState<"decisions" | "changes">("decisions");
  const breakingChanges = changes.filter((c) => c.breaking);

  if (decisions.length === 0 && changes.length === 0) {
    return (
      <section className="risks-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Decisiones y cambios</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4CC;</div>
          <div className="empty-title">Sin decisiones ni cambios</div>
          <div className="empty-desc">
            Sincroniza decisiones con <code>npx agentnorth sync</code>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="risks-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Decisiones y cambios</h2>
        <span className="meta">
          {decisions.length} decisiones · {changes.length} cambios
          {breakingChanges.length > 0 && (
            <span style={{ color: "var(--accent)" }}> · {breakingChanges.length} breaking</span>
          )}
        </span>
      </div>

      <div className="risks-summary">
        <div className="rs-card total">
          <div className="rs-num">{decisions.length}</div>
          <div className="rs-label">decisiones</div>
        </div>
        <div className="rs-card med">
          <div className="rs-num">{changes.length}</div>
          <div className="rs-label">cambios</div>
        </div>
        {breakingChanges.length > 0 && (
          <div className="rs-card high">
            <div className="rs-num">{breakingChanges.length}</div>
            <div className="rs-label">breaking changes</div>
          </div>
        )}
      </div>

      <div className="risks-toolbar">
        <div className="cov-filters">
          <button
            className={"cov-filter" + (tab === "decisions" ? " active" : "")}
            onClick={() => setTab("decisions")}
          >
            Decisiones ({decisions.length})
          </button>
          <button
            className={"cov-filter" + (tab === "changes" ? " active" : "")}
            onClick={() => setTab("changes")}
          >
            Cambios ({changes.length})
          </button>
        </div>
      </div>

      <div className="risks-list">
        {tab === "decisions" && decisions.map((d) => (
          <DecisionRow key={d._id} decision={d} />
        ))}
        {tab === "changes" && changes.map((c) => (
          <ChangeRow key={c._id} change={c} />
        ))}
        {tab === "decisions" && decisions.length === 0 && (
          <div className="risks-empty"><span>Sin decisiones</span></div>
        )}
        {tab === "changes" && changes.length === 0 && (
          <div className="risks-empty"><span>Sin cambios</span></div>
        )}
      </div>
    </section>
  );
}

function DecisionRow({ decision }: { decision: DecisionData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={"risk-row" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="risk-row-head">
        <span className="risk-pill med">decision</span>
        {decision.module && <span className="risk-kind mono">{decision.module}</span>}
        <div className="risk-title">{decision.title}</div>
        <span className="risk-loc mono">{decision.status}</span>
        <span className="risk-caret">{open ? "-" : "+"}</span>
      </div>
      {open && (
        <div className="risk-row-body" onClick={(e) => e.stopPropagation()}>
          {decision.decision && <div className="risk-detail">{decision.decision}</div>}
          {decision.context && (
            <div className="risk-suggest">
              <span className="risk-suggest-label">Contexto</span>
              <span className="risk-suggest-text">{decision.context}</span>
            </div>
          )}
          <div className="risk-foot">
            <span className="risk-by mono">por {decision.author_name}</span>
            <span className="risk-by mono">· {timeAgo(decision.created_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeRow({ change }: { change: ChangeData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={"risk-row" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="risk-row-head">
        <span className={"risk-pill " + (change.breaking ? "high" : "low")}>
          {change.breaking ? "breaking" : "cambio"}
        </span>
        {change.module && <span className="risk-kind mono">{change.module}</span>}
        <div className="risk-title">{change.summary}</div>
        <span className="risk-loc mono">{change.files_changed?.length || 0} archivos</span>
        <span className="risk-caret">{open ? "-" : "+"}</span>
      </div>
      {open && change.files_changed && change.files_changed.length > 0 && (
        <div className="risk-row-body" onClick={(e) => e.stopPropagation()}>
          <div className="risk-detail">
            {change.files_changed.map((f) => (
              <div key={f} className="mono" style={{ fontSize: 12, padding: "2px 0" }}>{f}</div>
            ))}
          </div>
          <div className="risk-foot">
            <span className="risk-by mono">{timeAgo(change.created_at)}</span>
          </div>
        </div>
      )}
    </div>
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
