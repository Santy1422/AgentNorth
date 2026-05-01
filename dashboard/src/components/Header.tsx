"use client";

import type { View } from "@/app/page";

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: "main", label: "Inicio" },
  { view: "map", label: "Mapa" },
  { view: "coverage", label: "Cobertura" },
  { view: "risks", label: "Riesgos" },
  { view: "skills", label: "Skills" },
];

export function Header({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
  return (
    <header className="simple-head">
      <div className="brand">
        <div className="brand-mark">tc</div>
        <div>
          <div className="brand-name">TeamContext</div>
          <div className="brand-sub">DGuard · main</div>
        </div>
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
        <span className="dot"></span> Claude conectado
      </div>
    </header>
  );
}
