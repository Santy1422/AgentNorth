"use client";

import { useState, useMemo } from "react";
import type { DecisionData, ChangeData } from "@/app/page";

export function RisksView({
  decisions,
  changes,
  projectName,
  onRefresh,
}: {
  decisions: DecisionData[];
  changes: ChangeData[];
  projectName?: string;
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<"timeline" | "decisions" | "changes">("timeline");
  const [search, setSearch] = useState("");
  const [showNewDecision, setShowNewDecision] = useState(false);
  const [newDecision, setNewDecision] = useState({ module: "", title: "", context: "", decision: "" });
  const [saving, setSaving] = useState(false);
  const breakingChanges = changes.filter((c) => c.breaking);

  const filteredDecisions = useMemo(() => {
    if (!search.trim()) return decisions;
    const q = search.toLowerCase();
    return decisions.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.module?.toLowerCase().includes(q) ||
        d.decision?.toLowerCase().includes(q) ||
        d.author_name?.toLowerCase().includes(q)
    );
  }, [decisions, search]);

  const filteredChanges = useMemo(() => {
    if (!search.trim()) return changes;
    const q = search.toLowerCase();
    return changes.filter(
      (c) =>
        c.summary.toLowerCase().includes(q) ||
        c.module?.toLowerCase().includes(q) ||
        c.files_changed?.some((f) => f.toLowerCase().includes(q))
    );
  }, [changes, search]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="meta">
            {decisions.length} decisiones · {changes.length} cambios
            {breakingChanges.length > 0 && (
              <span style={{ color: "var(--accent)" }}> · {breakingChanges.length} breaking</span>
            )}
          </span>
          {projectName && (
            <button
              className="ndf-trigger"
              onClick={() => setShowNewDecision(!showNewDecision)}
            >
              + Nueva decision
            </button>
          )}
        </div>
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

      {/* New Decision Form */}
      {showNewDecision && (
        <div className="new-decision-form">
          <div className="ndf-head">
            <h3>Nueva decision</h3>
            <button className="btn-simple" onClick={() => setShowNewDecision(false)}>cancelar</button>
          </div>
          <input
            className="ndf-input"
            placeholder="Titulo de la decision"
            value={newDecision.title}
            onChange={(e) => setNewDecision({ ...newDecision, title: e.target.value })}
          />
          <input
            className="ndf-input"
            placeholder="Modulo (opcional)"
            value={newDecision.module}
            onChange={(e) => setNewDecision({ ...newDecision, module: e.target.value })}
          />
          <textarea
            className="ndf-textarea"
            placeholder="Contexto — por que se toma esta decision?"
            value={newDecision.context}
            onChange={(e) => setNewDecision({ ...newDecision, context: e.target.value })}
            rows={3}
          />
          <textarea
            className="ndf-textarea"
            placeholder="Decision — que se decidio?"
            value={newDecision.decision}
            onChange={(e) => setNewDecision({ ...newDecision, decision: e.target.value })}
            rows={3}
          />
          <button
            className="ndf-submit"
            disabled={saving || !newDecision.title.trim()}
            onClick={async () => {
              if (!newDecision.title.trim() || !projectName) return;
              setSaving(true);
              try {
                const res = await fetch("/api/dashboard", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    project: projectName,
                    ...newDecision,
                  }),
                });
                if (res.ok) {
                  setShowNewDecision(false);
                  setNewDecision({ module: "", title: "", context: "", decision: "" });
                  onRefresh?.();
                }
              } catch {}
              setSaving(false);
            }}
          >
            {saving ? "Guardando..." : "Crear decision"}
          </button>
        </div>
      )}

      <div className="risks-toolbar">
        <div className="cov-filters">
          <button
            className={"cov-filter" + (tab === "timeline" ? " active" : "")}
            onClick={() => setTab("timeline")}
          >
            Timeline
          </button>
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
        <div className="map-search" style={{ marginLeft: "auto" }}>
          <span className="search-icon">&#x2315;</span>
          <input
            type="text"
            placeholder="buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>
              x
            </button>
          )}
        </div>
      </div>

      {/* Activity heatmap */}
      {tab === "timeline" && <ActivityHeatmap decisions={decisions} changes={changes} />}

      {/* Timeline view */}
      {tab === "timeline" && (
        <div className="timeline-view">
          {(() => {
            // Merge decisions and changes into a single timeline
            const items: { type: "decision" | "change"; date: string; data: DecisionData | ChangeData }[] = [];
            for (const d of decisions) items.push({ type: "decision", date: d.created_at, data: d });
            for (const c of changes) items.push({ type: "change", date: c.created_at, data: c });
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (items.length === 0) {
              return <div className="risks-empty"><span>Sin actividad</span></div>;
            }

            return items.slice(0, 20).map((item, i) => {
              const isDecision = item.type === "decision";
              const d = isDecision ? (item.data as DecisionData) : null;
              const c = !isDecision ? (item.data as ChangeData) : null;
              return (
                <div key={`${item.type}-${i}`} className="tl-item">
                  <div className="tl-line">
                    <div className={"tl-dot " + (isDecision ? "decision" : c?.breaking ? "breaking" : "change")}></div>
                    {i < Math.min(items.length, 20) - 1 && <div className="tl-connector"></div>}
                  </div>
                  <div className="tl-content">
                    <div className="tl-header">
                      <span className={"tl-type " + item.type}>
                        {isDecision ? "decision" : c?.breaking ? "breaking" : "cambio"}
                      </span>
                      {(d?.module || c?.module) && (
                        <span className="tl-module mono">{d?.module || c?.module}</span>
                      )}
                      <span className="tl-date">{timeAgo(item.date)}</span>
                    </div>
                    <div className="tl-title">{d?.title || c?.summary}</div>
                    {d?.decision && <div className="tl-detail">{d.decision}</div>}
                    {c?.files_changed && c.files_changed.length > 0 && (
                      <div className="tl-files">
                        {c.files_changed.slice(0, 3).map((f) => (
                          <span key={f} className="tl-file mono">{f.split("/").pop()}</span>
                        ))}
                        {c.files_changed.length > 3 && (
                          <span className="tl-file muted">+{c.files_changed.length - 3}</span>
                        )}
                      </div>
                    )}
                    {d && (
                      <div className="tl-footer">
                        <span className={"tl-status " + d.status}>{d.status}</span>
                        <span className="tl-author">por {d.author_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      <div className="risks-list">
        {tab === "decisions" &&
          filteredDecisions.map((d) => <DecisionRow key={d._id} decision={d} />)}
        {tab === "changes" &&
          filteredChanges.map((c) => <ChangeRow key={c._id} change={c} />)}
        {tab === "decisions" && filteredDecisions.length === 0 && (
          <div className="risks-empty">
            <span>{search ? "Sin resultados" : "Sin decisiones"}</span>
          </div>
        )}
        {tab === "changes" && filteredChanges.length === 0 && (
          <div className="risks-empty">
            <span>{search ? "Sin resultados" : "Sin cambios"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function DecisionRow({ decision }: { decision: DecisionData }) {
  const [open, setOpen] = useState(false);
  const statusColor =
    decision.status === "active"
      ? "var(--green)"
      : decision.status === "deprecated"
        ? "var(--red)"
        : "var(--text-4)";

  return (
    <div className={"risk-row" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="risk-row-head">
        <span className="risk-pill med">decision</span>
        {decision.module && <span className="risk-kind mono">{decision.module}</span>}
        <div className="risk-title">{decision.title}</div>
        <span className="risk-status" style={{ color: statusColor }}>
          {decision.status}
        </span>
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
              <div key={f} className="mono" style={{ fontSize: 12, padding: "2px 0" }}>
                {f}
              </div>
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

function ActivityHeatmap({
  decisions,
  changes,
}: {
  decisions: DecisionData[];
  changes: ChangeData[];
}) {
  // Build 12-week heatmap
  const weeks = useMemo(() => {
    const now = new Date();
    const dayMs = 86400000;
    const dayCounts: Record<string, number> = {};

    for (const d of decisions) {
      const key = new Date(d.created_at).toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }
    for (const c of changes) {
      const key = new Date(c.created_at).toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }

    const weeks: { date: string; count: number }[][] = [];
    // Go back 12 weeks
    const startDay = new Date(now.getTime() - 84 * dayMs);
    // Align to Sunday
    startDay.setDate(startDay.getDate() - startDay.getDay());

    for (let w = 0; w < 12; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDay.getTime() + (w * 7 + d) * dayMs);
        const key = date.toISOString().slice(0, 10);
        week.push({ date: key, count: dayCounts[key] || 0 });
      }
      weeks.push(week);
    }
    return weeks;
  }, [decisions, changes]);

  const maxCount = Math.max(1, ...weeks.flat().map((d) => d.count));

  return (
    <div className="heatmap-card">
      <div className="heatmap-label">Actividad (12 semanas)</div>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap-col">
            {week.map((day) => (
              <div
                key={day.date}
                className="heatmap-cell"
                title={`${day.date}: ${day.count} eventos`}
                style={{
                  opacity: day.count === 0 ? 0.1 : 0.2 + (day.count / maxCount) * 0.8,
                  background: day.count === 0 ? "var(--bg-4)" : "var(--green)",
                }}
              ></div>
            ))}
          </div>
        ))}
      </div>
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
