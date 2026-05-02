"use client";

import { useState, useMemo } from "react";
import type { ModuleData, FileData } from "@/app/page";

function shortName(path: string): string {
  return path.split("/").pop() || path;
}

function extractApiPath(filePath: string): string {
  // Convert Next.js file path to API route path
  // dashboard/src/app/api/dashboard/route.ts → /api/dashboard
  // dashboard/src/app/api/v1/[[...route]]/route.ts → /api/v1/*
  const match = filePath.match(/\/app(\/api\/.+?)\/route\.(ts|tsx)$/);
  if (!match) return filePath;
  return match[1]
    .replace(/\[\[\.\.\.(\w+)\]\]/g, "*")
    .replace(/\[(\w+)\]/g, ":$1");
}

function extractMethods(file: FileData): string[] {
  const methods: string[] = [];
  const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  for (const exp of file.exports) {
    const upper = exp.toUpperCase();
    if (httpMethods.includes(upper)) methods.push(upper);
  }
  if (methods.length === 0) methods.push("GET"); // default
  return methods;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "#4ade80",
  POST: "#60a5fa",
  PUT: "#fbbf24",
  PATCH: "#f97316",
  DELETE: "#ef4444",
  HEAD: "#a78bfa",
  OPTIONS: "#71717a",
};

interface ApiRoute {
  file: FileData;
  path: string;
  methods: string[];
  imports: { source: string; specifiers: string[] }[];
  internalDeps: FileData[];
  externalDeps: string[];
}

export function ApisView({ modules }: { modules: ModuleData[] }) {
  const [selectedRoute, setSelectedRoute] = useState<ApiRoute | null>(null);
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allFiles = useMemo(() => {
    const seen = new Set<string>();
    return modules.flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [modules]);

  const routes = useMemo((): ApiRoute[] => {
    const routeFiles = allFiles.filter((f) => f.kind === "route");
    return routeFiles.map((f) => {
      const internalDeps = f.imports
        .map((imp) => {
          const name = imp.source.split("/").pop()?.replace(/\.(tsx?|jsx?)$/, "") || "";
          return allFiles.find(
            (other) =>
              other.path !== f.path &&
              (shortName(other.path).replace(/\.(tsx?|jsx?)$/, "") === name ||
                other.path.includes(imp.source.replace("@/", "")))
          );
        })
        .filter(Boolean) as FileData[];

      const externalDeps = f.imports
        .filter((imp) => !imp.source.startsWith(".") && !imp.source.startsWith("@/") && !imp.source.startsWith("~"))
        .map((imp) => imp.source);

      return {
        file: f,
        path: extractApiPath(f.path),
        methods: extractMethods(f),
        imports: f.imports,
        internalDeps,
        externalDeps,
      };
    }).sort((a, b) => a.path.localeCompare(b.path));
  }, [allFiles]);

  const allMethods = useMemo(() => {
    const methods = new Set<string>();
    for (const r of routes) r.methods.forEach((m) => methods.add(m));
    return [...methods].sort();
  }, [routes]);

  const filtered = useMemo(() => {
    let list = routes;
    if (filterMethod !== "all") {
      list = list.filter((r) => r.methods.includes(filterMethod));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.path.toLowerCase().includes(q));
    }
    return list;
  }, [routes, filterMethod, search]);

  if (routes.length === 0) {
    return (
      <section className="risks-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>API Catalog</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F310;</div>
          <div className="empty-title">Sin API routes detectadas</div>
          <div className="empty-desc">
            API routes are auto-detected from <code>route.ts</code> files in <code>app/api/</code>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="risks-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>API Catalog</h2>
        <span className="meta">
          {routes.length} endpoints · {allMethods.length} metodos · auto-detectado
        </span>
      </div>

      <div className="risks-summary">
        <div className="rs-card total">
          <div className="rs-num">{routes.length}</div>
          <div className="rs-label">endpoints</div>
        </div>
        {allMethods.map((m) => (
          <div key={m} className="rs-card" style={{ borderLeft: `3px solid ${METHOD_COLORS[m] || "#71717a"}` }}>
            <div className="rs-num" style={{ color: METHOD_COLORS[m] }}>
              {routes.filter((r) => r.methods.includes(m)).length}
            </div>
            <div className="rs-label">{m}</div>
          </div>
        ))}
      </div>

      <div className="risks-toolbar">
        <div className="cov-filters">
          <button
            className={"cov-filter" + (filterMethod === "all" ? " active" : "")}
            onClick={() => setFilterMethod("all")}
          >
            Todos ({routes.length})
          </button>
          {allMethods.map((m) => (
            <button
              key={m}
              className={"cov-filter" + (filterMethod === m ? " active" : "")}
              onClick={() => setFilterMethod(m)}
              style={{ borderColor: filterMethod === m ? METHOD_COLORS[m] : undefined }}
            >
              {m} ({routes.filter((r) => r.methods.includes(m)).length})
            </button>
          ))}
        </div>
        <div className="map-search" style={{ marginLeft: "auto" }}>
          <span className="search-icon">&#x2315;</span>
          <input
            type="text"
            placeholder="search endpoint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch("")}>x</button>}
        </div>
      </div>

      <div className="api-list">
        {filtered.map((route) => (
          <button
            key={route.file.path}
            className={"api-row" + (selectedRoute?.file.path === route.file.path ? " selected" : "")}
            onClick={() =>
              setSelectedRoute(selectedRoute?.file.path === route.file.path ? null : route)
            }
          >
            <div className="api-row-main">
              <div className="api-methods">
                {route.methods.map((m) => (
                  <span key={m} className="api-method" style={{ background: METHOD_COLORS[m] }}>
                    {m}
                  </span>
                ))}
              </div>
              <span className="api-path mono">{route.path}</span>
              <span className="api-loc">{route.file.loc} LOC</span>
            </div>

            {selectedRoute?.file.path === route.file.path && (
              <div className="api-detail" onClick={(e) => e.stopPropagation()}>
                <div className="api-detail-section">
                  <div className="api-detail-label">Archivo</div>
                  <div className="api-detail-value mono">{route.file.path}</div>
                </div>

                {route.file.exports.length > 0 && (
                  <div className="api-detail-section">
                    <div className="api-detail-label">Exports</div>
                    <div className="fd-chips">
                      {route.file.exports.map((e) => (
                        <span key={e} className="fd-chip mono">{e}</span>
                      ))}
                    </div>
                  </div>
                )}

                {route.internalDeps.length > 0 && (
                  <div className="api-detail-section">
                    <div className="api-detail-label">
                      Dependencias internas ({route.internalDeps.length})
                    </div>
                    <div className="api-dep-list">
                      {route.internalDeps.map((dep) => (
                        <div key={dep.path} className="api-dep-item">
                          <span className="cov-file-kind" style={{
                            background: dep.kind === "model" ? "#60a5fa" :
                              dep.kind === "lib" ? "#fbbf24" : "#71717a"
                          }}>
                            {dep.kind}
                          </span>
                          <span className="mono">{shortName(dep.path)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {route.externalDeps.length > 0 && (
                  <div className="api-detail-section">
                    <div className="api-detail-label">Paquetes externos</div>
                    <div className="fd-chips">
                      {route.externalDeps.map((d) => (
                        <span key={d} className="fd-chip ext mono">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Who calls this API */}
                {(() => {
                  const apiName = shortName(route.file.path).replace(/\.(tsx?|jsx?)$/, "");
                  const callers = allFiles.filter(
                    (f) =>
                      f.path !== route.file.path &&
                      f.kind !== "route" &&
                      f.imports?.some(
                        (imp) =>
                          imp.source.endsWith(apiName) ||
                          imp.source.endsWith("/" + apiName) ||
                          imp.source.includes(route.path.replace("/api/", "api/"))
                      )
                  );
                  if (callers.length === 0) return null;
                  return (
                    <div className="api-detail-section">
                      <div className="api-detail-label">Usado por ({callers.length})</div>
                      <div className="api-dep-list">
                        {callers.map((c) => (
                          <div key={c.path} className="api-dep-item">
                            <span className="cov-file-kind" style={{
                              background: c.kind === "page" ? "#f97316" :
                                c.kind === "component" ? "#a78bfa" : "#71717a"
                            }}>
                              {c.kind}
                            </span>
                            <span className="mono">{shortName(c.path)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {route.file.summary && (
                  <div className="api-detail-section">
                    <div className="api-detail-label">Resumen</div>
                    <div className="api-detail-value">{route.file.summary}</div>
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="risks-empty"><span>Sin resultados</span></div>
        )}
      </div>
    </section>
  );
}
