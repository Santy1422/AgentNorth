"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

  const results = useMemo((): SearchResult[] => {
    if (!query.trim() || !data) return [];
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

    return out.slice(0, 15);
  }, [query, data, allFiles]);

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
          />
          <button className="gs-close" onClick={() => { setIsOpen(false); setQuery(""); }}>
            ESC
          </button>
        </div>

        {query.trim() && (
          <div className="gs-results">
            {results.length > 0 ? (
              results.map((r, i) => (
                <button
                  key={`${r.type}-${r.title}-${i}`}
                  className="gs-result"
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
              ))
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
