"use client";

import { useState, useMemo } from "react";
import type { ModuleData, FileData } from "@/app/page";
import { useT } from "@/i18n/provider";

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
  middleware: string[];
  hasAuth: boolean;
  hasValidation: boolean;
  hasRateLimit: boolean;
}

export function ApisView({ modules }: { modules: ModuleData[] }) {
  const { t } = useT();
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

      // Detect middleware patterns from imports
      const allImportSpecs = f.imports.flatMap((imp) => imp.specifiers);
      const allImportSources = f.imports.map((imp) => imp.source);

      const middlewarePatterns = [
        { pattern: /auth|session|getServerSession|getToken/, name: "auth" },
        { pattern: /zod|validate|schema|parse/, name: "validation" },
        { pattern: /rateLimit|rate.limit|throttle/, name: "rate-limit" },
        { pattern: /cors/, name: "cors" },
        { pattern: /cache|revalidate/, name: "cache" },
        { pattern: /log|logger|analytics/, name: "logging" },
      ];

      const middleware: string[] = [];
      const combinedText = [...allImportSpecs, ...allImportSources].join(" ");
      for (const { pattern, name } of middlewarePatterns) {
        if (pattern.test(combinedText)) middleware.push(name);
      }

      const hasAuth = middleware.includes("auth");
      const hasValidation = middleware.includes("validation");
      const hasRateLimit = middleware.includes("rate-limit");

      return {
        file: f,
        path: extractApiPath(f.path),
        methods: extractMethods(f),
        imports: f.imports,
        internalDeps,
        externalDeps,
        middleware,
        hasAuth,
        hasValidation,
        hasRateLimit,
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

  
  // Group routes by prefix for visual organization
  const routeGroups = useMemo(() => {
    const groups: Record<string, ApiRoute[]> = {};
    for (const r of filtered) {
      const parts = r.path.split("/").filter(Boolean);
      const prefix = "/" + parts.slice(0, 2).join("/");
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(r);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (routes.length === 0) {
    return (
      <section className="risks-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>{t("apis.title")}</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F310;</div>
          <div className="empty-title">{t("apis.noData")}</div>
          <div className="empty-desc">
            {t("apis.noDataDesc")}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="risks-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>{t("apis.title")}</h2>
        <span className="meta">
          {t("apis.subtitle", { n: routes.length, methods: allMethods.length })}
        </span>
      </div>

      <div className="risks-summary">
        <div className="rs-card total">
          <div className="rs-num">{routes.length}</div>
          <div className="rs-label">{t("apis.endpoints")}</div>
        </div>
        {allMethods.map((m) => (
          <div key={m} className="rs-card" style={{ borderLeft: `3px solid ${METHOD_COLORS[m] || "#71717a"}` }}>
            <div className="rs-num" style={{ color: METHOD_COLORS[m] }}>
              {routes.filter((r) => r.methods.includes(m)).length}
            </div>
            <div className="rs-label">{m}</div>
          </div>
        ))}
        <div className="rs-card" style={{ borderLeft: "3px solid var(--green)" }}>
          <div className="rs-num" style={{ color: "var(--green)" }}>{routes.filter((r) => r.hasAuth).length}</div>
          <div className="rs-label">with auth</div>
        </div>
        <div className="rs-card" style={{ borderLeft: "3px solid var(--yellow)" }}>
          <div className="rs-num" style={{ color: "var(--yellow)" }}>{routes.filter((r) => !r.hasAuth).length}</div>
          <div className="rs-label">unprotected</div>
        </div>
      </div>

      <div className="risks-toolbar">
        <div className="cov-filters">
          <button
            className={"cov-filter" + (filterMethod === "all" ? " active" : "")}
            onClick={() => setFilterMethod("all")}
          >
            {t("apis.all")} ({routes.length})
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
            placeholder={t("apis.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch("")}>x</button>}
        </div>
      </div>

      <div className="api-list">
        {routeGroups.map(([prefix, groupRoutes]) => (
          <div key={prefix} className="api-group">
            {routeGroups.length > 1 && (
              <div className="api-group-header">
                <span className="api-group-prefix mono">{prefix}</span>
                <span className="api-group-count">{groupRoutes.length} endpoint{groupRoutes.length > 1 ? "s" : ""}</span>
              </div>
            )}
            {groupRoutes.map((route) => (
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
              <div className="api-middleware">
                {route.hasAuth && <span className="api-mw-badge auth" title="Has authentication">auth</span>}
                {route.hasValidation && <span className="api-mw-badge validation" title="Has input validation">zod</span>}
                {route.hasRateLimit && <span className="api-mw-badge rate-limit" title="Has rate limiting">rate</span>}
                {route.middleware.filter(m => !["auth","validation","rate-limit"].includes(m)).map(m => (
                  <span key={m} className="api-mw-badge other" title={m}>{m}</span>
                ))}
                {route.middleware.length === 0 && <span className="api-mw-badge none" title="No middleware detected">none</span>}
              </div>
            </div>

            {selectedRoute?.file.path === route.file.path && (
              <div className="api-detail" onClick={(e) => e.stopPropagation()}>
                <div className="api-detail-section">
                  <div className="api-detail-label">{t("apis.file")}</div>
                  <div className="api-detail-value mono">{route.file.path}</div>
                </div>

                {route.middleware.length > 0 && (
                  <div className="api-detail-section">
                    <div className="api-detail-label">Middleware & Protection</div>
                    <div className="api-mw-list">
                      {route.middleware.map((m) => (
                        <div key={m} className={"api-mw-item " + m}>
                          <span className="api-mw-icon">{m === "auth" ? "\u1F512" : m === "validation" ? "\u2713" : m === "rate-limit" ? "\u23F1" : "\u2699"}</span>
                          <span>{m}</span>
                        </div>
                      ))}
                      {!route.hasAuth && (
                        <div className="api-mw-item warning">
                          <span className="api-mw-icon">\u26A0</span>
                          <span>No auth detected</span>
                        </div>
                      )}
                      {!route.hasValidation && (
                        <div className="api-mw-item warning">
                          <span className="api-mw-icon">\u26A0</span>
                          <span>No input validation detected</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {route.file.exports.length > 0 && (
                  <div className="api-detail-section">
                    <div className="api-detail-label">{t("apis.exports")}</div>
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
                      {t("apis.internalDeps")} ({route.internalDeps.length})
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
                    <div className="api-detail-label">{t("apis.extPackages")}</div>
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
                      <div className="api-detail-label">{t("apis.usedBy")} ({callers.length})</div>
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
                    <div className="api-detail-label">{t("apis.summary")}</div>
                    <div className="api-detail-value">{route.file.summary}</div>
                  </div>
                )}
              </div>
            )}
          </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="risks-empty"><span>{t("apis.noResults")}</span></div>
        )}
      </div>
    </section>
  );
}
