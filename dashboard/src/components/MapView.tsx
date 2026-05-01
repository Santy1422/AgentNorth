"use client";

import { useState, useMemo } from "react";
import type { ModuleData, FileData } from "@/app/page";

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

function shortName(path: string): string {
  return path.split("/").pop() || path;
}

export function MapView({ modules }: { modules: ModuleData[] }) {
  const [drillModule, setDrillModule] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);

  const hasFiles = modules.some((m) => (m.files || []).length > 0);

  if (modules.length === 0 || !hasFiles) {
    return (
      <section className="map-simple">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Mapa del codebase</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F5FA;</div>
          <div className="empty-title">Sin archivos indexados</div>
          <div className="empty-desc">
            Ejecuta <code>npx agentnorth index</code> y luego <code>npx agentnorth sync</code>
          </div>
        </div>
      </section>
    );
  }

  const drilledModule = drillModule ? modules.find((m) => m.name === drillModule) : null;

  return (
    <section className="map-simple">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2 className="breadcrumb">
          <button className={"crumb" + (!drillModule ? " current" : "")}
            onClick={() => { setDrillModule(null); setSelectedFile(null); }}>
            Mapa
          </button>
          {drillModule && (
            <>
              <span className="crumb-sep">/</span>
              <button className={"crumb" + (!selectedFile ? " current" : "")}
                onClick={() => setSelectedFile(null)}>
                <span className="mono">{drillModule}</span>
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
          {!drillModule && `${modules.length} modulos · click en uno para explorar`}
          {drillModule && !selectedFile && `${drilledModule?.files?.length || 0} archivos · click en uno para ver detalle`}
          {selectedFile && `${selectedFile.exports.length} exports · ${selectedFile.imports.length} imports`}
        </span>
      </div>

      {!drillModule && <ModuleGrid modules={modules} onDrill={setDrillModule} />}
      {drillModule && !selectedFile && drilledModule && (
        <FileGrid module={drilledModule} allModules={modules} onSelect={setSelectedFile} />
      )}
      {selectedFile && drilledModule && (
        <FileDetail file={selectedFile} module={drilledModule} allModules={modules}
          onNavigate={(f) => setSelectedFile(f)}
          onBack={() => setSelectedFile(null)} />
      )}
    </section>
  );
}

function ModuleGrid({ modules, onDrill }: { modules: ModuleData[]; onDrill: (name: string) => void }) {
  const totalLoc = modules.reduce((s, m) => s + (m.loc || 0), 0);
  const totalFiles = modules.reduce((s, m) => s + (m.files_count || 0), 0);

  return (
    <>
      <div className="map-stats-bar">
        <span>{totalFiles} archivos</span>
        <span>·</span>
        <span>{totalLoc.toLocaleString("es")} LOC</span>
        <span>·</span>
        <span>{modules.length} modulos</span>
      </div>
      <div className="module-grid">
        {modules.map((m) => {
          const files = m.files || [];
          const kindCounts: Record<string, number> = {};
          for (const f of files) kindCounts[f.kind] = (kindCounts[f.kind] || 0) + 1;
          const pct = totalLoc > 0 ? Math.round((m.loc / totalLoc) * 100) : 0;

          return (
            <button key={m.name} className="module-card" onClick={() => onDrill(m.name)}>
              <div className="mc-head">
                <span className="mc-name mono">{m.name}</span>
                <span className="mc-arrow">&rarr;</span>
              </div>
              {m.description && <div className="mc-desc">{m.description}</div>}
              <div className="mc-bar">
                <div className="mc-bar-fill" style={{ width: pct + "%" }}></div>
              </div>
              <div className="mc-stats">
                <span>{m.files_count} archivos</span>
                <span>{(m.loc || 0).toLocaleString("es")} LOC</span>
                <span>{pct}% del total</span>
              </div>
              <div className="mc-kinds">
                {Object.entries(kindCounts).sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
                  <span key={kind} className="mc-kind">
                    <span className="mc-kind-dot" style={{ background: KIND_COLORS[kind] }}></span>
                    {count} {kind}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function FileGrid({ module, allModules, onSelect }: {
  module: ModuleData;
  allModules: ModuleData[];
  onSelect: (f: FileData) => void;
}) {
  const files = module.files || [];
  const [filterKind, setFilterKind] = useState<string>("all");

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) counts[f.kind] = (counts[f.kind] || 0) + 1;
    return counts;
  }, [files]);

  const filtered = filterKind === "all" ? files : files.filter((f) => f.kind === filterKind);
  const sorted = [...filtered].sort((a, b) => b.loc - a.loc);

  // Find connections between files
  const allFiles = allModules.flatMap((m) => m.files || []);

  return (
    <>
      <div className="map-stats-bar">
        <span>{files.length} archivos</span>
        <span>·</span>
        <span>{(module.loc || 0).toLocaleString("es")} LOC</span>
        {module.dependencies?.internal && module.dependencies.internal.length > 0 && (
          <>
            <span>·</span>
            <span>depende de: {module.dependencies.internal.join(", ")}</span>
          </>
        )}
      </div>

      <div className="cov-filters" style={{ marginBottom: 16 }}>
        <button className={"cov-filter" + (filterKind === "all" ? " active" : "")} onClick={() => setFilterKind("all")}>
          Todos ({files.length})
        </button>
        {Object.entries(kindCounts).sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
          <button key={kind} className={"cov-filter" + (filterKind === kind ? " active" : "")} onClick={() => setFilterKind(kind)}>
            <span className="mc-kind-dot" style={{ background: KIND_COLORS[kind] }}></span>
            {kind} ({count})
          </button>
        ))}
      </div>

      <div className="file-grid">
        {sorted.map((f) => {
          const incomingCount = allFiles.filter((other) =>
            other.path !== f.path && other.imports?.some((imp) => {
              const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
              return imp.source.endsWith(name) || imp.source.endsWith("/" + name);
            })
          ).length;

          return (
            <button key={f.path} className="file-card" onClick={() => onSelect(f)}>
              <div className="fc-head">
                <span className="fc-kind" style={{ background: KIND_COLORS[f.kind] }}>{f.kind}</span>
                <span className="fc-name mono">{shortName(f.path)}</span>
              </div>
              <div className="fc-stats">
                <span>{f.loc} LOC</span>
                {f.exports.length > 0 && <span>{f.exports.length} exports</span>}
                {f.imports.length > 0 && <span>{f.imports.length} imports</span>}
                {incomingCount > 0 && <span style={{ color: "var(--accent)" }}>{incomingCount} usan este</span>}
              </div>
              {f.exports.length > 0 && (
                <div className="fc-exports">
                  {f.exports.slice(0, 4).map((e) => (
                    <span key={e} className="fc-export mono">{e}</span>
                  ))}
                  {f.exports.length > 4 && <span className="fc-export muted">+{f.exports.length - 4}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function FileDetail({ file, module, allModules, onNavigate, onBack }: {
  file: FileData;
  module: ModuleData;
  allModules: ModuleData[];
  onNavigate: (f: FileData) => void;
  onBack: () => void;
}) {
  const allFiles = allModules.flatMap((m) => m.files || []);

  // Files this file imports
  const importTargets = useMemo(() => {
    const targets: { file: FileData; specifiers: string[] }[] = [];
    for (const imp of file.imports) {
      const match = allFiles.find((f) => {
        const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
        return imp.source.endsWith(name) || imp.source.endsWith("/" + name) || f.path.includes(imp.source.replace("@/", ""));
      });
      if (match && match.path !== file.path) {
        targets.push({ file: match, specifiers: imp.specifiers });
      }
    }
    return targets;
  }, [file, allFiles]);

  // Files that import this file
  const importedBy = useMemo(() => {
    const name = shortName(file.path).replace(/\.(tsx?|jsx?)$/, "");
    return allFiles.filter((f) =>
      f.path !== file.path &&
      f.imports?.some((imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name))
    );
  }, [file, allFiles]);

  // External deps
  const externalImports = file.imports.filter((imp) =>
    !imp.source.startsWith(".") && !imp.source.startsWith("@/") && !imp.source.startsWith("~")
  );

  return (
    <div className="file-detail">
      <div className="fd-header">
        <span className="fc-kind lg" style={{ background: KIND_COLORS[file.kind] }}>{file.kind}</span>
        <div>
          <div className="fd-name mono">{shortName(file.path)}</div>
          <div className="fd-path mono">{file.path}</div>
        </div>
      </div>

      <div className="fd-stats-row">
        <div className="fd-stat"><span className="fd-stat-num">{file.loc}</span><span>LOC</span></div>
        <div className="fd-stat"><span className="fd-stat-num">{file.exports.length}</span><span>exports</span></div>
        <div className="fd-stat"><span className="fd-stat-num">{importTargets.length}</span><span>importa</span></div>
        <div className="fd-stat"><span className="fd-stat-num">{importedBy.length}</span><span>lo usan</span></div>
      </div>

      <div className="fd-sections">
        {file.exports.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">Exports</div>
            <div className="fd-chips">
              {file.exports.map((e) => (
                <span key={e} className="fd-chip mono">{e}</span>
              ))}
            </div>
          </div>
        )}

        {importTargets.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">Importa de ({importTargets.length})</div>
            {importTargets.map(({ file: target, specifiers }) => (
              <button key={target.path} className="fd-link" onClick={() => onNavigate(target)}>
                <span className="mc-kind-dot" style={{ background: KIND_COLORS[target.kind] }}></span>
                <span className="mono">{shortName(target.path)}</span>
                {specifiers.length > 0 && (
                  <span className="fd-link-specs muted">{specifiers.slice(0, 3).join(", ")}</span>
                )}
                <span className="ast-arrow">&rarr;</span>
              </button>
            ))}
          </div>
        )}

        {importedBy.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">Usado por ({importedBy.length})</div>
            {importedBy.map((f) => (
              <button key={f.path} className="fd-link" onClick={() => onNavigate(f)}>
                <span className="mc-kind-dot" style={{ background: KIND_COLORS[f.kind] }}></span>
                <span className="mono">{shortName(f.path)}</span>
                <span className="ast-arrow">&rarr;</span>
              </button>
            ))}
          </div>
        )}

        {externalImports.length > 0 && (
          <div className="fd-section">
            <div className="fd-section-title">Dependencias externas ({externalImports.length})</div>
            <div className="fd-chips">
              {externalImports.map((imp) => (
                <span key={imp.source} className="fd-chip ext mono">{imp.source}</span>
              ))}
            </div>
          </div>
        )}

        {importTargets.length === 0 && importedBy.length === 0 && (
          <div className="fd-section">
            <div className="fd-orphan">
              &#x26A0; Este archivo no tiene conexiones con otros archivos del proyecto.
              Podria ser un archivo muerto.
            </div>
          </div>
        )}
      </div>

      <button className="btn-simple" style={{ marginTop: 16 }} onClick={onBack}>&larr; Volver a {module.name}</button>
    </div>
  );
}
