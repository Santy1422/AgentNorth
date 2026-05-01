"use client";

import { useState, useRef, useEffect } from "react";
import type { View, ProjectRef } from "@/app/page";

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: "main", label: "Inicio" },
  { view: "map", label: "Mapa" },
  { view: "deps", label: "Deps" },
  { view: "coverage", label: "Cobertura" },
  { view: "risks", label: "Decisiones" },
];

export function Header({
  view,
  setView,
  projects,
  activeProject,
  onSwitchProject,
  isLive,
}: {
  view: View;
  setView: (v: View) => void;
  projects: ProjectRef[];
  activeProject: ProjectRef | null;
  onSwitchProject: (p: ProjectRef) => void;
  isLive?: boolean;
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

      <div className="status-pill">
        <span className={"dot" + (isLive ? " live" : "")}></span>
        {isLive ? "Conectado" : "Demo mode"}
      </div>
    </header>
  );
}
