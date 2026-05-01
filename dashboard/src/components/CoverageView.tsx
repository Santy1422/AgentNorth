"use client";

import { useMemo } from "react";
import type { ModuleData } from "@/app/page";

export function CoverageView({ modules }: { modules: ModuleData[] }) {
  const stats = useMemo(() => {
    const totalLoc = modules.reduce((s, m) => s + (m.loc || 0), 0);
    const totalFiles = modules.reduce((s, m) => s + (m.files_count || 0), 0);
    const totalExports = modules.reduce((s, m) => s + (m.exports_count || 0), 0);
    return { totalLoc, totalFiles, totalExports };
  }, [modules]);

  if (modules.length === 0) {
    return (
      <section className="cov-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Cobertura y salud del codebase</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4CA;</div>
          <div className="empty-title">Sin datos de cobertura</div>
          <div className="empty-desc">
            Ejecuta <code>npx agentnorth index</code> y luego <code>npx agentnorth sync</code>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cov-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Cobertura y salud del codebase</h2>
        <span className="meta">{modules.length} modulos indexados · auto-sync</span>
      </div>

      <div className="cov-hero">
        <div className="cov-hero-info" style={{ display: "flex", gap: 32 }}>
          <div className="cov-hero-row">
            <div className="cov-num">{stats.totalFiles.toLocaleString("es")}</div>
            <div className="cov-label">archivos totales</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num">{stats.totalLoc.toLocaleString("es")}</div>
            <div className="cov-label">lineas de codigo</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num">{stats.totalExports.toLocaleString("es")}</div>
            <div className="cov-label">exports</div>
          </div>
        </div>
      </div>

      <div className="cov-grid">
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Distribucion por modulo</h2>
            <span className="meta">{modules.length} modulos</span>
          </div>
          <div className="cov-modules">
            {modules.map((m) => {
              const pct = stats.totalLoc > 0 ? Math.round((m.loc / stats.totalLoc) * 100) : 0;
              return (
                <div key={m.name} className="cov-mod-row">
                  <div className="cov-mod-name mono">{m.name}</div>
                  <div className="cov-mod-bar">
                    <div
                      className="cov-mod-fill"
                      style={{ width: pct + "%", background: "var(--accent)" }}
                    ></div>
                  </div>
                  <div className="cov-mod-pct"><b>{pct}%</b></div>
                  <div className="cov-mod-files">
                    {(m.files_count || 0)} files · {(m.loc || 0).toLocaleString("es")} LOC
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Test coverage</h2>
            <span className="meta">proximamente · en desarrollo</span>
          </div>
          <div className="cov-todo">
            <div className="cov-todo-item">
              <span className="cov-todo-check">&#x2610;</span>
              <div>
                <div className="cov-todo-title">Integrar con Vitest coverage</div>
                <div className="cov-todo-desc">
                  <code>npx agentnorth index --coverage</code> leera coverage/coverage-summary.json
                  y mostrara % de cobertura por modulo
                </div>
              </div>
            </div>
            <div className="cov-todo-item">
              <span className="cov-todo-check">&#x2610;</span>
              <div>
                <div className="cov-todo-title">Detectar archivos muertos</div>
                <div className="cov-todo-desc">
                  Archivos sin imports ni exports usados. Se mostraran aca con sugerencia de borrar.
                </div>
              </div>
            </div>
            <div className="cov-todo-item">
              <span className="cov-todo-check">&#x2610;</span>
              <div>
                <div className="cov-todo-title">Gaps criticos</div>
                <div className="cov-todo-desc">
                  Archivos que manejan dinero, auth o datos sensibles sin tests.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
