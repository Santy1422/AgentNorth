"use client";

import { useState, useMemo, useCallback } from "react";
import type { ModuleData, FileData } from "@/app/page";
import { useT } from "@/i18n/provider";

const KIND_COLORS: Record<string, string> = {
  page: "#f97316",
  component: "#a78bfa",
  hook: "#4ade80",
  lib: "#fbbf24",
  model: "#60a5fa",
  route: "#f472b6",
  schema: "#34d399",
  test: "#94a3b8",
  config: "#a1a1aa",
  unknown: "#71717a",
};

const KIND_LABELS: Record<string, string> = {
  page: "Screen",
  component: "Component",
  hook: "Hook",
  lib: "Library",
  model: "Model",
  route: "API Route",
  schema: "Schema",
  test: "Test",
  config: "Config",
  unknown: "Other",
};

function shortName(path: string): string {
  return path.split("/").pop() || path;
}

function screenLabel(f: FileData): string {
  // Make human-readable screen names from paths
  const p = f.path;
  if (p.includes("app/page.")) return "Home / Dashboard";
  if (p.includes("join/")) return "Join Team";
  if (p.includes("login")) return "Login";
  // fallback
  const parts = p.split("/");
  const folder = parts[parts.length - 2] || "";
  const file = shortName(p).replace(/\.(tsx?|jsx?)$/, "");
  if (file === "page") return folder || "Home";
  return file;
}

function resolveImport(imp: { source: string; specifiers: string[] }, allFiles: FileData[]): FileData | null {
  const src = imp.source;
  for (const f of allFiles) {
    const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
    if (src.endsWith(name) || src.endsWith("/" + name)) return f;
    // @/ alias
    if (src.startsWith("@/") && f.path.includes(src.replace("@/", ""))) return f;
  }
  return null;
}

function getDirectDeps(file: FileData, allFiles: FileData[]): FileData[] {
  const deps: FileData[] = [];
  const seen = new Set<string>();
  for (const imp of file.imports) {
    const resolved = resolveImport(imp, allFiles);
    if (resolved && resolved.path !== file.path && !seen.has(resolved.path)) {
      seen.add(resolved.path);
      deps.push(resolved);
    }
  }
  return deps;
}

function getUsedBy(file: FileData, allFiles: FileData[]): FileData[] {
  const name = shortName(file.path).replace(/\.(tsx?|jsx?)$/, "");
  return allFiles.filter(
    (f) =>
      f.path !== file.path &&
      f.imports?.some((imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name))
  );
}

// ─── Main Component ───
export function MapView({ modules }: { modules: ModuleData[] }) {
  const { t } = useT();
  const [selectedScreen, setSelectedScreen] = useState<FileData | null>(null);
  const [selectedNode, setSelectedNode] = useState<FileData | null>(null);
  const [mapSearch, setMapSearch] = useState("");

  const allFiles = useMemo(() => modules.flatMap((m) => m.files || []), [modules]);
  // Deduplicate by path
  const uniqueFiles = useMemo(() => {
    const seen = new Set<string>();
    return allFiles.filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [allFiles]);

  const screens = useMemo(() => uniqueFiles.filter((f) => f.kind === "page"), [uniqueFiles]);
  const routes = useMemo(() => uniqueFiles.filter((f) => f.kind === "route"), [uniqueFiles]);
  const components = useMemo(() => uniqueFiles.filter((f) => f.kind === "component"), [uniqueFiles]);
  const hooks = useMemo(() => uniqueFiles.filter((f) => f.kind === "hook"), [uniqueFiles]);
  const libs = useMemo(() => uniqueFiles.filter((f) => f.kind === "lib"), [uniqueFiles]);
  const models = useMemo(() => uniqueFiles.filter((f) => f.kind === "model"), [uniqueFiles]);
  const others = useMemo(
    () => uniqueFiles.filter((f) => !["page", "route", "component", "hook", "lib", "model"].includes(f.kind)),
    [uniqueFiles]
  );

  const hasFiles = uniqueFiles.length > 0;

  if (!hasFiles) {
    return (
      <section className="map-simple">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>{t("map.title")}</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F5FA;</div>
          <div className="empty-title">{t("map.noFiles")}</div>
          <div className="empty-desc">{t("map.noFilesDesc")}</div>
        </div>
      </section>
    );
  }

  // Back handler
  const handleBack = () => {
    if (selectedNode) {
      setSelectedNode(null);
    } else {
      setSelectedScreen(null);
    }
  };

  return (
    <section className="map-simple">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2 className="breadcrumb">
          <button
            className={"crumb" + (!selectedScreen ? " current" : "")}
            onClick={() => {
              setSelectedScreen(null);
              setSelectedNode(null);
            }}
          >
            {t("map.architecture")}
          </button>
          {selectedScreen && (
            <>
              <span className="crumb-sep">/</span>
              <button
                className={"crumb" + (!selectedNode ? " current" : "")}
                onClick={() => setSelectedNode(null)}
              >
                <span className="mono">{screenLabel(selectedScreen)}</span>
              </button>
            </>
          )}
          {selectedNode && (
            <>
              <span className="crumb-sep">/</span>
              <span className="crumb current mono">{shortName(selectedNode.path)}</span>
            </>
          )}
        </h2>
        <span className="meta">
          {!selectedScreen && `${screens.length} ${t("map.screens")} · ${routes.length} ${t("map.apis")} · ${uniqueFiles.length} files`}
          {selectedScreen && !selectedNode && t("map.depFlow")}
          {selectedNode && `${selectedNode.exports.length} ${t("map.exports")} · ${selectedNode.imports.length} ${t("map.imports")}`}
        </span>
      </div>

      {/* Search bar for map */}
      {!selectedScreen && !selectedNode && (
        <div className="map-search-bar">
          <div className="map-search" style={{ flex: 1 }}>
            <span className="search-icon">&#x2315;</span>
            <input
              type="text"
              placeholder={t("map.search")}
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
            />
            {mapSearch && (
              <button className="search-clear" onClick={() => setMapSearch("")}>x</button>
            )}
          </div>
        </div>
      )}

      {/* Search results */}
      {!selectedScreen && !selectedNode && mapSearch.trim() && (
        <div className="map-search-results">
          {uniqueFiles
            .filter((f) => {
              const q = mapSearch.toLowerCase();
              return (
                f.path.toLowerCase().includes(q) ||
                f.exports.some((e) => e.toLowerCase().includes(q)) ||
                shortName(f.path).toLowerCase().includes(q)
              );
            })
            .slice(0, 12)
            .map((f) => (
              <button
                key={f.path}
                className="map-search-result"
                onClick={() => {
                  if (f.kind === "page") {
                    setSelectedScreen(f);
                  } else {
                    setSelectedNode(f);
                  }
                  setMapSearch("");
                }}
              >
                <span className="cov-file-kind" style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}>
                  {f.kind}
                </span>
                <span className="mono" style={{ flex: 1 }}>{shortName(f.path)}</span>
                <span style={{ fontSize: 11, color: "var(--text-4)" }}>{f.loc} LOC</span>
              </button>
            ))}
        </div>
      )}

      {!selectedScreen && !selectedNode && !mapSearch.trim() && (
        <ArchitectureOverview
          screens={screens}
          routes={routes}
          components={components}
          hooks={hooks}
          libs={libs}
          models={models}
          others={others}
          allFiles={uniqueFiles}
          onSelectScreen={setSelectedScreen}
          onSelectFile={setSelectedNode}
        />
      )}

      {selectedScreen && !selectedNode && (
        <ScreenFlow
          screen={selectedScreen}
          allFiles={uniqueFiles}
          onSelectFile={setSelectedNode}
          onBack={handleBack}
        />
      )}

      {selectedNode && (
        <NodeDetail
          file={selectedNode}
          allFiles={uniqueFiles}
          onNavigate={setSelectedNode}
          onBack={handleBack}
        />
      )}
    </section>
  );
}

// ─── Level 1: Architecture Overview ───
function ArchitectureOverview({
  screens,
  routes,
  components,
  hooks,
  libs,
  models,
  others,
  allFiles,
  onSelectScreen,
  onSelectFile,
}: {
  screens: FileData[];
  routes: FileData[];
  components: FileData[];
  hooks: FileData[];
  libs: FileData[];
  models: FileData[];
  others: FileData[];
  allFiles: FileData[];
  onSelectScreen: (f: FileData) => void;
  onSelectFile: (f: FileData) => void;
}) {
  const { t } = useT();
  return (
    <div className="arch-overview">
      {/* Screens - the main entry point */}
      {screens.length > 0 && (
        <div className="arch-layer">
          <div className="arch-layer-label">
            <span className="arch-dot" style={{ background: KIND_COLORS.page }}></span>
            {t("map.screensTab")} ({screens.length})
          </div>
          <div className="arch-cards">
            {screens.map((s) => {
              const deps = getDirectDeps(s, allFiles);
              const compCount = deps.filter((d) => d.kind === "component").length;
              return (
                <button key={s.path} className="arch-screen-card" onClick={() => onSelectScreen(s)}>
                  <div className="asc-icon">&#x1F4F1;</div>
                  <div className="asc-info">
                    <div className="asc-name">{screenLabel(s)}</div>
                    <div className="asc-path mono">{s.path}</div>
                    <div className="asc-meta">
                      {s.loc} LOC
                      {compCount > 0 && <span> · {compCount} {t("map.components")}</span>}
                      {deps.length > compCount && (
                        <span> · {deps.length - compCount} {t("map.others")}</span>
                      )}
                    </div>
                  </div>
                  <div className="asc-arrow">&rarr;</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Connector */}
      {screens.length > 0 && components.length > 0 && (
        <div className="arch-connector">
          <div className="arch-connector-line"></div>
          <span className="arch-connector-label">{t("map.uses")}</span>
          <div className="arch-connector-line"></div>
        </div>
      )}

      {/* Components */}
      {components.length > 0 && (
        <div className="arch-layer">
          <div className="arch-layer-label">
            <span className="arch-dot" style={{ background: KIND_COLORS.component }}></span>
            {t("map.componentsTab")} ({components.length})
          </div>
          <div className="arch-chips-grid">
            {components.map((c) => {
              const usedBy = getUsedBy(c, allFiles);
              const isLarge = c.loc > 300;
              return (
                <button key={c.path} className={"arch-chip" + (isLarge ? " large" : "")} onClick={() => onSelectFile(c)}>
                  <span className="arch-chip-dot" style={{ background: KIND_COLORS.component }}></span>
                  <span className="arch-chip-name mono">{shortName(c.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                  {isLarge && <span className="arch-chip-warn" title="Large file">!</span>}
                  {usedBy.length > 0 && (
                    <span className="arch-chip-badge">{usedBy.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Connector */}
      {(hooks.length > 0 || libs.length > 0) && (
        <div className="arch-connector">
          <div className="arch-connector-line"></div>
          <span className="arch-connector-label">{t("map.import")}</span>
          <div className="arch-connector-line"></div>
        </div>
      )}

      {/* Hooks & Libs side by side */}
      {(hooks.length > 0 || libs.length > 0) && (
        <div className="arch-split">
          {hooks.length > 0 && (
            <div className="arch-layer">
              <div className="arch-layer-label">
                <span className="arch-dot" style={{ background: KIND_COLORS.hook }}></span>
                {t("map.hooksTab")} ({hooks.length})
              </div>
              <div className="arch-chips-grid">
                {hooks.map((h) => (
                  <button key={h.path} className="arch-chip" onClick={() => onSelectFile(h)}>
                    <span className="arch-chip-dot" style={{ background: KIND_COLORS.hook }}></span>
                    <span className="arch-chip-name mono">{shortName(h.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {libs.length > 0 && (
            <div className="arch-layer">
              <div className="arch-layer-label">
                <span className="arch-dot" style={{ background: KIND_COLORS.lib }}></span>
                {t("map.libsTab")} ({libs.length})
              </div>
              <div className="arch-chips-grid">
                {libs.map((l) => (
                  <button key={l.path} className="arch-chip" onClick={() => onSelectFile(l)}>
                    <span className="arch-chip-dot" style={{ background: KIND_COLORS.lib }}></span>
                    <span className="arch-chip-name mono">{shortName(l.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connector */}
      {models.length > 0 && (
        <div className="arch-connector">
          <div className="arch-connector-line"></div>
          <span className="arch-connector-label">{t("map.accessTo")}</span>
          <div className="arch-connector-line"></div>
        </div>
      )}

      {/* Models / Data layer */}
      {models.length > 0 && (
        <div className="arch-layer">
          <div className="arch-layer-label">
            <span className="arch-dot" style={{ background: KIND_COLORS.model }}></span>
            {t("map.modelsTab")} ({models.length})
          </div>
          <div className="arch-chips-grid">
            {models.map((m) => (
              <button key={m.path} className="arch-chip" onClick={() => onSelectFile(m)}>
                <span className="arch-chip-dot" style={{ background: KIND_COLORS.model }}></span>
                <span className="arch-chip-name mono">{shortName(m.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* API Routes */}
      {routes.length > 0 && (
        <>
          <div className="arch-separator"></div>
          <div className="arch-layer">
            <div className="arch-layer-label">
              <span className="arch-dot" style={{ background: KIND_COLORS.route }}></span>
              {t("map.routesTab")} ({routes.length})
            </div>
            <div className="arch-chips-grid">
              {routes.map((r) => {
                const pathLabel = r.path
                  .replace(/.*\/app\/api\//, "/api/")
                  .replace(/\/route\.(ts|tsx)$/, "")
                  .replace(/\[\[\.\.\.route\]\]/, "*");
                return (
                  <button key={r.path} className="arch-chip route" onClick={() => onSelectFile(r)}>
                    <span className="arch-chip-dot" style={{ background: KIND_COLORS.route }}></span>
                    <span className="arch-chip-name mono">{pathLabel}</span>
                    <span className="arch-chip-method">{t("map.getPost")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Others */}
      {others.length > 0 && (
        <div className="arch-layer" style={{ marginTop: 8 }}>
          <div className="arch-layer-label">
            <span className="arch-dot" style={{ background: KIND_COLORS.unknown }}></span>
            {t("map.othersTab")} ({others.length})
          </div>
          <div className="arch-chips-grid">
            {others.map((o) => (
              <button key={o.path} className="arch-chip" onClick={() => onSelectFile(o)}>
                <span className="arch-chip-dot" style={{ background: KIND_COLORS[o.kind] || KIND_COLORS.unknown }}></span>
                <span className="arch-chip-name mono">{shortName(o.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Level 2: Screen Flow ───
function ScreenFlow({
  screen,
  allFiles,
  onSelectFile,
  onBack,
}: {
  screen: FileData;
  allFiles: FileData[];
  onSelectFile: (f: FileData) => void;
  onBack: () => void;
}) {
  const { t } = useT();
  // Build dependency tree
  const directDeps = getDirectDeps(screen, allFiles);

  // Group direct deps by kind
  const depsByKind = useMemo(() => {
    const groups: Record<string, FileData[]> = {};
    for (const d of directDeps) {
      const k = d.kind;
      if (!groups[k]) groups[k] = [];
      groups[k].push(d);
    }
    return groups;
  }, [directDeps]);

  // Second level: what do those components import?
  const secondLevel = useMemo(() => {
    const seen = new Set([screen.path, ...directDeps.map((d) => d.path)]);
    const items: FileData[] = [];
    for (const dep of directDeps) {
      for (const sub of getDirectDeps(dep, allFiles)) {
        if (!seen.has(sub.path)) {
          seen.add(sub.path);
          items.push(sub);
        }
      }
    }
    return items;
  }, [screen, directDeps, allFiles]);

  const secondByKind = useMemo(() => {
    const groups: Record<string, FileData[]> = {};
    for (const d of secondLevel) {
      const k = d.kind;
      if (!groups[k]) groups[k] = [];
      groups[k].push(d);
    }
    return groups;
  }, [secondLevel]);

  // External deps
  const externalImports = screen.imports.filter(
    (imp) => !imp.source.startsWith(".") && !imp.source.startsWith("@/") && !imp.source.startsWith("~")
  );

  return (
    <div className="screen-flow">
      {/* The screen itself */}
      <div className="sf-root">
        <div className="sf-root-icon">&#x1F4F1;</div>
        <div className="sf-root-info">
          <div className="sf-root-name">{screenLabel(screen)}</div>
          <div className="sf-root-path mono">{screen.path}</div>
          <div className="sf-root-stats">
            <span>{screen.loc} LOC</span>
            <span>{screen.exports.length} exports</span>
            <span>{directDeps.length} direct dependencies</span>
          </div>
        </div>
      </div>

      {directDeps.length > 0 && (
        <div className="sf-connector-v">
          <div className="sf-line-v"></div>
          <span className="sf-connector-label">{t("map.importsDirect")}</span>
        </div>
      )}

      {/* Direct dependencies grouped by kind */}
      {Object.entries(depsByKind)
        .sort(([a], [b]) => {
          const order = ["component", "hook", "lib", "model", "route", "schema", "config", "unknown"];
          return order.indexOf(a) - order.indexOf(b);
        })
        .map(([kind, files]) => (
          <div key={kind} className="sf-dep-group">
            <div className="sf-dep-group-label">
              <span className="arch-dot" style={{ background: KIND_COLORS[kind] }}></span>
              {KIND_LABELS[kind] || kind} ({files.length})
            </div>
            <div className="sf-dep-cards">
              {files.map((f) => {
                const subDeps = getDirectDeps(f, allFiles).filter(
                  (sd) => sd.path !== screen.path
                );
                return (
                  <button key={f.path} className="sf-dep-card" onClick={() => onSelectFile(f)}>
                    <div className="sf-dc-head">
                      <span className="fc-kind" style={{ background: KIND_COLORS[f.kind] }}>
                        {f.kind}
                      </span>
                      <span className="sf-dc-name mono">
                        {shortName(f.path).replace(/\.(tsx?|jsx?)$/, "")}
                      </span>
                      <span className="asc-arrow">&rarr;</span>
                    </div>
                    <div className="sf-dc-stats">
                      <span>{f.loc} LOC</span>
                      {f.exports.length > 0 && <span>{f.exports.length} exp</span>}
                      {subDeps.length > 0 && (
                        <span style={{ color: "var(--text-3)" }}>
                          {t("map.uses")} {subDeps.length}+
                        </span>
                      )}
                    </div>
                    {f.exports.length > 0 && (
                      <div className="sf-dc-exports">
                        {f.exports.slice(0, 3).map((e) => (
                          <span key={e} className="fc-export mono">{e}</span>
                        ))}
                        {f.exports.length > 3 && (
                          <span className="fc-export muted">+{f.exports.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      {/* Second-level deps */}
      {secondLevel.length > 0 && (
        <>
          <div className="sf-connector-v">
            <div className="sf-line-v"></div>
            <span className="sf-connector-label">{t("map.thoseUse")}</span>
          </div>

          {Object.entries(secondByKind)
            .sort(([a], [b]) => {
              const order = ["component", "hook", "lib", "model", "route", "schema", "config", "unknown"];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([kind, files]) => (
              <div key={kind} className="sf-dep-group secondary">
                <div className="sf-dep-group-label">
                  <span className="arch-dot" style={{ background: KIND_COLORS[kind] }}></span>
                  {KIND_LABELS[kind] || kind} ({files.length})
                </div>
                <div className="sf-dep-chips">
                  {files.map((f) => (
                    <button key={f.path} className="arch-chip" onClick={() => onSelectFile(f)}>
                      <span className="arch-chip-dot" style={{ background: KIND_COLORS[f.kind] }}></span>
                      <span className="arch-chip-name mono">
                        {shortName(f.path).replace(/\.(tsx?|jsx?)$/, "")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </>
      )}

      {/* External deps */}
      {externalImports.length > 0 && (
        <div className="sf-dep-group" style={{ marginTop: 8 }}>
          <div className="sf-dep-group-label">
            <span className="arch-dot" style={{ background: "#60a5fa" }}></span>
            {t("map.extPackages")} ({externalImports.length})
          </div>
          <div className="sf-dep-chips">
            {externalImports.map((imp) => (
              <span key={imp.source} className="fd-chip ext mono">{imp.source}</span>
            ))}
          </div>
        </div>
      )}

      <button className="btn-simple" style={{ marginTop: 20 }} onClick={onBack}>
        &larr; {t("map.backToArch")}
      </button>
    </div>
  );
}

// ─── Level 3: Node Detail ───
function NodeDetail({
  file,
  allFiles,
  onNavigate,
  onBack,
}: {
  file: FileData;
  allFiles: FileData[];
  onNavigate: (f: FileData) => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const deps = getDirectDeps(file, allFiles);
  const usedBy = getUsedBy(file, allFiles);
  const externalImports = file.imports.filter(
    (imp) => !imp.source.startsWith(".") && !imp.source.startsWith("@/") && !imp.source.startsWith("~")
  );

  return (
    <div className="file-detail">
      <div className="fd-header">
        <span className="fc-kind lg" style={{ background: KIND_COLORS[file.kind] }}>
          {file.kind}
        </span>
        <div>
          <div className="fd-name mono">{shortName(file.path)}</div>
          <div className="fd-path mono">{file.path}</div>
        </div>
      </div>

      <div className="fd-stats-row">
        <div className="fd-stat">
          <span className="fd-stat-num">{file.loc}</span>
          <span>LOC</span>
        </div>
        <div className="fd-stat">
          <span className="fd-stat-num">{file.exports.length}</span>
          <span>{t("map.exports")}</span>
        </div>
        <div className="fd-stat">
          <span className="fd-stat-num">{deps.length}</span>
          <span>{t("map.imports")}</span>
        </div>
        <div className="fd-stat">
          <span className="fd-stat-num">{usedBy.length}</span>
          <span>{t("map.usedBy")}</span>
        </div>
      </div>

      <div className="fd-sections">
        {file.summary && (
          <div className="fd-section">
            <div className="fd-section-title">{t("map.summary")}</div>
            <div className="fd-summary">{file.summary}</div>
          </div>
        )}

        {file.exports.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">{t("map.exportsLabel")} ({file.exports.length})</div>
            <div className="fd-exports-xref">
              {file.exports.map((exp) => {
                // Find who imports this specific export
                const importers = allFiles.filter(
                  (f) =>
                    f.path !== file.path &&
                    f.imports?.some(
                      (imp) => imp.specifiers?.includes(exp) || imp.specifiers?.includes("default") && exp === "default"
                    )
                );
                return (
                  <div key={exp} className="fd-export-item">
                    <div className="fd-export-name mono">{exp}</div>
                    {importers.length > 0 ? (
                      <div className="fd-export-users">
                        {importers.map((u) => (
                          <button
                            key={u.path}
                            className="fd-export-user"
                            onClick={() => onNavigate(u)}
                          >
                            <span className="mc-kind-dot" style={{ background: KIND_COLORS[u.kind] }}></span>
                            <span className="mono">{shortName(u.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="fd-export-unused">{t("map.unused")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {deps.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">{t("map.importsFrom")} ({deps.length})</div>
            {deps.map((target) => (
              <button key={target.path} className="fd-link" onClick={() => onNavigate(target)}>
                <span className="mc-kind-dot" style={{ background: KIND_COLORS[target.kind] }}></span>
                <span className="mono">{shortName(target.path)}</span>
                <span className="fd-link-kind">{target.kind}</span>
                <span className="asc-arrow">&rarr;</span>
              </button>
            ))}
          </div>
        )}

        {usedBy.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">{t("map.usedBy")} ({usedBy.length})</div>
            {usedBy.map((f) => (
              <button key={f.path} className="fd-link" onClick={() => onNavigate(f)}>
                <span className="mc-kind-dot" style={{ background: KIND_COLORS[f.kind] }}></span>
                <span className="mono">{shortName(f.path)}</span>
                <span className="fd-link-kind">{f.kind}</span>
                <span className="asc-arrow">&rarr;</span>
              </button>
            ))}
          </div>
        )}

        {externalImports.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">{t("map.extPackages")} ({externalImports.length})</div>
            <div className="fd-chips">
              {externalImports.map((imp) => (
                <span key={imp.source} className="fd-chip ext mono">{imp.source}</span>
              ))}
            </div>
          </div>
        )}

        {deps.length === 0 && usedBy.length === 0 && (
          <div className="fd-section">
            <div className="fd-orphan">
              &#x26A0; {t("map.noConnections")}
            </div>
          </div>
        )}
      </div>

      <button className="btn-simple" style={{ marginTop: 16 }} onClick={onBack}>
        &larr; {t("map.back")}
      </button>
    </div>
  );
}
