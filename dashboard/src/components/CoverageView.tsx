"use client";

import type { ModuleData } from "@/app/page";

export function CoverageView({ modules }: { modules: ModuleData[] }) {
  if (modules.length === 0) {
    return (
      <section className="cov-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Cobertura del codebase</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4CA;</div>
          <div className="empty-title">Sin datos de cobertura</div>
          <div className="empty-desc">
            Ejecuta <code>npx agentnorth index</code> para indexar tu codebase
          </div>
        </div>
      </section>
    );
  }

  const totalLoc = modules.reduce((s, m) => s + (m.loc || 0), 0);
  const totalFiles = modules.reduce((s, m) => s + (m.files_count || 0), 0);
  const totalExports = modules.reduce((s, m) => s + (m.exports_count || 0), 0);

  return (
    <section className="cov-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Cobertura del codebase</h2>
        <span className="meta">{modules.length} modulos indexados</span>
      </div>

      <div className="cov-hero">
        <div className="cov-hero-info" style={{ display: "flex", gap: 32 }}>
          <div className="cov-hero-row">
            <div className="cov-num">{totalFiles.toLocaleString("es")}</div>
            <div className="cov-label">archivos totales</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num">{totalLoc.toLocaleString("es")}</div>
            <div className="cov-label">lineas de codigo</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num">{totalExports.toLocaleString("es")}</div>
            <div className="cov-label">exports</div>
          </div>
        </div>
      </div>

      <div className="card-simple" style={{ marginTop: 24 }}>
        <div className="card-simple-head">
          <h2>Por modulo</h2>
          <span className="meta">{modules.length} modulos</span>
        </div>
        <div className="cov-modules">
          {modules.map((m) => {
            const pct = totalLoc > 0 ? Math.round((m.loc / totalLoc) * 100) : 0;
            return (
              <div key={m.name} className="cov-mod-row">
                <div className="cov-mod-name mono">{m.name}</div>
                <div className="cov-mod-bar">
                  <div
                    className="cov-mod-fill"
                    style={{
                      width: pct + "%",
                      background: "var(--accent)",
                    }}
                  ></div>
                </div>
                <div className="cov-mod-pct">
                  <b>{pct}%</b>
                </div>
                <div className="cov-mod-files">
                  {(m.files_count || 0)} files · {(m.loc || 0).toLocaleString("es")} LOC
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
