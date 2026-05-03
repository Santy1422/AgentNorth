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
  const p = f.path;
  if (p.includes("app/page.")) return "Home / Dashboard";
  if (p.includes("join/")) return "Join Team";
  if (p.includes("login")) return "Login";
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

type ViewMode = "treemap" | "layers";
type ColorBy = "kind" | "module" | "complexity" | "churn";
type SizeBy = "loc" | "imports" | "changes";

// ─── Main Component ───
export function MapView({ modules }: { modules: ModuleData[] }) {
  const { t } = useT();
  const [viewMode, setViewMode] = useState<ViewMode>("treemap");
  const [colorBy, setColorBy] = useState<ColorBy>("kind");
  const [sizeBy, setSizeBy] = useState<SizeBy>("loc");
  const [zoomedModule, setZoomedModule] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [hoveredFile, setHoveredFile] = useState<FileData | null>(null);
  const [mapSearch, setMapSearch] = useState("");

  const allFiles = useMemo(() => {
    const seen = new Set<string>();
    return modules.flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [modules]);

  const moduleColors = useMemo(() => {
    const palette = ["#f97316", "#a78bfa", "#4ade80", "#60a5fa", "#f472b6", "#fbbf24", "#34d399", "#e879f9", "#fb923c", "#38bdf8"];
    const map: Record<string, string> = {};
    modules.forEach((m, i) => { map[m.name] = palette[i % palette.length]; });
    return map;
  }, [modules]);

  // Import counts for sizing
  const importCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of allFiles) {
      const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
      counts[f.path] = allFiles.filter(
        (other) => other.path !== f.path &&
          other.imports?.some((imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name))
      ).length;
    }
    return counts;
  }, [allFiles]);

  const getFileSize = useCallback((f: FileData): number => {
    if (sizeBy === "loc") return Math.max(f.loc, 10);
    if (sizeBy === "imports") return Math.max((importCounts[f.path] || 0) + 1, 1) * 30;
    if (sizeBy === "changes") return Math.max((f.change_frequency || 0) + 1, 1) * 30;
    return f.loc;
  }, [sizeBy, importCounts]);

  const getFileColor = useCallback((f: FileData, moduleName?: string): string => {
    if (colorBy === "kind") return KIND_COLORS[f.kind] || KIND_COLORS.unknown;
    if (colorBy === "module") return moduleColors[moduleName || ""] || "#71717a";
    if (colorBy === "complexity") {
      const c = f.complexity || 0;
      if (c > 15) return "#ef4444";
      if (c > 8) return "#f97316";
      if (c > 4) return "#fbbf24";
      return "#4ade80";
    }
    if (colorBy === "churn") {
      const ch = f.change_frequency || 0;
      if (ch > 10) return "#ef4444";
      if (ch > 5) return "#f97316";
      if (ch > 2) return "#fbbf24";
      return "#4ade80";
    }
    return KIND_COLORS[f.kind] || "#71717a";
  }, [colorBy, moduleColors]);

  const screens = useMemo(() => allFiles.filter((f) => f.kind === "page"), [allFiles]);
  const routes = useMemo(() => allFiles.filter((f) => f.kind === "route"), [allFiles]);

  if (allFiles.length === 0) {
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

  const handleBack = () => {
    if (selectedFile) { setSelectedFile(null); return; }
    if (zoomedModule) { setZoomedModule(null); return; }
  };

  const currentModule = zoomedModule ? modules.find((m) => m.name === zoomedModule) : null;

  return (
    <section className="map-simple">
      {/* Header */}
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2 className="breadcrumb">
          <button
            className={"crumb" + (!zoomedModule && !selectedFile ? " current" : "")}
            onClick={() => { setZoomedModule(null); setSelectedFile(null); }}
          >
            {t("map.architecture")}
          </button>
          {zoomedModule && (
            <>
              <span className="crumb-sep">/</span>
              <button
                className={"crumb" + (!selectedFile ? " current" : "")}
                onClick={() => setSelectedFile(null)}
              >
                <span className="mono">{zoomedModule}</span>
              </button>
            </>
          )}
          {selectedFile && (
            <>
              <span className="crumb-sep">/</span>
              <span className="crumb current mono">{shortName(selectedFile.path)}</span>
            </>
          )}
        </h2>
        <span className="meta">
          {!zoomedModule && !selectedFile && `${modules.length} modules · ${allFiles.length} files · ${screens.length} ${t("map.screens")} · ${routes.length} ${t("map.apis")}`}
          {zoomedModule && !selectedFile && currentModule && `${currentModule.files_count} files · ${currentModule.loc.toLocaleString("en")} LOC`}
          {selectedFile && `${selectedFile.exports.length} ${t("map.exports")} · ${selectedFile.imports.length} ${t("map.imports")}`}
        </span>
      </div>

      {/* Controls bar */}
      {!selectedFile && (
        <div className="map-controls">
          <div className="map-controls-left">
            {/* View toggle */}
            <div className="map-toggle-group">
              <button className={"map-toggle" + (viewMode === "treemap" ? " active" : "")} onClick={() => setViewMode("treemap")}>
                Treemap
              </button>
              <button className={"map-toggle" + (viewMode === "layers" ? " active" : "")} onClick={() => setViewMode("layers")}>
                Layers
              </button>
            </div>

            {/* Color by */}
            <div className="map-control-group">
              <span className="map-control-label">Color</span>
              <select className="map-select" value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)}>
                <option value="kind">File type</option>
                <option value="module">Module</option>
                <option value="complexity">Complexity</option>
                <option value="churn">Change freq</option>
              </select>
            </div>

            {/* Size by */}
            {viewMode === "treemap" && (
              <div className="map-control-group">
                <span className="map-control-label">Size</span>
                <select className="map-select" value={sizeBy} onChange={(e) => setSizeBy(e.target.value as SizeBy)}>
                  <option value="loc">Lines of code</option>
                  <option value="imports">Import count</option>
                  <option value="changes">Change frequency</option>
                </select>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="map-search">
            <span className="search-icon">&#x2315;</span>
            <input
              type="text"
              placeholder={t("map.search")}
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
            />
            {mapSearch && <button className="search-clear" onClick={() => setMapSearch("")}>x</button>}
          </div>
        </div>
      )}

      {/* Search results overlay */}
      {!selectedFile && mapSearch.trim() && (
        <div className="map-search-results">
          {allFiles
            .filter((f) => {
              const q = mapSearch.toLowerCase();
              return f.path.toLowerCase().includes(q) || f.exports.some((e) => e.toLowerCase().includes(q)) || shortName(f.path).toLowerCase().includes(q);
            })
            .slice(0, 12)
            .map((f) => (
              <button key={f.path} className="map-search-result" onClick={() => { setSelectedFile(f); setMapSearch(""); }}>
                <span className="cov-file-kind" style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}>{f.kind}</span>
                <span className="mono" style={{ flex: 1 }}>{shortName(f.path)}</span>
                <span style={{ fontSize: 11, color: "var(--text-4)" }}>{f.loc} LOC</span>
              </button>
            ))}
        </div>
      )}

      {/* Legend */}
      {!selectedFile && !mapSearch.trim() && (
        <div className="map-legend">
          {colorBy === "kind" && Object.entries(KIND_COLORS).filter(([k]) => allFiles.some((f) => f.kind === k)).map(([kind, color]) => (
            <span key={kind} className="map-legend-item">
              <span className="map-legend-dot" style={{ background: color }}></span>
              {KIND_LABELS[kind] || kind}
            </span>
          ))}
          {colorBy === "module" && modules.map((m) => (
            <span key={m.name} className="map-legend-item">
              <span className="map-legend-dot" style={{ background: moduleColors[m.name] }}></span>
              {m.name}
            </span>
          ))}
          {colorBy === "complexity" && (
            <>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#4ade80" }}></span>Low (0-4)</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#fbbf24" }}></span>Med (5-8)</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#f97316" }}></span>High (9-15)</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#ef4444" }}></span>Critical (15+)</span>
            </>
          )}
          {colorBy === "churn" && (
            <>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#4ade80" }}></span>Stable (0-2)</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#fbbf24" }}></span>Active (3-5)</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#f97316" }}></span>Hot (6-10)</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: "#ef4444" }}></span>Volatile (10+)</span>
            </>
          )}
        </div>
      )}

      {/* Main content */}
      {!selectedFile && !mapSearch.trim() && viewMode === "treemap" && (
        <TreemapView
          modules={modules}
          allFiles={allFiles}
          zoomedModule={zoomedModule}
          hoveredFile={hoveredFile}
          getFileSize={getFileSize}
          getFileColor={getFileColor}
          importCounts={importCounts}
          onZoomModule={setZoomedModule}
          onSelectFile={setSelectedFile}
          onHoverFile={setHoveredFile}
        />
      )}

      {!selectedFile && !mapSearch.trim() && viewMode === "layers" && (
        <LayersView
          modules={modules}
          allFiles={allFiles}
          getFileColor={getFileColor}
          importCounts={importCounts}
          onSelectFile={setSelectedFile}
          onZoomModule={setZoomedModule}
        />
      )}

      {selectedFile && (
        <NodeDetail
          file={selectedFile}
          allFiles={allFiles}
          importCounts={importCounts}
          getFileColor={getFileColor}
          onNavigate={setSelectedFile}
          onBack={handleBack}
        />
      )}
    </section>
  );
}

// ─── Treemap View ───
function TreemapView({
  modules,
  allFiles,
  zoomedModule,
  hoveredFile,
  getFileSize,
  getFileColor,
  importCounts,
  onZoomModule,
  onSelectFile,
  onHoverFile,
}: {
  modules: ModuleData[];
  allFiles: FileData[];
  zoomedModule: string | null;
  hoveredFile: FileData | null;
  getFileSize: (f: FileData) => number;
  getFileColor: (f: FileData, mod?: string) => string;
  importCounts: Record<string, number>;
  onZoomModule: (name: string | null) => void;
  onSelectFile: (f: FileData) => void;
  onHoverFile: (f: FileData | null) => void;
}) {
  const { t } = useT();

  // Hover tooltip deps
  const hoveredDeps = useMemo(() => {
    if (!hoveredFile) return [];
    return getDirectDeps(hoveredFile, allFiles);
  }, [hoveredFile, allFiles]);

  const hoveredUsedBy = useMemo(() => {
    if (!hoveredFile) return [];
    return getUsedBy(hoveredFile, allFiles);
  }, [hoveredFile, allFiles]);

  // If zoomed into a module, show only that module's files
  if (zoomedModule) {
    const mod = modules.find((m) => m.name === zoomedModule);
    if (!mod || !mod.files) return null;
    const totalSize = mod.files.reduce((s, f) => s + getFileSize(f), 0);

    return (
      <div className="treemap-container">
        <div className="treemap-module-zoomed">
          <div className="treemap-files">
            {mod.files
              .sort((a, b) => getFileSize(b) - getFileSize(a))
              .map((f) => {
                const pct = (getFileSize(f) / totalSize) * 100;
                const color = getFileColor(f, zoomedModule);
                const isHovered = hoveredFile?.path === f.path;
                const isConnected = hoveredFile && (
                  hoveredDeps.some((d) => d.path === f.path) ||
                  hoveredUsedBy.some((d) => d.path === f.path)
                );
                const isDimmed = hoveredFile && !isHovered && !isConnected;

                return (
                  <div
                    key={f.path}
                    className={"treemap-cell-file" + (isHovered ? " hovered" : "") + (isDimmed ? " dimmed" : "") + (isConnected ? " connected" : "")}
                    style={{
                      flexBasis: `${Math.max(pct, 3)}%`,
                      flexGrow: Math.max(pct, 3),
                      borderColor: color,
                      background: `${color}15`,
                    }}
                    onClick={() => onSelectFile(f)}
                    onMouseEnter={() => onHoverFile(f)}
                    onMouseLeave={() => onHoverFile(null)}
                  >
                    <div className="tcf-name mono">{shortName(f.path).replace(/\.(tsx?|jsx?)$/, "")}</div>
                    <div className="tcf-meta">
                      <span className="tcf-kind" style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}>{f.kind}</span>
                      <span>{f.loc} LOC</span>
                      {(importCounts[f.path] || 0) > 0 && <span>{importCounts[f.path]} deps</span>}
                    </div>
                    {f.exports.length > 0 && (
                      <div className="tcf-exports">
                        {f.exports.slice(0, 3).map((e) => (
                          <span key={e} className="tcf-export mono">{e}</span>
                        ))}
                        {f.exports.length > 3 && <span className="tcf-export muted">+{f.exports.length - 3}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Hover tooltip */}
        {hoveredFile && (
          <div className="treemap-tooltip">
            <div className="tt-name mono">{shortName(hoveredFile.path)}</div>
            <div className="tt-path mono">{hoveredFile.path}</div>
            <div className="tt-stats">
              <span>{hoveredFile.loc} LOC</span>
              {hoveredFile.complexity ? <span>complexity: {hoveredFile.complexity}</span> : null}
              {hoveredFile.change_frequency ? <span>{hoveredFile.change_frequency} changes (3mo)</span> : null}
              <span>{hoveredFile.exports.length} exports</span>
            </div>
            {hoveredDeps.length > 0 && (
              <div className="tt-deps">
                <span className="tt-label">Imports ({hoveredDeps.length}):</span>
                {hoveredDeps.slice(0, 5).map((d) => (
                  <span key={d.path} className="tt-dep">
                    <span className="map-legend-dot" style={{ background: KIND_COLORS[d.kind] }}></span>
                    {shortName(d.path).replace(/\.(tsx?|jsx?)$/, "")}
                  </span>
                ))}
              </div>
            )}
            {hoveredUsedBy.length > 0 && (
              <div className="tt-deps">
                <span className="tt-label">Used by ({hoveredUsedBy.length}):</span>
                {hoveredUsedBy.slice(0, 5).map((d) => (
                  <span key={d.path} className="tt-dep">
                    <span className="map-legend-dot" style={{ background: KIND_COLORS[d.kind] }}></span>
                    {shortName(d.path).replace(/\.(tsx?|jsx?)$/, "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="btn-simple" style={{ marginTop: 12 }} onClick={() => onZoomModule(null)}>
          &larr; {t("map.backToArch")}
        </button>
      </div>
    );
  }

  // Module-level treemap
  const totalLoc = modules.reduce((s, m) => s + (m.loc || 0), 0);

  return (
    <div className="treemap-container">
      <div className="treemap-modules">
        {modules
          .sort((a, b) => (b.loc || 0) - (a.loc || 0))
          .map((m) => {
            const pct = totalLoc > 0 ? (m.loc / totalLoc) * 100 : 100 / modules.length;
            const files = m.files || [];
            const modTotalSize = files.reduce((s, f) => s + getFileSize(f), 0);

            return (
              <div
                key={m.name}
                className="treemap-module"
                style={{ flexBasis: `${Math.max(pct, 8)}%`, flexGrow: Math.max(pct, 8) }}
              >
                <button className="treemap-module-header" onClick={() => onZoomModule(m.name)}>
                  <span className="tmh-name mono">{m.name}</span>
                  <span className="tmh-stats">{m.files_count} files · {(m.loc || 0).toLocaleString("en")} LOC</span>
                  <span className="tmh-arrow">&rarr;</span>
                </button>
                <div className="treemap-files mini">
                  {files
                    .sort((a, b) => getFileSize(b) - getFileSize(a))
                    .slice(0, 20)
                    .map((f) => {
                      const filePct = modTotalSize > 0 ? (getFileSize(f) / modTotalSize) * 100 : 5;
                      const color = getFileColor(f, m.name);
                      return (
                        <div
                          key={f.path}
                          className="treemap-cell-mini"
                          style={{
                            flexBasis: `${Math.max(filePct, 4)}%`,
                            flexGrow: Math.max(filePct, 4),
                            background: `${color}30`,
                            borderColor: `${color}60`,
                          }}
                          title={`${shortName(f.path)} · ${f.loc} LOC · ${f.kind}`}
                          onClick={(e) => { e.stopPropagation(); onSelectFile(f); }}
                        >
                          <span className="tcm-name mono">{shortName(f.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                        </div>
                      );
                    })}
                  {files.length > 20 && (
                    <div className="treemap-cell-mini overflow" onClick={() => onZoomModule(m.name)}>
                      <span>+{files.length - 20}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Layers View (improved architecture flow) ───
function LayersView({
  modules,
  allFiles,
  getFileColor,
  importCounts,
  onSelectFile,
  onZoomModule,
}: {
  modules: ModuleData[];
  allFiles: FileData[];
  getFileColor: (f: FileData, mod?: string) => string;
  importCounts: Record<string, number>;
  onSelectFile: (f: FileData) => void;
  onZoomModule: (name: string) => void;
}) {
  const { t } = useT();

  const byKind = useMemo(() => {
    const groups: Record<string, FileData[]> = {};
    for (const f of allFiles) {
      const k = f.kind;
      if (!groups[k]) groups[k] = [];
      groups[k].push(f);
    }
    return groups;
  }, [allFiles]);

  const kindOrder = ["page", "component", "hook", "lib", "model", "route", "schema", "test", "config", "unknown"];
  const connectorLabels: Record<string, string> = {
    page: t("map.uses"),
    component: t("map.import"),
    hook: t("map.import"),
    lib: t("map.accessTo"),
    model: "",
    route: "",
  };

  return (
    <div className="layers-view">
      {kindOrder.map((kind, ki) => {
        const files = byKind[kind];
        if (!files || files.length === 0) return null;

        // Sort by import count (most imported first)
        const sorted = [...files].sort((a, b) => (importCounts[b.path] || 0) - (importCounts[a.path] || 0));

        return (
          <div key={kind}>
            {ki > 0 && connectorLabels[kindOrder[ki - 1]] && (
              <div className="arch-connector">
                <div className="arch-connector-line"></div>
                <span className="arch-connector-label">{connectorLabels[kindOrder[ki - 1]]}</span>
                <div className="arch-connector-line"></div>
              </div>
            )}
            <div className="arch-layer">
              <div className="arch-layer-label">
                <span className="arch-dot" style={{ background: KIND_COLORS[kind] }}></span>
                {KIND_LABELS[kind] || kind} ({files.length})
              </div>
              <div className="layers-chips">
                {sorted.map((f) => {
                  const depCount = importCounts[f.path] || 0;
                  const isLarge = f.loc > 300;
                  const isHot = (f.change_frequency || 0) > 5;
                  const color = getFileColor(f);
                  // Scale chip size by LOC
                  const sizeClass = f.loc > 500 ? " xl" : f.loc > 200 ? " lg" : f.loc > 80 ? " md" : "";

                  return (
                    <button
                      key={f.path}
                      className={"layer-chip" + sizeClass + (isLarge ? " warn-large" : "") + (isHot ? " warn-hot" : "")}
                      style={{ borderColor: `${color}80`, background: `${color}12` }}
                      onClick={() => onSelectFile(f)}
                      title={`${shortName(f.path)} · ${f.loc} LOC${depCount > 0 ? ` · ${depCount} dependents` : ""}`}
                    >
                      <span className="lc-dot" style={{ background: color }}></span>
                      <span className="lc-name mono">{shortName(f.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                      <span className="lc-loc">{f.loc}</span>
                      {depCount > 0 && <span className="lc-badge">{depCount}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Module summary at bottom */}
      <div className="layers-module-summary">
        <div className="lms-label">Modules</div>
        <div className="lms-chips">
          {modules.map((m) => (
            <button key={m.name} className="lms-chip" onClick={() => onZoomModule(m.name)}>
              <span className="lms-name mono">{m.name}</span>
              <span className="lms-stats">{m.files_count} files · {(m.loc || 0).toLocaleString("en")} LOC</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Node Detail ───
function NodeDetail({
  file,
  allFiles,
  importCounts,
  getFileColor,
  onNavigate,
  onBack,
}: {
  file: FileData;
  allFiles: FileData[];
  importCounts: Record<string, number>;
  getFileColor: (f: FileData) => string;
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
        {file.complexity ? (
          <div className="fd-stat">
            <span className="fd-stat-num" style={{ color: file.complexity > 15 ? "var(--red)" : file.complexity > 8 ? "var(--yellow)" : "var(--green)" }}>{file.complexity}</span>
            <span>Complexity</span>
          </div>
        ) : null}
        {file.change_frequency ? (
          <div className="fd-stat">
            <span className="fd-stat-num">{file.change_frequency}</span>
            <span>Changes (3mo)</span>
          </div>
        ) : null}
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
                const importers = allFiles.filter(
                  (f) => f.path !== file.path && f.imports?.some(
                    (imp) => imp.specifiers?.includes(exp) || (imp.specifiers?.includes("default") && exp === "default")
                  )
                );
                return (
                  <div key={exp} className="fd-export-item">
                    <div className="fd-export-name mono">{exp}</div>
                    {importers.length > 0 ? (
                      <div className="fd-export-users">
                        {importers.map((u) => (
                          <button key={u.path} className="fd-export-user" onClick={() => onNavigate(u)}>
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
                <span className="fd-link-loc">{target.loc} LOC</span>
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
                <span className="fd-link-loc">{f.loc} LOC</span>
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
            <div className="fd-orphan">&#x26A0; {t("map.noConnections")}</div>
          </div>
        )}
      </div>

      <button className="btn-simple" style={{ marginTop: 16 }} onClick={onBack}>
        &larr; {t("map.back")}
      </button>
    </div>
  );
}
