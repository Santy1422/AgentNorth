"use client";

import { useState, useRef, useEffect } from "react";
import type { View, ProjectRef } from "@/app/page";

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: "main", label: "Inicio" },
  { view: "map", label: "Mapa" },
  { view: "deps", label: "Deps" },
  { view: "coverage", label: "Cobertura" },
  { view: "risks", label: "Decisiones" },
  { view: "apis", label: "APIs" },
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
            <div className="ps-label">Proyectos</div>
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
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-right">
        {onRefresh && (
          <button className="refresh-btn" onClick={onRefresh} title="Actualizar ahora">
            {"\u21BB"}
          </button>
        )}
        <div className="status-pill">
          <span className={"dot" + (isLive ? " live" : "")}></span>
          {isLive ? "Conectado" : "Demo mode"}
          {lastRefresh && (
            <span className="last-refresh">
              · {formatTime(lastRefresh)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
