"use client";

import { useState } from "react";
import type { ModuleData } from "@/app/page";

const W = 900, H = 540;

interface ModuleNode {
  id: string;
  name: string;
  description: string;
  paths: string[];
  files_count: number;
  loc: number;
  x: number;
  y: number;
  deps: string[];
}

function layoutModules(modules: ModuleData[]): ModuleNode[] {
  const cols = Math.ceil(Math.sqrt(modules.length));
  const rows = Math.ceil(modules.length / cols);

  return modules.map((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const xPad = 100 / (cols + 1);
    const yPad = 100 / (rows + 1);

    return {
      id: m.name,
      name: m.name,
      description: m.description,
      paths: m.paths || [],
      files_count: m.files_count || 0,
      loc: m.loc || 0,
      x: xPad * (col + 1),
      y: yPad * (row + 1),
      deps: m.dependencies?.internal || [],
    };
  });
}

function buildEdges(nodes: ModuleNode[]): [string, string][] {
  const ids = new Set(nodes.map((n) => n.id));
  const edges: [string, string][] = [];
  for (const n of nodes) {
    for (const dep of n.deps) {
      if (ids.has(dep)) {
        edges.push([n.id, dep]);
      }
    }
  }
  return edges;
}

export function MapView({ modules }: { modules: ModuleData[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (modules.length === 0) {
    return (
      <section className="map-simple">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Mapa del codebase</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F5FA;</div>
          <div className="empty-title">Sin modulos sincronizados</div>
          <div className="empty-desc">
            Ejecuta <code>npx agentnorth sync</code> para ver el mapa de tu codebase
          </div>
        </div>
      </section>
    );
  }

  const nodes = layoutModules(modules);
  const edges = buildEdges(nodes);
  const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;

  const xy = (n: { x: number; y: number }) => ({
    x: (n.x / 100) * W,
    y: (n.y / 100) * H,
  });

  return (
    <section className="map-simple">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Mapa del codebase</h2>
        <span className="meta">{modules.length} modulos · click en uno para ver detalle</span>
      </div>

      <div className="map-layout">
        <div className="map-canvas">
          <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {edges.map(([a, b], i) => {
              const na = nodes.find((n) => n.id === a);
              const nb = nodes.find((n) => n.id === b);
              if (!na || !nb) return null;
              const pa = xy(na), pb = xy(nb);
              const isActive = selected === a || selected === b;
              return (
                <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={isActive ? "var(--accent)" : "rgba(80,80,95,0.4)"}
                  strokeWidth={isActive ? 1.6 : 0.8}
                  strokeDasharray={isActive ? "0" : "3 3"} />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const p = xy(n);
            const isSelected = selected === n.id;
            return (
              <div key={n.id}
                className={"node-simple clickable" + (isSelected ? " hot" : "")}
                style={{ left: p.x, top: p.y }}
                onClick={() => setSelected(isSelected ? null : n.id)}
              >
                <div className="ns-name">{n.name}</div>
                <div className="ns-meta">
                  {n.paths.length} paths{n.loc > 0 ? ` · ${n.loc.toLocaleString("es")} LOC` : ""}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="map-aside">
          {!selectedNode ? (
            <div className="aside-card">
              <div className="aside-title">Resumen del proyecto</div>
              <div className="aside-stats">
                <div className="ast-row"><span>modulos</span><b>{nodes.length}</b></div>
                <div className="ast-row"><span>dependencias</span><b>{edges.length}</b></div>
                <div className="ast-row">
                  <span>LOC total</span>
                  <b>{nodes.reduce((s, n) => s + n.loc, 0).toLocaleString("es")}</b>
                </div>
              </div>
              <div className="aside-section">
                <div className="ast-section-title">Modulos</div>
                {nodes.map((n) => (
                  <button key={n.id} className="ast-file-link has-detail" onClick={() => setSelected(n.id)}>
                    <span className="kind-pill screen">{n.name}</span>
                    <span className="muted">{n.description}</span>
                    <span className="ast-arrow">&rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="aside-card">
              <div className="aside-title">
                <span className="mono">{selectedNode.name}</span>
              </div>
              <div className="aside-summary">{selectedNode.description}</div>
              <div className="aside-stats">
                <div className="ast-row"><span>archivos</span><b>{selectedNode.files_count}</b></div>
                <div className="ast-row"><span>LOC</span><b>{selectedNode.loc.toLocaleString("es")}</b></div>
                <div className="ast-row"><span>dependencias</span><b>{selectedNode.deps.length}</b></div>
              </div>
              {selectedNode.paths.length > 0 && (
                <div className="aside-section">
                  <div className="ast-section-title">Paths</div>
                  {selectedNode.paths.map((p) => (
                    <div key={p} className="ast-hot-row">
                      <span className="mono">{p}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedNode.deps.length > 0 && (
                <div className="aside-section">
                  <div className="ast-section-title">Depende de</div>
                  {selectedNode.deps.map((d) => (
                    <button key={d} className="ast-file-link has-detail" onClick={() => setSelected(d)}>
                      <span className="mono">{d}</span>
                      <span className="ast-arrow">&rarr;</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn-simple sm" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>
                &larr; Volver
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
