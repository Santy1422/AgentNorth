"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { View, ProjectRef } from "@/app/page";
import { useT } from "@/i18n/provider";

const NAV_ITEMS: { view: View; key: string; shortcut: string }[] = [
  { view: "main", key: "nav.home", shortcut: "1" },
  { view: "map", key: "nav.map", shortcut: "2" },
  { view: "graph", key: "nav.graph", shortcut: "3" },
  { view: "deps", key: "nav.deps", shortcut: "4" },
  { view: "coverage", key: "nav.coverage", shortcut: "5" },
  { view: "risks", key: "nav.decisions", shortcut: "6" },
  { view: "apis", key: "nav.apis", shortcut: "7" },
  { view: "onboarding", key: "nav.guide", shortcut: "8" },
];

function formatTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function Header({
  view,
  setView,
  projects,
  activeProject,
  onSwitchProject,
  isLive,
  lastRefresh,
  onRefresh,
}: {
  view: View;
  setView: (v: View) => void;
  projects: ProjectRef[];
  activeProject: ProjectRef | null;
  onSwitchProject: (p: ProjectRef) => void;
  isLive?: boolean;
  lastRefresh?: Date | null;
  onRefresh?: () => void;
}) {
  const { t, locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcuts: Alt+1-7 to switch views
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
      const item = NAV_ITEMS.find((n) => n.shortcut === e.key);
      if (item) {
        e.preventDefault();
        setView(item.view);
      }
    }
  }, [setView]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const hasMultiple = projects.length > 1;
  const displayName = activeProject?.name || "dashboard";

  return (
    <header className="simple-head">
      <div className="brand" ref={ref}>
        <div className="brand-mark">AN</div>
        <div
          className={"brand-info" + (hasMultiple ? " switchable" : "")}
          onClick={() => hasMultiple && setOpen(!open)}
        >
          <div className="brand-name">
            AgentNorth
            {hasMultiple && <span className="brand-caret">{open ? "\u25B4" : "\u25BE"}</span>}
          </div>
          <div className="brand-sub">{displayName}</div>
        </div>

        {open && hasMultiple && (
          <div className="project-switcher">
            <div className="ps-label">{t("nav.projects")}</div>
            {projects.map((p) => (
              <button
                key={p.id}
                className={"ps-item" + (p.id === activeProject?.id ? " active" : "")}
                onClick={() => {
                  onSwitchProject(p);
                  setOpen(false);
                }}
              >
                <span className="ps-dot"></span>
                <span>{p.name}</span>
                {p.id === activeProject?.id && <span className="ps-check">&#x2713;</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="simple-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={"nav-btn" + (view === item.view ? " active" : "")}
            onClick={() => setView(item.view)}
            title={`${t(item.key)} (Alt+${item.shortcut})`}
          >
            {t(item.key)}
          </button>
        ))}
      </nav>

      <div className="header-right">
        {onRefresh && (
          <button className="refresh-btn" onClick={onRefresh} title={t("status.refresh")}>
            {"\u21BB"}
          </button>
        )}
        <div className="status-pill">
          <span className={"dot" + (isLive ? " live" : "")}></span>
          {isLive ? t("status.connected") : t("status.demo")}
          {lastRefresh && (
            <span className="last-refresh">
              · {formatTime(lastRefresh)}
            </span>
          )}
        </div>
        <button className="lang-toggle" onClick={() => setLocale(locale === "en" ? "es" : "en")}>
          {locale === "en" ? "ES" : "EN"}
        </button>
      </div>
    </header>
  );
}
