"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { DashboardData, View, FileData } from "@/app/page";

interface SearchResult {
  type: "file" | "decision" | "change" | "api" | "dep";
  title: string;
  subtitle: string;
  view: View;
  color: string;
}

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

export function GlobalSearch({
  data,
  onNavigate,
}: {
  data: DashboardData | null;
  onNavigate: (view: View) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Cmd+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  const allFiles = useMemo((): FileData[] => {
    if (!data) return [];
    const seen = new Set<string>();
    return (data.project.modules || []).flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [data]);

  const { results, totalCount } = useMemo((): { results: SearchResult[]; totalCount: number } => {
    if (!query.trim() || !data) return { results: [], totalCount: 0 };
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // Search files
    for (const f of allFiles) {
      if (
        f.path.toLowerCase().includes(q) ||
        f.exports.some((e) => e.toLowerCase().includes(q)) ||
        f.kind.toLowerCase().includes(q)
      ) {
        const isApi = f.kind === "route";
        out.push({
          type: isApi ? "api" : "file",
          title: shortName(f.path),
          subtitle: `${f.kind} · ${f.loc} LOC · ${f.path}`,
          view: isApi ? "apis" : "map",
          color: KIND_COLORS[f.kind] || KIND_COLORS.unknown,
        });
      }
    }

    // Search decisions
    for (const d of data.decisions || []) {
      if (
        d.title.toLowerCase().includes(q) ||
        d.module?.toLowerCase().includes(q) ||
        d.decision?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "decision",
          title: d.title,
          subtitle: `decision · ${d.module || "global"} · ${d.status}`,
          view: "risks",
          color: "#a78bfa",
        });
      }
    }

    // Search changes
    for (const c of data.changes || []) {
      if (
        c.summary.toLowerCase().includes(q) ||
        c.module?.toLowerCase().includes(q) ||
        c.files_changed?.some((f) => f.toLowerCase().includes(q))
      ) {
        out.push({
          type: "change",
          title: c.summary,
          subtitle: `cambio · ${c.module || "global"} · ${c.files_changed?.length || 0} archivos`,
          view: "risks",
          color: c.breaking ? "#ef4444" : "#60a5fa",
        });
      }
    }

    // Search deps
    for (const dep of data.project.deps || []) {
      if (dep.name.toLowerCase().includes(q)) {
        out.push({
          type: "dep",
          title: dep.name,
          subtitle: `${dep.kind} · ${dep.version} · ${dep.source}`,
          view: "deps",
          color: dep.kind === "prod" ? "#c98b5b" : "#60a5fa",
        });
      }
    }

    return { results: out.slice(0, 15), totalCount: out.length };
  }, [query, data, allFiles]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation handler
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          onNavigate(selected.view);
          setIsOpen(false);
          setQuery("");
        }
      }
    },
    [results, selectedIndex, onNavigate],
  );

  if (!isOpen) {
    return (
      <button className="global-search-trigger" onClick={() => setIsOpen(true)}>
        <span className="gst-icon">{"\u2315"}</span>
        <span className="gst-text">Buscar...</span>
        <span className="gst-shortcut">{"\u2318"}K</span>
      </button>
    );
  }

  return (
    <>
      <div className="global-search-overlay"></div>
      <div className="global-search-container" ref={containerRef}>
        <div className="gs-input-wrap">
          <span className="gs-icon">{"\u2315"}</span>
          <input
            ref={inputRef}
            className="gs-input"
            type="text"
            placeholder="Buscar archivos, decisiones, APIs, dependencias..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button className="gs-close" onClick={() => { setIsOpen(false); setQuery(""); }}>
            ESC
          </button>
        </div>

        {query.trim() && (
          <div className="gs-results">
            {results.length > 0 ? (
              <>
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.title}-${i}`}
                    className={`gs-result${i === selectedIndex ? " selected" : ""}`}
                    style={i === selectedIndex ? { background: "var(--bg-3, #2a2a2a)" } : undefined}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => {
                      onNavigate(r.view);
                      setIsOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="gs-result-dot" style={{ background: r.color }}></span>
                    <div className="gs-result-info">
                      <span className="gs-result-title">{r.title}</span>
                      <span className="gs-result-sub">{r.subtitle}</span>
                    </div>
                    <span className="gs-result-type">{r.type}</span>
                  </button>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: "11px", color: "var(--text-3, #888)", borderTop: "1px solid var(--border, #333)" }}>
                  <span>{totalCount} resultado{totalCount !== 1 ? "s" : ""}</span>
                  {totalCount > 15 && <span>...y {totalCount - 15} m\u00e1s</span>}
                </div>
              </>
            ) : (
              <div className="gs-no-results">Sin resultados para &ldquo;{query}&rdquo;</div>
            )}
          </div>
        )}

        {!query.trim() && (
          <div className="gs-hints">
            <span>Escribe para buscar en archivos, decisiones, APIs y dependencias</span>
          </div>
        )}
      </div>
    </>
  );
}
