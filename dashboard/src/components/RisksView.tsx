"use client";

import { useState } from "react";
import { RISKS } from "@/data/mock";

export function RisksView() {
  const r = RISKS;
  const [sev, setSev] = useState<"all" | "high" | "med" | "low">("all");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const allKinds = [...new Set(r.issues.map((i) => i.kind))];
  const filtered = r.issues.filter(
    (i) => (sev === "all" || i.sev === sev) && (kind === "all" || i.kind === kind)
  );

  return (
    <section className="risks-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Posibles cosas rotas</h2>
        <span className="meta">
          escaneado {r.lastScan} por{" "}
          <span style={{ color: "var(--accent)" }}>Claude</span> · skill{" "}
          <span className="mono">{r.skill}</span>
        </span>
      </div>

      <div className="risks-summary">
        <div className="rs-card high">
          <div className="rs-num">{r.bySeverity.high}</div>
          <div className="rs-label">alto · revisar ya</div>
        </div>
        <div className="rs-card med">
          <div className="rs-num">{r.bySeverity.med}</div>
          <div className="rs-label">medio · esta semana</div>
        </div>
        <div className="rs-card low">
          <div className="rs-num">{r.bySeverity.low}</div>
          <div className="rs-label">bajo · housekeeping</div>
        </div>
        <div className="rs-card total">
          <div className="rs-num">{r.totalIssues}</div>
          <div className="rs-label">issues totales</div>
        </div>
      </div>

      <div className="risks-toolbar">
        <div className="cov-filters">
          <button className={"cov-filter" + (sev === "all" ? " active" : "")} onClick={() => setSev("all")}>Todas</button>
          <button className={"cov-filter high" + (sev === "high" ? " active" : "")} onClick={() => setSev("high")}>Alto</button>
          <button className={"cov-filter med" + (sev === "med" ? " active" : "")} onClick={() => setSev("med")}>Medio</button>
          <button className={"cov-filter low" + (sev === "low" ? " active" : "")} onClick={() => setSev("low")}>Bajo</button>
        </div>
        <div className="cov-filters">
          <button className={"cov-filter sm" + (kind === "all" ? " active" : "")} onClick={() => setKind("all")}>Todos</button>
          {allKinds.map((k) => (
            <button key={k} className={"cov-filter sm" + (kind === k ? " active" : "")} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="risks-list">
        {filtered.map((issue) => (
          <RiskRow
            key={issue.id}
            issue={issue}
            isOpen={open === issue.id}
            onToggle={() => setOpen(open === issue.id ? null : issue.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="risks-empty">
            <span>&#x2713; Sin issues con estos filtros</span>
          </div>
        )}
      </div>
    </section>
  );
}

function RiskRow({
  issue,
  isOpen,
  onToggle,
}: {
  issue: (typeof RISKS.issues)[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={"risk-row" + (isOpen ? " open" : "")} onClick={onToggle}>
      <div className="risk-row-head">
        <span className={"risk-pill " + issue.sev}>
          {issue.sev === "high" ? "alto" : issue.sev === "med" ? "medio" : "bajo"}
        </span>
        <span className="risk-kind mono">{issue.kind}</span>
        <div className="risk-title">{issue.title}</div>
        <span className="risk-loc mono">
          {issue.file}
          {issue.line ? `:${issue.line}` : ""}
        </span>
        <span className="risk-caret">{isOpen ? "-" : "+"}</span>
      </div>
      {isOpen && (
        <div className="risk-row-body" onClick={(e) => e.stopPropagation()}>
          <div className="risk-detail">{issue.detail}</div>
          <div className="risk-suggest">
            <span className="risk-suggest-label">Sugerencia</span>
            <span className="risk-suggest-text">{issue.suggestion}</span>
          </div>
          <div className="risk-foot">
            <span className="risk-by mono">detectado por {issue.detectedBy}</span>
            {issue.decisions?.map((d) => (
              <span key={d} className="risk-dec">&#x1F4CC; {d}</span>
            ))}
            <div className="risk-actions">
              <button className="btn-simple sm">Asignar a Claude</button>
              <button className="btn-simple sm ghost">Ignorar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
