"use client";

import { useState, useMemo } from "react";
import type { DepData } from "@/app/page";

export function DepsView({ deps }: { deps: DepData[] }) {
  const [filter, setFilter] = useState<"all" | "prod" | "dev">("all");
  const [search, setSearch] = useState("");

  const prodDeps = useMemo(() => deps.filter((d) => d.kind === "prod"), [deps]);
  const devDeps = useMemo(() => deps.filter((d) => d.kind === "dev"), [deps]);

  const filtered = useMemo(() => {
    let list = deps;
    if (filter === "prod") list = prodDeps;
    if (filter === "dev") list = devDeps;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [deps, prodDeps, devDeps, filter, search]);

  const sources = useMemo(() => [...new Set(deps.map((d) => d.source))], [deps]);

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
          {deps.length} paquetes · {sources.length} package.json · auto-scan en cada sync
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
        <div className="rs-card high">
          <div className="rs-num">{sources.length}</div>
          <div className="rs-label">package.json</div>
        </div>
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
        </div>
        <div className="map-search" style={{ marginLeft: "auto" }}>
          <span className="search-icon">&#x2315;</span>
          <input
            type="text"
            placeholder="buscar paquete..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>x</button>
          )}
        </div>
      </div>

      <div className="deps-list">
        <div className="deps-header">
          <span className="deps-col-name">Paquete</span>
          <span className="deps-col-ver">Version</span>
          <span className="deps-col-kind">Tipo</span>
          <span className="deps-col-src">Origen</span>
        </div>
        {filtered.map((d) => (
          <div key={`${d.name}-${d.kind}-${d.source}`} className="deps-row">
            <span className="deps-col-name mono">{d.name}</span>
            <span className="deps-col-ver mono">{d.version}</span>
            <span className="deps-col-kind">
              <span className={"dep-pill " + d.kind}>{d.kind}</span>
            </span>
            <span className="deps-col-src mono">{d.source}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="risks-empty"><span>Sin resultados</span></div>
        )}
      </div>
    </section>
  );
}
