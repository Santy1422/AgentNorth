"use client";

import { useState, useMemo } from "react";
import type { DashboardData, ModuleData, FileData, DecisionData, ChangeData } from "@/app/page";
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

function shortName(path: string): string {
  return path.split("/").pop() || path;
}

export function ModuleDetail({
  moduleName,
  data,
  onBack,
  onNavigateModule,
}: {
  moduleName: string;
  data: DashboardData | null;
  onBack: () => void;
  onNavigateModule: (name: string) => void;
}) {
  const { t } = useT();
  const [tab, setTab] = useState<"overview" | "files" | "decisions" | "deps">("overview");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const mod = useMemo(
    () => (data?.project.modules || []).find((m) => m.name === moduleName) || null,
    [data, moduleName]
  );

  const allFiles = useMemo(() => {
    const seen = new Set<string>();
    return (data?.project.modules || []).flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [data]);

  const files = mod?.files || [];

  const moduleDecisions = useMemo(
    () => (data?.decisions || []).filter((d) => d.module === moduleName),
    [data, moduleName]
  );

  const moduleChanges = useMemo(
    () => (data?.changes || []).filter((c) => c.module === moduleName),
    [data, moduleName]
  );

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) counts[f.kind] = (counts[f.kind] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [files]);

  // Health checks for this module
  const health = useMemo(() => {
    const checks: { name: string; status: "pass" | "warn" | "fail"; detail: string }[] = [];
    let score = 100;

    const hasTests = files.some((f) => f.kind === "test");
    if (hasTests) checks.push({ name: "Tests", status: "pass", detail: "Has test files" });
    else { score -= 20; checks.push({ name: "Tests", status: "fail", detail: "No tests" }); }

    const largeFiles = files.filter((f) => f.loc > 300);
    if (largeFiles.length === 0) checks.push({ name: "Complexity", status: "pass", detail: "No files >300 LOC" });
    else { score -= largeFiles.length * 5; checks.push({ name: "Complexity", status: "warn", detail: `${largeFiles.length} files >300 LOC` }); }

    const documented = files.filter((f) => f.summary && f.summary.trim().length > 0).length;
    const docPct = files.length > 0 ? Math.round((documented / files.length) * 100) : 0;
    if (docPct >= 80) checks.push({ name: "Documentation", status: "pass", detail: `${docPct}% documented` });
    else if (docPct >= 40) { score -= 10; checks.push({ name: "Documentation", status: "warn", detail: `${docPct}% documented` }); }
    else { score -= 15; checks.push({ name: "Documentation", status: "fail", detail: `${docPct}% documented` }); }

    // Dead files in this module
    const deadCount = files.filter((f) => {
      if (["page", "route", "test", "config"].includes(f.kind)) return false;
      if (shortName(f.path).startsWith("index.")) return false;
      const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
      return !allFiles.some(
        (other) =>
          other.path !== f.path &&
          other.imports?.some(
            (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
          )
      );
    }).length;
    if (deadCount === 0) checks.push({ name: "Dead code", status: "pass", detail: "No orphan files" });
    else { score -= deadCount * 5; checks.push({ name: "Dead code", status: "warn", detail: `${deadCount} possible dead files` }); }

    if (moduleDecisions.length >= 2) checks.push({ name: "Decisions", status: "pass", detail: `${moduleDecisions.length} decisions logged` });
    else if (moduleDecisions.length > 0) { score -= 5; checks.push({ name: "Decisions", status: "warn", detail: `Only ${moduleDecisions.length} decision` }); }
    else { score -= 10; checks.push({ name: "Decisions", status: "fail", detail: "No decisions" }); }

    score = Math.max(0, Math.min(100, score));
    return { score, checks };
  }, [files, allFiles, moduleDecisions]);

  if (!mod) {
    return (
      <section className="md-page">
        <button className="btn-simple" onClick={onBack}>&larr; {t("mod.back")}</button>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4E6;</div>
          <div className="empty-title">{t("mod.notFound")}</div>
        </div>
      </section>
    );
  }

  const scoreColor = health.score >= 80 ? "var(--green)" : health.score >= 50 ? "var(--yellow)" : "var(--red)";

  return (
    <section className="md-page">
      {/* Header */}
      <div className="md-header">
        <button className="btn-simple" onClick={onBack}>&larr; {t("mod.back")}</button>
        <div className="md-hero">
          <div className="md-score-ring" style={{ borderColor: scoreColor }}>
            <span style={{ color: scoreColor }}>{health.score}</span>
          </div>
          <div className="md-hero-info">
            <h1 className="md-name mono">{mod.name}</h1>
            {mod.description && <p className="md-desc">{mod.description}</p>}
            <div className="md-meta">
              <span>{mod.files_count} files</span>
              <span>{(mod.loc || 0).toLocaleString("en")} LOC</span>
              <span>{mod.exports_count || 0} exports</span>
              <span>{moduleDecisions.length} decisions</span>
              <span>{moduleChanges.length} changes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="md-tabs">
        {(["overview", "files", "decisions", "deps"] as const).map((tb) => (
          <button
            key={tb}
            className={"md-tab" + (tab === tb ? " active" : "")}
            onClick={() => setTab(tb)}
          >
            {tb === "overview" ? t("mod.overview") : tb === "files" ? t("mod.filesTab", { n: files.length }) : tb === "decisions" ? t("mod.decisionsTab", { n: moduleDecisions.length }) : t("mod.depsTab")}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="md-content">
          {/* File composition */}
          <div className="card-simple" style={{ marginBottom: 16 }}>
            <div className="card-simple-head">
              <h2>{t("mod.composition")}</h2>
            </div>
            <div className="md-kind-bar">
              {kindCounts.map(([kind, count]) => {
                const pct = (count / files.length) * 100;
                return (
                  <div
                    key={kind}
                    className="cov-kind-segment"
                    style={{ width: pct + "%", background: KIND_COLORS[kind] || KIND_COLORS.unknown }}
                    title={`${kind}: ${count} (${Math.round(pct)}%)`}
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

          {/* Health checks */}
          <div className="card-simple" style={{ marginBottom: 16 }}>
            <div className="card-simple-head">
              <h2>{t("mod.scorecard")}</h2>
              <span className="meta">{t("mod.teamStandards")}</span>
            </div>
            <div className="hs-checks" style={{ paddingTop: 8 }}>
              {health.checks.map((c) => (
                <div key={c.name} className={"hs-check " + c.status}>
                  <span className="hs-check-icon">
                    {c.status === "pass" ? "\u2713" : c.status === "warn" ? "\u26A0" : "\u2717"}
                  </span>
                  <span className="hs-check-name">{c.name}</span>
                  <span className="hs-check-detail">{c.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Internal dependencies */}
          {mod.dependencies && (
            <div className="card-simple" style={{ marginBottom: 16 }}>
              <div className="card-simple-head">
                <h2>{t("mod.moduleDeps")}</h2>
              </div>
              {(mod.dependencies.internal || []).length > 0 && (
                <div className="md-dep-section">
                  <div className="md-dep-label">{t("mod.dependsOn")}</div>
                  <div className="md-dep-chips">
                    {mod.dependencies.internal.map((d) => (
                      <button key={d} className="md-dep-chip mono" onClick={() => onNavigateModule(d)}>
                        {d} &rarr;
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(() => {
                // Find who depends on this module
                const dependents = (data?.project.modules || [])
                  .filter((m) => m.dependencies?.internal?.includes(moduleName))
                  .map((m) => m.name);
                if (dependents.length === 0) return null;
                return (
                  <div className="md-dep-section">
                    <div className="md-dep-label">{t("mod.dependedOnBy")}</div>
                    <div className="md-dep-chips">
                      {dependents.map((d) => (
                        <button key={d} className="md-dep-chip mono" onClick={() => onNavigateModule(d)}>
                          {d} &rarr;
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {(mod.dependencies.external || []).length > 0 && (
                <div className="md-dep-section">
                  <div className="md-dep-label">{t("mod.extPackages")}</div>
                  <div className="md-dep-chips">
                    {mod.dependencies.external.map((d) => (
                      <span key={d} className="fd-chip ext mono">{d}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {mod.warnings && mod.warnings.length > 0 && (
            <div className="card-simple" style={{ marginBottom: 16, borderLeft: "3px solid var(--yellow)" }}>
              <div className="card-simple-head">
                <h2>{t("mod.warnings")}</h2>
                <span className="meta">{t("mod.alerts", { n: mod.warnings.length })}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                {mod.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
                    <span style={{ color: "var(--yellow)" }}>{"\u26A0"}</span>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contributors */}
          {mod.contributors && mod.contributors.length > 0 && (
            <div className="card-simple" style={{ marginBottom: 16 }}>
              <div className="card-simple-head">
                <h2>{t("mod.contributors")}</h2>
                <span className="meta">{t("mod.last6mo")}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                {mod.contributors.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, color: "var(--text-1)" }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{c.commits} {t("mod.commits")}</span>
                    {c.last_active && (
                      <span style={{ fontSize: 10, color: "var(--text-4)" }}>{c.last_active.slice(0, 10)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Git recent changes for this module */}
          {mod.recent_changes && mod.recent_changes.length > 0 && (
            <div className="card-simple" style={{ marginBottom: 16 }}>
              <div className="card-simple-head">
                <h2>{t("mod.recentCommits")}</h2>
                <span className="meta">{t("mod.nCommits", { n: mod.recent_changes.length })}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
                {mod.recent_changes.slice(0, 8).map((ch, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "3px 0" }}>
                    <span className="mono" style={{ color: "var(--accent)", fontSize: 10, minWidth: 60 }}>{ch.commit}</span>
                    <span style={{ flex: 1, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.summary}</span>
                    <span style={{ fontSize: 10, color: "var(--text-4)", minWidth: 55, textAlign: "right" }}>{ch.author}</span>
                    <span style={{ fontSize: 10, color: "var(--text-4)", minWidth: 75, textAlign: "right" }}>{ch.date?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {(moduleDecisions.length > 0 || moduleChanges.length > 0) && (
            <div className="card-simple">
              <div className="card-simple-head">
                <h2>{t("mod.recentActivity")}</h2>
              </div>
              <div className="md-activity">
                {[...moduleDecisions.map((d) => ({ type: "decision" as const, date: d.created_at, title: d.title })),
                  ...moduleChanges.map((c) => ({ type: "change" as const, date: c.created_at, title: c.summary }))
                ]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((item, i) => (
                    <div key={i} className="md-activity-row">
                      <span className={"md-activity-type " + item.type}>
                        {item.type === "decision" ? t("risks.decisionLabel") : t("risks.changeLabel")}
                      </span>
                      <span className="md-activity-title">{item.title}</span>
                      <span className="md-activity-date">{timeAgo(item.date)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Files tab */}
      {tab === "files" && (
        <div className="md-content">
          <div className="md-file-list">
            {files
              .sort((a, b) => b.loc - a.loc)
              .map((f) => {
                const isDead = (() => {
                  if (["page", "route", "test", "config"].includes(f.kind)) return false;
                  if (shortName(f.path).startsWith("index.")) return false;
                  const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
                  return !allFiles.some(
                    (other) =>
                      other.path !== f.path &&
                      other.imports?.some(
                        (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
                      )
                  );
                })();
                const isExpanded = expandedFile === f.path;
                return (
                  <div key={f.path} className={"md-file-row" + (isDead ? " dead" : "") + (f.loc > 300 ? " large" : "") + (isExpanded ? " expanded" : "")}
                    onClick={() => setExpandedFile(isExpanded ? null : f.path)}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="cov-file-kind" style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}>
                      {f.kind}
                    </span>
                    <div className="md-file-info">
                      <span className="md-file-name mono">{shortName(f.path)}</span>
                      <span className="md-file-path mono">{f.path}</span>
                    </div>
                    <span className="md-file-loc">{f.loc} LOC</span>
                    {(f.complexity || 0) > 0 && (
                      <span className="md-file-exports" style={{ color: (f.complexity || 0) > 15 ? "var(--red)" : (f.complexity || 0) > 8 ? "var(--yellow)" : "var(--text-3)" }}>
                        C:{f.complexity}
                      </span>
                    )}
                    <span className="md-file-exports">{f.exports.length} exp</span>
                    <span className="md-file-imports">{f.imports.length} imp</span>
                    {(f.change_frequency || 0) > 3 && (
                      <span className="cov-file-badge" style={{ background: "var(--accent)", color: "#000" }}>{f.change_frequency} changes</span>
                    )}
                    {isDead && <span className="cov-file-badge dead">unused</span>}
                    {f.loc > 300 && <span className="cov-file-badge large">large</span>}

                    {/* Expanded file detail panel */}
                    {isExpanded && (
                      <div className="fd-panel" onClick={(e) => e.stopPropagation()}>
                        {/* Exports */}
                        {f.exports.length > 0 && (
                          <div className="fd-section">
                            <div className="fd-section-label">{t("mod.exports")}</div>
                            <div className="fd-chips">
                              {f.exports.map((exp) => (
                                <span key={exp} className="fd-chip mono">{exp}</span>
                              ))}
                              {f.has_default_export && <span className="fd-chip default mono">default</span>}
                            </div>
                            {f.type_exports && f.type_exports.length > 0 && (
                              <div className="fd-chips" style={{ marginTop: 4 }}>
                                {f.type_exports.map((t) => (
                                  <span key={t} className="fd-chip type mono">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Imports */}
                        {f.imports.length > 0 && (
                          <div className="fd-section">
                            <div className="fd-section-label">{t("mod.imports")} ({f.imports.length})</div>
                            <div className="fd-imports">
                              {f.imports.slice(0, 15).map((imp, idx) => (
                                <div key={idx} className="fd-import-row">
                                  <span className="fd-import-source mono">{imp.source}</span>
                                  {imp.specifiers.length > 0 && (
                                    <span className="fd-import-specs">{imp.specifiers.join(", ")}</span>
                                  )}
                                </div>
                              ))}
                              {f.imports.length > 15 && (
                                <span className="fd-more">+{f.imports.length - 15} more</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Complexity + metrics */}
                        <div className="fd-section">
                          <div className="fd-section-label">{t("mod.metrics")}</div>
                          <div className="fd-metrics">
                            <div className="fd-metric">
                              <span className="fd-metric-val">{f.loc}</span>
                              <span className="fd-metric-label">{t("mod.loc")}</span>
                            </div>
                            <div className="fd-metric">
                              <span className="fd-metric-val" style={{ color: (f.complexity || 0) > 15 ? "var(--red)" : (f.complexity || 0) > 8 ? "var(--yellow)" : "var(--green)" }}>
                                {f.complexity || 0}
                              </span>
                              <span className="fd-metric-label">{t("mod.complexity")}</span>
                            </div>
                            <div className="fd-metric">
                              <span className="fd-metric-val">{f.exports.length}</span>
                              <span className="fd-metric-label">{t("mod.exports")}</span>
                            </div>
                            <div className="fd-metric">
                              <span className="fd-metric-val">{f.imports.length}</span>
                              <span className="fd-metric-label">{t("mod.imports")}</span>
                            </div>
                            {f.change_frequency != null && (
                              <div className="fd-metric">
                                <span className="fd-metric-val">{f.change_frequency}</span>
                                <span className="fd-metric-label">{t("mod.changes3mo")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* JSDoc */}
                        {f.jsdoc && f.jsdoc.length > 0 && (
                          <div className="fd-section">
                            <div className="fd-section-label">{t("mod.documentation")}</div>
                            <div className="fd-jsdoc">
                              {f.jsdoc.slice(0, 3).map((doc, i) => (
                                <div key={i} className="fd-jsdoc-entry mono">{doc}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Authors + last modified */}
                        {(f.authors?.length || f.last_modified) && (
                          <div className="fd-section">
                            <div className="fd-section-label">{t("mod.history")}</div>
                            <div className="fd-history">
                              {f.authors && f.authors.map((a) => (
                                <div key={a.author} className="fd-author">
                                  <span className="fd-author-name">{a.author}</span>
                                  <span className="fd-author-lines">{a.lines} lines</span>
                                </div>
                              ))}
                              {f.last_modified && (
                                <div className="fd-last-mod">{t("mod.lastModified")} {f.last_modified.slice(0, 10)}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        {f.summary && (
                          <div className="fd-section">
                            <div className="fd-section-label">{t("mod.summary")}</div>
                            <div className="fd-summary">{f.summary}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Decisions tab */}
      {tab === "decisions" && (
        <div className="md-content">
          {moduleDecisions.length === 0 && moduleChanges.length === 0 ? (
            <div className="empty-state">{t("mod.noDecisionsChanges")}</div>
          ) : (
            <div className="md-timeline">
              {[...moduleDecisions.map((d) => ({
                  type: "decision" as const,
                  date: d.created_at,
                  title: d.title,
                  detail: d.decision || d.context || "",
                  status: d.status,
                  author: d.author_name,
                })),
                ...moduleChanges.map((c) => ({
                  type: "change" as const,
                  date: c.created_at,
                  title: c.summary,
                  detail: c.files_changed?.join(", ") || "",
                  status: c.breaking ? "breaking" : "normal",
                  author: "",
                })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((item, i) => (
                  <div key={i} className="tl-item">
                    <div className="tl-line">
                      <div className={"tl-dot " + (item.type === "decision" ? "decision" : item.status === "breaking" ? "breaking" : "change")}></div>
                      {i < moduleDecisions.length + moduleChanges.length - 1 && <div className="tl-connector"></div>}
                    </div>
                    <div className="tl-content">
                      <div className="tl-header">
                        <span className={"tl-type " + item.type}>
                          {item.type === "decision" ? t("risks.decisionLabel") : item.status === "breaking" ? t("risks.breakingLabel") : t("risks.changeLabel")}
                        </span>
                        <span className="tl-date">{timeAgo(item.date)}</span>
                      </div>
                      <div className="tl-title">{item.title}</div>
                      {item.detail && <div className="tl-detail">{item.detail}</div>}
                      {item.author && <div className="tl-author" style={{ marginTop: 4 }}>{t("risks.by", { author: item.author })}</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Dependencies tab */}
      {tab === "deps" && (
        <div className="md-content">
          <div className="card-simple" style={{ marginBottom: 16 }}>
            <div className="card-simple-head">
              <h2>{t("mod.internalGraph")}</h2>
            </div>
            <div className="md-dep-graph">
              {files.map((f) => {
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

                if (internalDeps.length === 0) return null;

                return (
                  <div key={f.path} className="md-dep-edge">
                    <div className="md-dep-from">
                      <span className="cov-file-kind" style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown, fontSize: 9, padding: "1px 4px" }}>
                        {f.kind}
                      </span>
                      <span className="mono" style={{ fontSize: 11 }}>{shortName(f.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                    </div>
                    <span className="md-dep-arrow">{"\u2192"}</span>
                    <div className="md-dep-tos">
                      {internalDeps.map((d) => (
                        <span key={d.path} className="md-dep-to">
                          <span className="mc-kind-dot" style={{ background: KIND_COLORS[d.kind] || KIND_COLORS.unknown }}></span>
                          <span className="mono" style={{ fontSize: 11 }}>{shortName(d.path).replace(/\.(tsx?|jsx?)$/, "")}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

  if (mins < 1) return `now · ${time}`;
  if (mins < 60) return `${mins}m ago · ${time}`;
  if (isToday) return `${Math.floor(mins / 60)}h ago · ${time}`;
  if (isYesterday) return `yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}
