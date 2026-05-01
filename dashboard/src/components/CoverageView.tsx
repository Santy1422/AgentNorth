"use client";

import { useMemo, useState } from "react";
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

export function CoverageView({ modules }: { modules: ModuleData[] }) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [showDead, setShowDead] = useState(false);

  const allFiles = useMemo(() => {
    const seen = new Set<string>();
    return modules.flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [modules]);

  const stats = useMemo(() => {
    const totalLoc = modules.reduce((s, m) => s + (m.loc || 0), 0);
    const totalFiles = modules.reduce((s, m) => s + (m.files_count || 0), 0);
    const totalExports = modules.reduce((s, m) => s + (m.exports_count || 0), 0);
    return { totalLoc, totalFiles, totalExports };
  }, [modules]);

  // Dead file detection: files that nobody imports AND have no exports used
  const deadFiles = useMemo(() => {
    const dead: FileData[] = [];
    for (const file of allFiles) {
      // Skip entry points - pages, routes, layouts, configs, tests
      if (["page", "route", "test", "config"].includes(file.kind)) continue;
      // Skip index files
      if (shortName(file.path).startsWith("index.")) continue;

      const name = shortName(file.path).replace(/\.(tsx?|jsx?)$/, "");
      const isImported = allFiles.some(
        (other) =>
          other.path !== file.path &&
          other.imports?.some(
            (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
          )
      );
      if (!isImported) dead.push(file);
    }
    return dead;
  }, [allFiles]);

  // Module health scores
  const moduleHealth = useMemo(() => {
    return modules.map((m) => {
      const files = m.files || [];
      const avgLoc = files.length > 0 ? Math.round(m.loc / files.length) : 0;
      const hasTests = files.some((f) => f.kind === "test");
      const deadInModule = deadFiles.filter((d) =>
        files.some((f) => f.path === d.path)
      ).length;
      const largeFiles = files.filter((f) => f.loc > 300).length;

      // Score 0-100
      let score = 100;
      if (!hasTests) score -= 20;
      if (deadInModule > 0) score -= deadInModule * 5;
      if (largeFiles > 0) score -= largeFiles * 5;
      if (avgLoc > 200) score -= 10;
      score = Math.max(0, Math.min(100, score));

      return {
        module: m,
        score,
        avgLoc,
        hasTests,
        deadCount: deadInModule,
        largeFiles,
      };
    });
  }, [modules, deadFiles]);

  // Kind distribution
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of allFiles) counts[f.kind] = (counts[f.kind] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allFiles]);

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
        <span className="meta">{modules.length} modulos · {allFiles.length} archivos unicos</span>
      </div>

      {/* Hero stats */}
      <div className="cov-hero">
        <div className="cov-hero-info" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div className="cov-hero-row">
            <div className="cov-num">{stats.totalFiles.toLocaleString("es")}</div>
            <div className="cov-label">archivos</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num">{stats.totalLoc.toLocaleString("es")}</div>
            <div className="cov-label">lineas</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num">{stats.totalExports.toLocaleString("es")}</div>
            <div className="cov-label">exports</div>
          </div>
          <div className="cov-hero-row">
            <div className="cov-num" style={{ color: deadFiles.length > 0 ? "var(--yellow)" : "var(--green)" }}>
              {deadFiles.length}
            </div>
            <div className="cov-label">posibles muertos</div>
          </div>
        </div>
      </div>

      {/* Documentation coverage treemap */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>Cobertura de documentacion</h2>
          <span className="meta">tamano = LOC, color = tiene summary</span>
        </div>
        <div className="treemap-grid">
          {modules
            .sort((a, b) => b.loc - a.loc)
            .map((m) => {
              const files = m.files || [];
              const documented = files.filter((f) => f.summary && f.summary.trim().length > 0).length;
              const total = files.length;
              const pct = total > 0 ? Math.round((documented / total) * 100) : 0;
              const sizePct = stats.totalLoc > 0 ? Math.max(8, (m.loc / stats.totalLoc) * 100) : 20;
              const color = pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";

              return (
                <div
                  key={m.name}
                  className="treemap-cell"
                  style={{
                    flexBasis: `${sizePct}%`,
                    flexGrow: sizePct,
                    borderColor: color,
                  }}
                  title={`${m.name}: ${pct}% documentado (${documented}/${total} archivos)`}
                >
                  <div className="treemap-name mono">{m.name}</div>
                  <div className="treemap-pct" style={{ color }}>{pct}%</div>
                  <div className="treemap-detail">{documented}/{total} archivos</div>
                </div>
              );
            })}
        </div>
      </div>

      {/* File type distribution */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>Tipos de archivo</h2>
        </div>
        <div className="cov-kind-bar">
          {kindCounts.map(([kind, count]) => {
            const pct = (count / allFiles.length) * 100;
            return (
              <div
                key={kind}
                className="cov-kind-segment"
                style={{ width: pct + "%", background: KIND_COLORS[kind] || KIND_COLORS.unknown }}
                title={`${kind}: ${count} archivos (${Math.round(pct)}%)`}
              ></div>
            );
          })}
        </div>
        <div className="cov-kind-legend">
          {kindCounts.map(([kind, count]) => (
            <span key={kind} className="cov-kind-item">
              <span className="cov-kind-dot" style={{ background: KIND_COLORS[kind] || KIND_COLORS.unknown }}></span>
              {kind} ({count})
            </span>
          ))}
        </div>
      </div>

      {/* Module health */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>Salud por modulo</h2>
          <span className="meta">click para expandir</span>
        </div>
        <div className="cov-modules">
          {moduleHealth
            .sort((a, b) => a.score - b.score)
            .map(({ module: m, score, avgLoc, hasTests, deadCount, largeFiles }) => {
              const pct = stats.totalLoc > 0 ? Math.round((m.loc / stats.totalLoc) * 100) : 0;
              const isExpanded = expandedModule === m.name;
              const scoreColor = score >= 80 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";

              return (
                <div key={m.name}>
                  <button
                    className={"cov-mod-row clickable" + (isExpanded ? " expanded" : "")}
                    onClick={() => setExpandedModule(isExpanded ? null : m.name)}
                  >
                    <div className="cov-mod-score" style={{ color: scoreColor }}>{score}</div>
                    <div className="cov-mod-name mono">{m.name}</div>
                    <div className="cov-mod-bar">
                      <div className="cov-mod-fill" style={{ width: pct + "%", background: scoreColor }}></div>
                    </div>
                    <div className="cov-mod-pct"><b>{pct}%</b></div>
                    <div className="cov-mod-files">
                      {m.files_count || 0} files · {(m.loc || 0).toLocaleString("es")} LOC
                    </div>
                    <span className="cov-mod-caret">{isExpanded ? "-" : "+"}</span>
                  </button>
                  {isExpanded && (
                    <div className="cov-mod-detail">
                      <div className="cov-mod-flags">
                        <span className={"cov-flag" + (hasTests ? " ok" : " warn")}>
                          {hasTests ? "tiene tests" : "sin tests"}
                        </span>
                        {deadCount > 0 && (
                          <span className="cov-flag warn">{deadCount} posibles muertos</span>
                        )}
                        {largeFiles > 0 && (
                          <span className="cov-flag warn">{largeFiles} archivos grandes (&gt;300 LOC)</span>
                        )}
                        <span className="cov-flag">{avgLoc} LOC promedio</span>
                      </div>
                      <div className="cov-mod-files-list">
                        {(m.files || [])
                          .sort((a, b) => b.loc - a.loc)
                          .map((f) => {
                            const isDead = deadFiles.some((d) => d.path === f.path);
                            const isLarge = f.loc > 300;
                            return (
                              <div
                                key={f.path}
                                className={
                                  "cov-file-row" + (isDead ? " dead" : "") + (isLarge ? " large" : "")
                                }
                              >
                                <span
                                  className="cov-file-kind"
                                  style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}
                                >
                                  {f.kind}
                                </span>
                                <span className="cov-file-name mono">{shortName(f.path)}</span>
                                <span className="cov-file-loc">{f.loc} LOC</span>
                                {isDead && <span className="cov-file-badge dead">sin uso</span>}
                                {isLarge && <span className="cov-file-badge large">grande</span>}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Complexity hotspots */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>Hotspots</h2>
          <span className="meta">archivos que necesitan atencion</span>
        </div>
        <div className="cov-hotspots">
          <HotspotSection
            title="Archivos mas grandes"
            files={[...allFiles].sort((a, b) => b.loc - a.loc).slice(0, 5)}
            metric={(f) => `${f.loc} LOC`}
          />
          <HotspotSection
            title="Mas importados"
            files={(() => {
              const importCounts = allFiles.map((f) => {
                const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
                const count = allFiles.filter(
                  (other) =>
                    other.path !== f.path &&
                    other.imports?.some(
                      (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
                    )
                ).length;
                return { file: f, count };
              });
              return importCounts
                .filter((x) => x.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map((x) => ({ ...x.file, _metricValue: `${x.count} dependientes` }));
            })()}
            metric={(f) => (f as FileData & { _metricValue?: string })._metricValue || ""}
          />
          <HotspotSection
            title="Mas dependencias"
            files={[...allFiles]
              .filter((f) => f.imports.length > 0)
              .sort((a, b) => b.imports.length - a.imports.length)
              .slice(0, 5)}
            metric={(f) => `${f.imports.length} imports`}
          />
        </div>
      </div>

      {/* Change Impact Analysis */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>Analisis de impacto</h2>
          <span className="meta">archivos que si cambian afectan mas</span>
        </div>
        <div className="impact-list">
          {(() => {
            // Calculate blast radius for each file
            const impacts = allFiles.map((f) => {
              const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
              // Direct dependents
              const directUsers = allFiles.filter(
                (other) =>
                  other.path !== f.path &&
                  other.imports?.some(
                    (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
                  )
              );
              // Second-level: who uses the direct users?
              const secondLevel = new Set<string>();
              for (const user of directUsers) {
                const userName = shortName(user.path).replace(/\.(tsx?|jsx?)$/, "");
                for (const other of allFiles) {
                  if (
                    other.path !== user.path &&
                    other.path !== f.path &&
                    !directUsers.some((d) => d.path === other.path) &&
                    other.imports?.some(
                      (imp) => imp.source.endsWith(userName) || imp.source.endsWith("/" + userName)
                    )
                  ) {
                    secondLevel.add(other.path);
                  }
                }
              }
              return {
                file: f,
                directCount: directUsers.length,
                totalBlast: directUsers.length + secondLevel.size,
                directUsers,
              };
            });

            return impacts
              .filter((x) => x.totalBlast > 0)
              .sort((a, b) => b.totalBlast - a.totalBlast)
              .slice(0, 8)
              .map((x) => (
                <div key={x.file.path} className="impact-row">
                  <div className="impact-bar-wrap">
                    <div
                      className="impact-bar"
                      style={{
                        width: `${Math.min(100, (x.totalBlast / allFiles.length) * 300)}%`,
                        background: x.totalBlast > 5 ? "var(--red)" : x.totalBlast > 2 ? "var(--yellow)" : "var(--green)",
                      }}
                    ></div>
                  </div>
                  <span
                    className="cov-file-kind"
                    style={{ background: KIND_COLORS[x.file.kind] || KIND_COLORS.unknown }}
                  >
                    {x.file.kind}
                  </span>
                  <span className="impact-name mono">{shortName(x.file.path)}</span>
                  <span className="impact-nums">
                    <span className="impact-direct">{x.directCount} directos</span>
                    {x.totalBlast > x.directCount && (
                      <span className="impact-total"> · {x.totalBlast} total</span>
                    )}
                  </span>
                </div>
              ));
          })()}
        </div>
      </div>

      {/* Dead files panel */}
      {deadFiles.length > 0 && (
        <div className="card-simple">
          <div className="card-simple-head">
            <h2>Archivos posiblemente muertos ({deadFiles.length})</h2>
            <button
              className="btn-simple"
              onClick={() => setShowDead(!showDead)}
              style={{ padding: "4px 12px", fontSize: 12 }}
            >
              {showDead ? "ocultar" : "ver todos"}
            </button>
          </div>
          <div className="cov-dead-desc">
            Archivos que ningun otro archivo del proyecto importa. Pueden ser archivos muertos o entry points no detectados.
          </div>
          {showDead && (
            <div className="cov-dead-list">
              {deadFiles
                .sort((a, b) => b.loc - a.loc)
                .map((f) => (
                  <div key={f.path} className="cov-file-row dead">
                    <span
                      className="cov-file-kind"
                      style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}
                    >
                      {f.kind}
                    </span>
                    <span className="cov-file-name mono">{shortName(f.path)}</span>
                    <span className="cov-file-path mono">{f.path}</span>
                    <span className="cov-file-loc">{f.loc} LOC</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HotspotSection({
  title,
  files,
  metric,
}: {
  title: string;
  files: FileData[];
  metric: (f: FileData) => string;
}) {
  if (files.length === 0) return null;
  return (
    <div className="hotspot-section">
      <div className="hotspot-title">{title}</div>
      {files.map((f, i) => (
        <div key={f.path} className="hotspot-row">
          <span className="hotspot-rank">{i + 1}</span>
          <span
            className="cov-file-kind"
            style={{
              background:
                KIND_COLORS[f.kind] || KIND_COLORS.unknown,
            }}
          >
            {f.kind}
          </span>
          <span className="hotspot-name mono">{shortName(f.path)}</span>
          <span className="hotspot-metric mono">{metric(f)}</span>
        </div>
      ))}
    </div>
  );
}
