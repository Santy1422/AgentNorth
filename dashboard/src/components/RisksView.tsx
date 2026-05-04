"use client";

import { useState, useMemo } from "react";
import type { DecisionData, ChangeData, SessionData, ModuleData, FileData } from "@/app/page";
import { useT } from "@/i18n/provider";

export function RisksView({
  decisions,
  changes,
  sessions,
  modules,
  projectName,
  onRefresh,
}: {
  decisions: DecisionData[];
  changes: ChangeData[];
  sessions?: SessionData[];
  modules?: ModuleData[];
  projectName?: string;
  onRefresh?: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [tab, setTab] = useState<"log" | "decisions" | "changes" | "grouped">("log");
  const [search, setSearch] = useState("");
  const [showNewDecision, setShowNewDecision] = useState(false);
  const [newDecision, setNewDecision] = useState({ module: "", title: "", context: "", decision: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { t } = useT();
  
  // Build file lookup for detail view
  const fileMap = useMemo(() => {
    const map = new Map<string, { file: FileData; module: string }>();
    if (!modules) return map;
    for (const m of modules) {
      for (const f of m.files || []) {
        const shortName = f.path.split("/").pop() || f.path;
        map.set(shortName, { file: f, module: m.name });
        map.set(f.path, { file: f, module: m.name });
      }
    }
    return map;
  }, [modules]);

  // Find which change explains why a file was modified
  const findChangeForFile = (filePath: string): ChangeData | null => {
    const shortName = filePath.split("/").pop() || filePath;
    return changes.find(c => c.files_changed?.some(f => f.includes(shortName))) || null;
  };

  // Build GitHub commit URL from repo_url
  const githubCommitUrl = (repoUrl: string, sha: string): string | null => {
    if (!repoUrl) return null;
    // Handle HTTPS and SSH formats
    let base = repoUrl.replace(/\.git$/, "");
    if (base.startsWith("git@")) {
      base = base.replace("git@github.com:", "https://github.com/");
    }
    return base + "/commit/" + sha;
  };

  const breakingChanges = changes.filter((c) => c.breaking);

  // Unified log: merge decisions + changes + session events into chronological feed
  const logItems = useMemo(() => {
    const items: LogItem[] = [];

    for (const d of decisions) {
      items.push({
        type: "decision",
        id: d._id,
        date: d.created_at,
        title: d.title,
        module: d.module,
        detail: d.decision || d.context || "",
        author: d.author_name,
        status: d.status,
        sessionId: null,
      });
    }

    for (const c of changes) {
      items.push({
        type: c.breaking ? "breaking" : "change",
        id: c._id,
        date: c.created_at,
        title: c.summary,
        module: c.module,
        detail: c.files_changed?.join(", ") || "",
        author: "agent",
        status: null,
        sessionId: null,
        filesCount: c.files_changed?.length || 0,
      });
    }

    // Add ALL session activity - every session is part of the Claude log
    if (sessions) {
      for (const s of sessions) {
        // Session start event — only show if it has meaningful data
        if (s.files_touched?.length || s.commit_shas?.length || s.decisions_logged || s.changes_logged) {
          items.push({
            type: "session-decisions",
            id: `session-start-${s._id}`,
            date: s.started_at,
            title: `Claude session${s.branch ? " on " + s.branch : ""}` + 
              (s.files_touched?.length ? ` — touched ${s.files_touched.length} files` : "") +
              (s.commit_shas?.length ? `, ${s.commit_shas.length} commits` : ""),
            module: s.modules_visited?.join(", ") || "",
            detail: s.files_touched?.map(f => f.split("/").pop()).join(", ") || "",
            author: s.dev_id?.name || "agent",
            status: null,
            sessionId: s._id,
            sessionData: s,
            filesCount: s.files_touched?.length || 0,
          });
        }

        // Skip session end — the start event already has all the info
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [decisions, changes, sessions]);

  
  // Group decisions by module for grouped view
  const groupedDecisions = useMemo(() => {
    const groups: Record<string, DecisionData[]> = {};
    for (const d of decisions) {
      const mod = d.module || "global";
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(d);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    if (!search.trim()) return decisions;
    const q = search.toLowerCase();
    return decisions.filter(
      (d) => d.title.toLowerCase().includes(q) || d.module?.toLowerCase().includes(q) || d.decision?.toLowerCase().includes(q) || d.author_name?.toLowerCase().includes(q)
    );
  }, [decisions, search]);

  const filteredChanges = useMemo(() => {
    if (!search.trim()) return changes;
    const q = search.toLowerCase();
    return changes.filter(
      (c) => c.summary.toLowerCase().includes(q) || c.module?.toLowerCase().includes(q) || c.files_changed?.some((f) => f.toLowerCase().includes(q))
    );
  }, [changes, search]);

  const filteredLog = useMemo(() => {
    if (!search.trim()) return logItems;
    const q = search.toLowerCase();
    return logItems.filter((item) => item.title.toLowerCase().includes(q) || item.module?.toLowerCase().includes(q) || item.detail?.toLowerCase().includes(q));
  }, [logItems, search]);

  if (decisions.length === 0 && changes.length === 0) {
    return (
      <section className="risks-view">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>{t("risks.title")}</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4CC;</div>
          <div className="empty-title">{t("risks.noData")}</div>
          <div className="empty-desc">{t("risks.noDataDesc")}</div>
          <div className="empty-hint">
            <p>Decisions are logged automatically when Claude uses <code>agentnorth_log_decision()</code>.</p>
            <p>They sync from local <code>.agentnorth/decisions/</code> files via <code>agentnorth sync</code>.</p>
            <p style={{marginTop:8}}>To create a decision manually, run:</p>
            <code style={{display:"block",marginTop:4,padding:"6px 10px",background:"var(--bg-3)",borderRadius:4}}>node packages/agentnorth/dist/bin/agentnorth.js index && node packages/agentnorth/dist/bin/agentnorth.js sync</code>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="risks-view">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>{t("risks.title")}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="meta">
            {t("risks.subtitle", { decisions: decisions.length, changes: changes.length })}
            {breakingChanges.length > 0 && (
              <span style={{ color: "var(--accent)" }}> · {t("risks.breaking", { n: breakingChanges.length })}</span>
            )}
          </span>
          {projectName && (
            <button className="ndf-trigger" onClick={() => setShowNewDecision(!showNewDecision)}>
              {t("risks.newDecision")}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="risks-summary">
        <div className="rs-card total">
          <div className="rs-num">{decisions.length}</div>
          <div className="rs-label">{t("risks.decisionsTab")}</div>
        </div>
        <div className="rs-card med">
          <div className="rs-num">{changes.length}</div>
          <div className="rs-label">{t("risks.changesTab")}</div>
        </div>
        {breakingChanges.length > 0 && (
          <div className="rs-card high">
            <div className="rs-num">{breakingChanges.length}</div>
            <div className="rs-label">{t("risks.breakingLabel")}</div>
          </div>
        )}
        {sessions && sessions.filter((s) => (s.decisions_logged || 0) > 0).length > 0 && (
          <div className="rs-card" style={{ borderLeft: "3px solid var(--accent)" }}>
            <div className="rs-num">{sessions.filter((s) => (s.decisions_logged || 0) > 0).length}</div>
            <div className="rs-label">Sessions with decisions</div>
          </div>
        )}
      </div>

      {/* New Decision Form */}
      {showNewDecision && (
        <div className="new-decision-form">
          <div className="ndf-head">
            <h3>{t("risks.newDecisionTitle")}</h3>
            <button className="btn-simple" onClick={() => setShowNewDecision(false)}>&times;</button>
          </div>
          <input className="ndf-input" placeholder={t("risks.decisionTitle")} value={newDecision.title} onChange={(e) => setNewDecision({ ...newDecision, title: e.target.value })} />
          <input className="ndf-input" placeholder={t("risks.module")} value={newDecision.module} onChange={(e) => setNewDecision({ ...newDecision, module: e.target.value })} />
          <textarea className="ndf-textarea" placeholder={t("risks.context")} value={newDecision.context} onChange={(e) => setNewDecision({ ...newDecision, context: e.target.value })} rows={3} />
          <textarea className="ndf-textarea" placeholder={t("risks.decision")} value={newDecision.decision} onChange={(e) => setNewDecision({ ...newDecision, decision: e.target.value })} rows={3} />
          <button
            className="ndf-submit"
            disabled={saving || !newDecision.title.trim()}
            onClick={async () => {
              if (!newDecision.title.trim() || !projectName) return;
              setSaving(true); setSaveError(null);
              try {
                const res = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: projectName, ...newDecision }) });
                if (res.ok) { setShowNewDecision(false); setNewDecision({ module: "", title: "", context: "", decision: "" }); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); onRefresh?.(); }
                else { const text = await res.text(); setSaveError(`Error (${res.status}): ${text}`); }
              } catch (err) { setSaveError(`${t("risks.networkError")} ${err instanceof Error ? err.message : "unknown"}`); }
              setSaving(false);
            }}
          >
            {saving ? t("risks.saving") : t("risks.create")}
          </button>
          {saveError && <div style={{ color: "var(--red)", fontSize: 11, marginTop: 6 }}>{saveError}</div>}
        </div>
      )}
      {saveSuccess && (
        <div style={{ background: "var(--green)", color: "#000", padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
          {t("risks.created")}
        </div>
      )}

      {/* Tabs */}
      <div className="risks-toolbar">
        <div className="cov-filters">
          <button className={"cov-filter" + (tab === "log" ? " active" : "")} onClick={() => setTab("log")}>
            Activity Log ({logItems.length})
          </button>
          <button className={"cov-filter" + (tab === "decisions" ? " active" : "")} onClick={() => setTab("decisions")}>
            {t("risks.decisionsTab")} ({decisions.length})
          </button>
          <button className={"cov-filter" + (tab === "changes" ? " active" : "")} onClick={() => setTab("changes")}>
            {t("risks.changesTab")} ({changes.length})
          </button>
          <button className={"cov-filter" + (tab === "grouped" ? " active" : "")} onClick={() => setTab("grouped")}>
            By Module ({groupedDecisions.length})
          </button>
        </div>
        <div className="map-search" style={{ marginLeft: "auto" }}>
          <span className="search-icon">&#x2315;</span>
          <input type="text" placeholder={t("risks.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch("")}>x</button>}
        </div>
      </div>

      {/* Activity heatmap */}
      {tab === "log" && <ActivityHeatmap decisions={decisions} changes={changes} />}

      {/* Activity Log - chronological feed */}
      {tab === "log" && (
        <div className="activity-log">
          {filteredLog.length === 0 && (
            <div className="risks-empty"><span>{t("risks.noActivity")}</span></div>
          )}
          {filteredLog.map((item) => (
            <LogItemRow key={item.id} item={item} fileMap={fileMap} selectedFile={selectedFile} setSelectedFile={setSelectedFile} findChangeForFile={findChangeForFile} githubCommitUrl={githubCommitUrl} />
          ))}
        </div>
      )}

      {/* Decisions tab */}
      {tab === "decisions" && (
        <div className="risks-list">
          {filteredDecisions.length === 0 && <div className="risks-empty"><span>{search ? t("risks.noResults") : t("risks.noDecisions")}</span></div>}
          {filteredDecisions.map((d) => <DecisionRow key={d._id} decision={d} />)}
        </div>
      )}

      {/* Changes tab */}
      {tab === "changes" && (
        <div className="risks-list">
          {filteredChanges.length === 0 && <div className="risks-empty"><span>{search ? t("risks.noResults") : t("risks.noChanges")}</span></div>}
          {filteredChanges.map((c) => <ChangeRow key={c._id} change={c} />)}
        </div>
      )}
      
      {/* Grouped by module */}
      {tab === "grouped" && (
        <div className="decisions-grouped">
          {groupedDecisions.map(([mod, decs]) => (
            <div key={mod} className="decision-group">
              <div className="decision-group-header">
                <span className="decision-group-name">{mod}</span>
                <span className="decision-group-count">{decs.length} decision{decs.length > 1 ? "s" : ""}</span>
              </div>
              <div className="decision-group-list">
                {decs.map((d) => (
                  <DecisionCard key={d._id} decision={d} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}

// ─── Types ───
interface LogItem {
  type: "decision" | "change" | "breaking" | "session-decisions" | "session-changes";
  id: string;
  date: string;
  title: string;
  module: string;
  detail: string;
  author: string;
  status: string | null;
  sessionId: string | null;
  filesCount?: number;
  sessionData?: SessionData;
}

// ─── Log Item Row (the main feed entry) ───
function LogItemRow({ item, fileMap, selectedFile, setSelectedFile, findChangeForFile, githubCommitUrl }: {
  item: LogItem;
  fileMap: Map<string, { file: FileData; module: string }>;
  selectedFile: string | null;
  setSelectedFile: (f: string | null) => void;
  findChangeForFile: (f: string) => ChangeData | null;
  githubCommitUrl: (repoUrl: string, sha: string) => string | null;
}) {
  const [open, setOpen] = useState(false);

  const typeConfig = {
    decision: { icon: "\u2713", color: "var(--green)", label: "DECISION" },
    change: { icon: "\u270E", color: "var(--accent)", label: "CHANGE" },
    breaking: { icon: "\u26A0", color: "var(--red)", label: "BREAKING" },
    "session-decisions": { icon: "\u2726", color: "#a78bfa", label: "SESSION" },
    "session-changes": { icon: "\u2726", color: "#60a5fa", label: "SESSION" },
  };

  const cfg = typeConfig[item.type];

  return (
    <div className={"log-item" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="log-item-left">
        <div className="log-item-icon" style={{ background: cfg.color }}>{cfg.icon}</div>
        <div className="log-item-line"></div>
      </div>
      <div className="log-item-content">
        <div className="log-item-header">
          <span className="log-item-badge" style={{ color: cfg.color }}>{cfg.label}</span>
          {item.module && <span className="log-item-module mono">{item.module}</span>}
          <span className="log-item-time">{formatDate(item.date)}</span>
        </div>
        <div className="log-item-title">{item.title}</div>
        {item.author && <span className="log-item-author">by {item.author}</span>}

        {/* Expanded details */}
        {open && item.detail && (
          <div className="log-item-detail">
            {item.type === "change" || item.type === "breaking" ? (
              <div className="log-item-files">
                {item.detail.split(", ").slice(0, 8).map((f) => (
                  <span key={f} className="log-item-file mono">{f.split("/").pop()}</span>
                ))}
                {(item.filesCount || 0) > 8 && <span className="log-item-file muted">+{(item.filesCount || 0) - 8} more</span>}
              </div>
            ) : (
              <div className="log-item-text">{item.detail}</div>
            )}
          </div>
        )}

        {/* Session details — show files touched prominently */}
        {open && item.sessionData && (
          <div className="log-item-session">
            {/* Model + branch tags */}
            <div className="log-item-session-meta">
              {item.sessionData.claude_model && <span className="lis-tag model">{item.sessionData.claude_model.replace("claude-", "")}</span>}
              {item.sessionData.branch && <span className="lis-tag branch">{item.sessionData.branch}</span>}
              {item.sessionData.modules_visited && item.sessionData.modules_visited.map((m) => (
                <span key={m} className="lis-tag module">{m}</span>
              ))}
              {(item.sessionData.tokens_input || 0) > 0 && (
                <span className="lis-tag">{((item.sessionData.tokens_input || 0) / 1000).toFixed(0)}K in / {((item.sessionData.tokens_output || 0) / 1000).toFixed(0)}K out</span>
              )}
              {item.sessionData.duration_mins && <span className="lis-tag">{item.sessionData.duration_mins}m</span>}
            </div>

            {/* FILES TOUCHED — this is what the user wants to see */}
            {item.sessionData.files_touched && item.sessionData.files_touched.length > 0 && (
              <div className="log-item-files-section">
                <span className="log-item-files-label">Files modified ({item.sessionData.files_touched.length}):</span>
                <div className="log-item-files-grid">
                  {item.sessionData.files_touched.map((f) => {
                      const shortName = f.split("/").pop() || f;
                      const info = fileMap.get(shortName) || fileMap.get(f);
                      return (
                        <button 
                          key={f} 
                          className={"log-item-file-tag mono clickable" + (selectedFile === f ? " selected" : "")}
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(selectedFile === f ? null : f); }}
                        >
                          {info && <span className="file-tag-kind" style={{ background: info.file.kind === "component" ? "#a78bfa" : info.file.kind === "route" ? "#f472b6" : info.file.kind === "lib" ? "#fbbf24" : info.file.kind === "model" ? "#60a5fa" : "#71717a" }}>{info.file.kind}</span>}
                          {shortName}
                        </button>
                      );
                    })}
                </div>
                {/* File detail panel */}
                {selectedFile && item.sessionData.files_touched.includes(selectedFile) && (() => {
                  const shortName = selectedFile.split("/").pop() || selectedFile;
                  const info = fileMap.get(shortName) || fileMap.get(selectedFile);
                  const change = findChangeForFile(selectedFile);
                  return (
                    <div className="file-detail-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="fdp-header">
                        <span className="fdp-path mono">{selectedFile}</span>
                        <button className="fdp-close" onClick={() => setSelectedFile(null)}>&times;</button>
                      </div>
                      {info && (
                        <div className="fdp-info">
                          <span className="fdp-badge">{info.file.kind}</span>
                          <span className="fdp-stat">{info.file.loc} LOC</span>
                          <span className="fdp-stat">module: {info.module}</span>
                          {info.file.exports?.length > 0 && <span className="fdp-stat">{info.file.exports.length} exports</span>}
                          {info.file.complexity && <span className="fdp-stat">complexity: {info.file.complexity}</span>}
                        </div>
                      )}
                      {info?.file.exports && info.file.exports.length > 0 && (
                        <div className="fdp-exports">
                          <span className="fdp-label">Exports:</span>
                          {info.file.exports.map(e => <span key={e} className="fdp-export mono">{e}</span>)}
                        </div>
                      )}
                      {change && (
                        <div className="fdp-why">
                          <span className="fdp-label">Why it changed:</span>
                          <p className="fdp-reason">{change.summary}</p>
                          {change.breaking && <span className="fdp-breaking">BREAKING CHANGE</span>}
                        </div>
                      )}
                      {!info && !change && (
                        <div className="fdp-no-info">File not in current index — may have been renamed or removed.</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Commits */}
            {item.sessionData.commit_shas && item.sessionData.commit_shas.length > 0 && (
              <div className="log-item-commits">
                <span className="log-item-files-label">Commits:</span>
                {item.sessionData.commit_shas.map((sha) => {
                    const url = item.sessionData?.repo_url ? githubCommitUrl(item.sessionData.repo_url, sha) : null;
                    return url ? (
                      <a key={sha} className="log-item-commit-sha mono" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        {sha.slice(0, 7)} ↗
                      </a>
                    ) : (
                      <span key={sha} className="log-item-commit-sha mono">{sha.slice(0, 7)}</span>
                    );
                  })}
              </div>
            )}

            {/* Tool usage summary */}
            {item.sessionData.tool_calls && Object.keys(item.sessionData.tool_calls).length > 0 && (
              <div className="log-item-tools">
                <span className="log-item-files-label">Tools used:</span>
                <div className="log-item-tools-grid">
                  {Object.entries(item.sessionData.tool_calls)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .slice(0, 6)
                    .map(([tool, count]) => (
                      <span key={tool} className="log-item-tool-tag">{tool} <strong>{count as number}</strong></span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {open && item.status && (
          <div className="log-item-status">
            <span className={"log-status-badge " + item.status}>{item.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Decision Row (expanded view) ───
function DecisionRow({ decision }: { decision: DecisionData }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const statusColor = decision.status === "active" ? "var(--green)" : decision.status === "deprecated" ? "var(--red)" : "var(--text-4)";

  return (
    <div className={"risk-row" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="risk-row-head">
        <span className="risk-pill med">{t("risks.decisionLabel")}</span>
        {decision.module && <span className="risk-kind mono">{decision.module}</span>}
        <div className="risk-title">{decision.title}</div>
        <span className="risk-status" style={{ color: statusColor }}>{decision.status}</span>
        <span className="risk-caret">{open ? "-" : "+"}</span>
      </div>
      {open && (
        <div className="risk-row-body" onClick={(e) => e.stopPropagation()}>
          {decision.decision && <div className="risk-detail">{decision.decision}</div>}
          {decision.context && (
            <div className="risk-suggest">
              <span className="risk-suggest-label">{t("risks.contextLabel")}</span>
              <span className="risk-suggest-text">{decision.context}</span>
            </div>
          )}
          <div className="risk-foot">
            <span className="risk-by mono">{t("risks.by", { author: decision.author_name })}</span>
            <span className="risk-by mono">· {formatDate(decision.created_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Change Row ───
function ChangeRow({ change }: { change: ChangeData }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className={"risk-row" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="risk-row-head">
        <span className={"risk-pill " + (change.breaking ? "high" : "low")}>
          {change.breaking ? t("risks.breakingLabel") : t("risks.changeLabel")}
        </span>
        {change.module && <span className="risk-kind mono">{change.module}</span>}
        <div className="risk-title">{change.summary}</div>
        <span className="risk-loc mono">{t("risks.filesChanged", { n: change.files_changed?.length || 0 })}</span>
        <span className="risk-caret">{open ? "-" : "+"}</span>
      </div>
      {open && change.files_changed && change.files_changed.length > 0 && (
        <div className="risk-row-body" onClick={(e) => e.stopPropagation()}>
          <div className="risk-detail">
            {change.files_changed.map((f) => (
              <div key={f} className="mono" style={{ fontSize: 12, padding: "2px 0" }}>{f}</div>
            ))}
          </div>
          <div className="risk-foot">
            <span className="risk-by mono">{formatDate(change.created_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}



// ─── Decision Card (grouped view, richer display) ───
function DecisionCard({ decision }: { decision: DecisionData }) {
  const [open, setOpen] = useState(false);
  const statusColor = decision.status === "active" ? "#4ade80" : decision.status === "deprecated" ? "#f87171" : "#a1a1aa";

  return (
    <div className={"decision-card" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
      <div className="decision-card-header">
        <div className="decision-card-status" style={{ background: statusColor }} />
        <div className="decision-card-title">{decision.title}</div>
        <span className="decision-card-date">{formatDate(decision.created_at)}</span>
      </div>
      {open && (
        <div className="decision-card-body">
          {decision.decision && (
            <div className="decision-card-text">
              <span className="decision-card-label">Decision:</span>
              <p>{decision.decision}</p>
            </div>
          )}
          {decision.context && (
            <div className="decision-card-text context">
              <span className="decision-card-label">Context:</span>
              <p>{decision.context}</p>
            </div>
          )}
          <div className="decision-card-footer">
            <span className="decision-card-author">by {decision.author_name}</span>
            <span className={"decision-card-status-badge " + decision.status}>{decision.status}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity Heatmap ───
function ActivityHeatmap({ decisions, changes }: { decisions: DecisionData[]; changes: ChangeData[] }) {
  const { t } = useT();
  const weeks = useMemo(() => {
    const now = new Date();
    const dayMs = 86400000;
    const dayCounts: Record<string, number> = {};

    for (const d of decisions) {
      const key = new Date(d.created_at).toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }
    for (const c of changes) {
      const key = new Date(c.created_at).toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }

    const weeks: { date: string; count: number }[][] = [];
    const startDay = new Date(now.getTime() - 84 * dayMs);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    for (let w = 0; w < 12; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDay.getTime() + (w * 7 + d) * dayMs);
        const key = date.toISOString().slice(0, 10);
        week.push({ date: key, count: dayCounts[key] || 0 });
      }
      weeks.push(week);
    }
    return weeks;
  }, [decisions, changes]);

  const maxCount = Math.max(1, ...weeks.flat().map((d) => d.count));

  return (
    <div className="heatmap-card">
      <div className="heatmap-label">{t("risks.activityWeeks")}</div>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap-col">
            {week.map((day) => {
              const dayDate = new Date(day.date);
              const dayLabel = dayDate.toLocaleDateString([], { month: "short", day: "numeric" });
              return (
                <div
                  key={day.date}
                  className="heatmap-cell"
                  title={`${dayLabel}: ${day.count} events`}
                  style={{
                    opacity: day.count === 0 ? 0.1 : 0.2 + (day.count / maxCount) * 0.8,
                    background: day.count === 0 ? "var(--bg-4)" : "var(--green)",
                  }}
                ></div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ───
function formatDate(dateStr: string): string {
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

function formatDuration(s: SessionData): string {
  if (s.duration_mins) {
    const m = s.duration_mins;
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  const start = new Date(s.started_at).getTime();
  const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
  const m = Math.floor((end - start) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
