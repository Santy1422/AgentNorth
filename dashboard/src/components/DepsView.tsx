"use client";

import { useState, useMemo } from "react";
import type { DepData, AuditVuln } from "@/app/page";

export function DepsView({ deps, audit }: { deps: DepData[]; audit: AuditVuln[] }) {
  const [filter, setFilter] = useState<"all" | "prod" | "dev" | "vuln">("all");
  const [search, setSearch] = useState("");
  const [showLicenseView, setShowLicenseView] = useState(false);

  const vulnMap = useMemo(() => {
    const map = new Map<string, AuditVuln>();
    for (const v of audit) map.set(v.name, v);
    return map;
  }, [audit]);

  const prodDeps = useMemo(() => deps.filter((d) => d.kind === "prod"), [deps]);
  const devDeps = useMemo(() => deps.filter((d) => d.kind === "dev"), [deps]);
  const vulnDeps = useMemo(() => deps.filter((d) => vulnMap.has(d.name)), [deps, vulnMap]);

  const filtered = useMemo(() => {
    let list = deps;
    if (filter === "prod") list = prodDeps;
    if (filter === "dev") list = devDeps;
    if (filter === "vuln") list = vulnDeps;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      // Vulnerable first
      const aVuln = vulnMap.has(a.name) ? 0 : 1;
      const bVuln = vulnMap.has(b.name) ? 0 : 1;
      if (aVuln !== bVuln) return aVuln - bVuln;
      return a.name.localeCompare(b.name);
    });
  }, [deps, prodDeps, devDeps, vulnDeps, filter, search, vulnMap]);

  const sources = useMemo(() => [...new Set(deps.map((d) => d.source))], [deps]);
  const criticalCount = audit.filter((v) => v.severity === "critical").length;
  const highCount = audit.filter((v) => v.severity === "high").length;

  if (deps.length === 0) {
    return (
      <section className="risks-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Dependencias</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4E6;</div>
          <div className="empty-title">Sin dependencias escaneadas</div>
          <div className="empty-desc">
            Ejecuta <code>npx agentnorth sync</code> para escanear los package.json del proyecto
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="risks-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Dependencias</h2>
        <span className="meta">
          {deps.length} paquetes · {sources.length} package.json · npm audit integrado
        </span>
      </div>

      <div className="risks-summary">
        <div className="rs-card total">
          <div className="rs-num">{deps.length}</div>
          <div className="rs-label">total</div>
        </div>
        <div className="rs-card med">
          <div className="rs-num">{prodDeps.length}</div>
          <div className="rs-label">produccion</div>
        </div>
        <div className="rs-card low">
          <div className="rs-num">{devDeps.length}</div>
          <div className="rs-label">desarrollo</div>
        </div>
        {audit.length > 0 ? (
          <div className="rs-card high">
            <div className="rs-num">{audit.length}</div>
            <div className="rs-label">
              vulnerabilidades
              {criticalCount > 0 && <span> · {criticalCount} criticas</span>}
              {highCount > 0 && <span> · {highCount} altas</span>}
            </div>
          </div>
        ) : (
          <div className="rs-card" style={{ borderLeft: "3px solid var(--green)" }}>
            <div className="rs-num" style={{ color: "var(--green)" }}>0</div>
            <div className="rs-label">vulnerabilidades</div>
          </div>
        )}
      </div>

      <div className="risks-toolbar">
        <div className="cov-filters">
          <button className={"cov-filter" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>
            Todas ({deps.length})
          </button>
          <button className={"cov-filter" + (filter === "prod" ? " active" : "")} onClick={() => setFilter("prod")}>
            Prod ({prodDeps.length})
          </button>
          <button className={"cov-filter" + (filter === "dev" ? " active" : "")} onClick={() => setFilter("dev")}>
            Dev ({devDeps.length})
          </button>
          {audit.length > 0 && (
            <button className={"cov-filter high" + (filter === "vuln" ? " active" : "")} onClick={() => setFilter("vuln")}>
              Vulnerables ({vulnDeps.length})
            </button>
          )}
        </div>
        <div className="map-search" style={{ marginLeft: "auto" }}>
          <span className="search-icon">&#x2315;</span>
          <input type="text" placeholder="search package..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch("")}>x</button>}
        </div>
      </div>

      {/* Dep distribution by source */}
      {sources.length > 1 && (
        <div className="deps-source-bar" style={{ marginBottom: 12 }}>
          <div className="card-simple-head" style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: 13 }}>Por package.json</h2>
          </div>
          {sources.map((src) => {
            const count = deps.filter((d) => d.source === src).length;
            const pct = (count / deps.length) * 100;
            return (
              <div key={src} className="deps-source-row">
                <span className="deps-source-name mono">{src}</span>
                <div className="deps-source-bar-wrap">
                  <div className="deps-source-fill" style={{ width: pct + "%" }}></div>
                </div>
                <span className="deps-source-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="deps-list">
        <div className="deps-header">
          <span className="deps-col-name">Paquete</span>
          <span className="deps-col-ver">Version</span>
          <span className="deps-col-kind">Tipo</span>
          <span className="deps-col-status">Estado</span>
          <span className="deps-col-src">Origen</span>
        </div>
        {filtered.map((d) => {
          const vuln = vulnMap.get(d.name);
          return (
            <div key={`${d.name}-${d.kind}-${d.source}`} className={"deps-row" + (vuln ? " vuln" : "")}>
              <span className="deps-col-name mono">{d.name}</span>
              <span className="deps-col-ver mono">{d.version}</span>
              <span className="deps-col-kind">
                <span className={"dep-pill " + d.kind}>{d.kind}</span>
              </span>
              <span className="deps-col-status">
                {vuln ? (
                  <span className={"dep-vuln-pill " + vuln.severity} title={vuln.title}>
                    {vuln.severity}
                  </span>
                ) : (
                  <span className="dep-safe-pill">ok</span>
                )}
              </span>
              <span className="deps-col-src mono">{d.source}</span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="risks-empty"><span>Sin resultados</span></div>
        )}
      </div>
    </section>
  );
}
