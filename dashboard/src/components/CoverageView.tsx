"use client";

import { useState } from "react";
import { COVERAGE } from "@/data/mock";

export function CoverageView() {
  const cov = COVERAGE;
  const [filter, setFilter] = useState<"all" | "high" | "med" | "low">("all");
  const filteredGaps = filter === "all" ? cov.gaps : cov.gaps.filter((g) => g.risk === filter);

  return (
    <section className="cov-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Cobertura de tests</h2>
        <span className="meta">
          target {cov.overall.target}% · scan continuo · ultima corrida hace 4 min
        </span>
      </div>

      <div className="cov-hero">
        <div className="cov-ring-wrap">
          <CoverageRing pct={cov.overall.pct} target={cov.overall.target} />
        </div>
        <div className="cov-hero-info">
          <div className="cov-hero-row">
            <div className="cov-num">{cov.overall.tested}</div>
            <div className="cov-label">archivos con tests</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num warn">{cov.overall.missing}</div>
            <div className="cov-label">archivos sin tests</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num accent">{cov.overall.untestedCritical}</div>
            <div className="cov-label">criticos sin tests</div>
          </div>
          <div className="cov-trend">
            <span className="trend-up">&#x2191;</span> {cov.overall.trend}
          </div>
        </div>
      </div>

      <div className="cov-grid">
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Por modulo</h2>
            <span className="meta">{cov.byModule.length} modulos</span>
          </div>
          <div className="cov-modules">
            {cov.byModule.map((m) => (
              <div key={m.id} className="cov-mod-row">
                <div className="cov-mod-name mono">
                  {m.id}
                  {m.hot && <span className="cov-hot">&#x25CF;</span>}
                </div>
                <div className="cov-mod-bar">
                  <div
                    className="cov-mod-fill"
                    style={{
                      width: m.pct + "%",
                      background: m.pct >= 85 ? "var(--green)" : m.pct >= 70 ? "var(--accent)" : "#e87b6b",
                    }}
                  ></div>
                </div>
                <div className="cov-mod-pct">
                  <b>{m.pct}%</b>
                  <span className={"cov-mod-trend " + (m.trend.startsWith("+") ? "up" : m.trend.startsWith("-") ? "down" : "")}>
                    {m.trend}
                  </span>
                </div>
                <div className="cov-mod-files">{m.tested}/{m.files}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Gaps detectados</h2>
            <div className="cov-filters">
              <button className={"cov-filter" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>Todos</button>
              <button className={"cov-filter high" + (filter === "high" ? " active" : "")} onClick={() => setFilter("high")}>
                Alto · {cov.gaps.filter((g) => g.risk === "high").length}
              </button>
              <button className={"cov-filter med" + (filter === "med" ? " active" : "")} onClick={() => setFilter("med")}>
                Medio · {cov.gaps.filter((g) => g.risk === "med").length}
              </button>
              <button className={"cov-filter low" + (filter === "low" ? " active" : "")} onClick={() => setFilter("low")}>
                Bajo · {cov.gaps.filter((g) => g.risk === "low").length}
              </button>
            </div>
          </div>
          <div className="cov-gaps">
            {filteredGaps.map((g) => (
              <div key={g.fileId} className="cov-gap-row">
                <span className={"risk-pill " + g.risk}>
                  {g.risk === "high" ? "alto" : g.risk === "med" ? "medio" : "bajo"}
                </span>
                <div className="cov-gap-body">
                  <div className="cov-gap-file mono">{g.fileId}</div>
                  <div className="cov-gap-reason">{g.reason}</div>
                </div>
                <button className="btn-simple sm">Generar tests</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CoverageRing({ pct, target }: { pct: number; target: number }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const targetOffset = c - (target / 100) * c;
  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="10" />
      <circle cx="80" cy="80" r={r} fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="10"
        strokeDasharray={c}
        strokeDashoffset={targetOffset}
        transform="rotate(-90 80 80)" />
      <circle cx="80" cy="80" r={r} fill="none"
        stroke="var(--accent)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 80 80)" />
      <text x="80" y="78" textAnchor="middle" fontSize="34" fontWeight="500" fill="var(--text)">
        {pct}%
      </text>
      <text x="80" y="98" textAnchor="middle" fontSize="11" fill="var(--text-3)">
        target {target}%
      </text>
    </svg>
  );
}
