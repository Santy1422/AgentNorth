"use client";

import { useState, useMemo } from "react";
import type { ModuleData, FileData } from "@/app/page";

const W = 960, H = 580;

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  module: string;
  loc: number;
  exports: string[];
  imports: { source: string; specifiers: string[] }[];
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  specifiers: string[];
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
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function buildGraph(modules: ModuleData[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Collect all files from all modules
  for (const mod of modules) {
    const files = mod.files || [];
    for (const f of files) {
      if (nodeMap.has(f.path)) continue;
      const node: GraphNode = {
        id: f.path,
        label: shortName(f.path),
        kind: f.kind || "unknown",
        module: mod.name,
        loc: f.loc,
        exports: f.exports || [],
        imports: f.imports || [],
        x: 0,
        y: 0,
      };
      nodes.push(node);
      nodeMap.set(f.path, node);
    }
  }

  // Build edges from imports
  const edges: GraphEdge[] = [];
  const pathIndex = new Map<string, string>();

  // Build index: filename -> full path
  for (const n of nodes) {
    const name = shortName(n.id);
    const noExt = name.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
    pathIndex.set(n.id, n.id);
    pathIndex.set(name, n.id);
    pathIndex.set(noExt, n.id);
    // Also index by @/ alias
    if (n.id.startsWith("dashboard/src/")) {
      const alias = "@/" + n.id.replace("dashboard/src/", "").replace(/\.(tsx?|jsx?)$/, "");
      pathIndex.set(alias, n.id);
    }
    if (n.id.startsWith("packages/agentnorth/src/")) {
      const relative = n.id.replace("packages/agentnorth/src/", "").replace(/\.(tsx?|jsx?)$/, "");
      pathIndex.set(relative, n.id);
    }
  }

  for (const node of nodes) {
    for (const imp of node.imports) {
      let resolved: string | undefined;
      // Try direct match
      resolved = pathIndex.get(imp.source);
      // Try resolving relative path
      if (!resolved && imp.source.startsWith(".")) {
        const dir = node.id.split("/").slice(0, -1).join("/");
        const candidate = normalizePath(dir + "/" + imp.source).replace(/\.(tsx?|jsx?|js)$/, "");
        for (const [key, val] of pathIndex) {
          if (key.replace(/\.(tsx?|jsx?|js)$/, "") === candidate ||
              val.replace(/\.(tsx?|jsx?|js)$/, "") === candidate + "/index") {
            resolved = val;
            break;
          }
        }
      }
      // Try @/ alias
      if (!resolved && imp.source.startsWith("@/")) {
        resolved = pathIndex.get(imp.source);
        if (!resolved) {
          // Try with index
          resolved = pathIndex.get(imp.source + "/index");
        }
      }
      if (resolved && resolved !== node.id && nodeMap.has(resolved)) {
        edges.push({ from: node.id, to: resolved, specifiers: imp.specifiers });
      }
    }
  }

  // Layout: group by module, then by kind
  layoutNodes(nodes, modules);

  return { nodes, edges };
}

function normalizePath(p: string): string {
  const parts = p.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== ".") out.push(part);
  }
  return out.join("/");
}

function layoutNodes(nodes: GraphNode[], modules: ModuleData[]): void {
  const moduleNames = modules.map((m) => m.name);
  const cols = Math.ceil(Math.sqrt(moduleNames.length));

  // Group nodes by module
  const groups = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const list = groups.get(n.module) || [];
    list.push(n);
    groups.set(n.module, list);
  }

  let modIdx = 0;
  for (const modName of moduleNames) {
    const modNodes = groups.get(modName) || [];
    if (modNodes.length === 0) continue;

    const col = modIdx % cols;
    const row = Math.floor(modIdx / cols);
    const rows = Math.ceil(moduleNames.length / cols);

    const xBase = ((col + 0.5) / cols) * 100;
    const yBase = ((row + 0.5) / rows) * 100;
    const spread = Math.min(40 / cols, 35 / rows);

    // Sort by kind priority, then name
    const kindOrder = ["page", "route", "component", "hook", "lib", "model", "schema", "test", "config", "unknown"];
    modNodes.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || a.label.localeCompare(b.label));

    const nodeCount = modNodes.length;
    const nodeRows = Math.ceil(Math.sqrt(nodeCount));
    const nodeCols = Math.ceil(nodeCount / nodeRows);

    modNodes.forEach((n, i) => {
      const nc = i % nodeCols;
      const nr = Math.floor(i / nodeCols);
      n.x = xBase + ((nc - (nodeCols - 1) / 2) / Math.max(nodeCols, 1)) * spread;
      n.y = yBase + ((nr - (nodeRows - 1) / 2) / Math.max(nodeRows, 1)) * spread;
      // Clamp
      n.x = Math.max(6, Math.min(94, n.x));
      n.y = Math.max(6, Math.min(94, n.y));
    });

    modIdx++;
  }
}

export function MapView({ modules }: { modules: ModuleData[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [drillModule, setDrillModule] = useState<string | null>(null);

  const allFiles = useMemo(() => modules.flatMap((m) => (m.files || []).length), [modules]);
  const hasFiles = allFiles.some((n) => n > 0);

  const { nodes, edges } = useMemo(() => {
    if (!hasFiles) return { nodes: [], edges: [] };
    if (drillModule) {
      const mod = modules.find((m) => m.name === drillModule);
      return mod ? buildGraph([mod]) : { nodes: [], edges: [] };
    }
    return buildGraph(modules);
  }, [modules, hasFiles, drillModule]);

  const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;
  const connectedIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const ids = new Set<string>();
    for (const e of edges) {
      if (e.from === selected) ids.add(e.to);
      if (e.to === selected) ids.add(e.from);
    }
    return ids;
  }, [selected, edges]);

  const moduleNames = useMemo(() => [...new Set(nodes.map((n) => n.module))], [nodes]);
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) counts[n.kind] = (counts[n.kind] || 0) + 1;
    return counts;
  }, [nodes]);

  if (modules.length === 0 || !hasFiles) {
    return (
      <section className="map-simple">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>Mapa del codebase</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F5FA;</div>
          <div className="empty-title">Sin archivos indexados</div>
          <div className="empty-desc">
            Ejecuta <code>npx agentnorth index</code> y luego <code>npx agentnorth sync</code> para mapear el codebase completo
          </div>
        </div>
      </section>
    );
  }

  const xy = (n: { x: number; y: number }) => ({
    x: (n.x / 100) * W,
    y: (n.y / 100) * H,
  });

  return (
    <section className="map-simple">
      <div className="map-head-row">
        <div className="card-simple-head" style={{ padding: "0", flex: 1 }}>
          <h2 className="breadcrumb">
            <button
              className={"crumb" + (!drillModule ? " current" : "")}
              onClick={() => { setDrillModule(null); setSelected(null); }}
            >
              Mapa
            </button>
            {drillModule && (
              <>
                <span className="crumb-sep">/</span>
                <span className="crumb current mono">{drillModule}</span>
              </>
            )}
          </h2>
          <span className="meta">
            {nodes.length} archivos · {edges.length} conexiones
            {drillModule ? " · click en Mapa para volver" : " · click en un nodo para ver detalle"}
          </span>
        </div>
      </div>

      <div className="map-layout">
        <div className="map-canvas">
          <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {edges.map((e, i) => {
              const na = nodes.find((n) => n.id === e.from);
              const nb = nodes.find((n) => n.id === e.to);
              if (!na || !nb) return null;
              const pa = xy(na), pb = xy(nb);
              const isActive = selected && (e.from === selected || e.to === selected);
              const isModuleHover = hoveredModule && (na.module === hoveredModule || nb.module === hoveredModule);
              const dim = selected && !isActive;
              return (
                <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={isActive ? "var(--accent)" : isModuleHover ? "rgba(167,139,250,0.4)" : "rgba(80,80,95,0.25)"}
                  strokeWidth={isActive ? 1.8 : 0.7}
                  opacity={dim ? 0.1 : 1} />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const p = xy(n);
            const isSelected = selected === n.id;
            const isConnected = connectedIds.has(n.id);
            const isDim = selected && !isSelected && !isConnected;
            const isModHover = hoveredModule === n.module;
            return (
              <div key={n.id}
                className={"file-node " + n.kind + (isSelected ? " active" : "") + (isModHover ? " mod-hover" : "")}
                style={{
                  left: p.x,
                  top: p.y,
                  opacity: isDim ? 0.2 : 1,
                  zIndex: isSelected ? 10 : isConnected ? 5 : 1,
                }}
                onClick={() => setSelected(isSelected ? null : n.id)}
              >
                <span className={"fn-kind " + n.kind} style={{ background: KIND_COLORS[n.kind] }}>{n.kind}</span>
                <span className="fn-name mono">{n.label}</span>
              </div>
            );
          })}
        </div>

        <aside className="map-aside">
          {!selectedNode ? (
            <div className="aside-card">
              <div className="aside-title">{drillModule || "Todo el proyecto"}</div>
              <div className="aside-stats">
                <div className="ast-row"><span>archivos</span><b>{nodes.length}</b></div>
                <div className="ast-row"><span>conexiones</span><b>{edges.length}</b></div>
                <div className="ast-row"><span>LOC total</span><b>{nodes.reduce((s, n) => s + n.loc, 0).toLocaleString("es")}</b></div>
              </div>

              <div className="aside-section">
                <div className="ast-section-title">Por tipo</div>
                {Object.entries(kindCounts).sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
                  <div key={kind} className="ast-hot-row">
                    <span className="fn-kind-dot" style={{ background: KIND_COLORS[kind] }}></span>
                    <span>{kind}</span>
                    <span className="muted" style={{ marginLeft: "auto" }}>{count}</span>
                  </div>
                ))}
              </div>

              {!drillModule && (
                <div className="aside-section">
                  <div className="ast-section-title">Modulos</div>
                  {moduleNames.map((m) => (
                    <button key={m}
                      className="ast-file-link has-detail"
                      onClick={() => { setDrillModule(m); setSelected(null); }}
                      onMouseEnter={() => setHoveredModule(m)}
                      onMouseLeave={() => setHoveredModule(null)}
                    >
                      <span className="mono">{m}</span>
                      <span className="muted">{nodes.filter((n) => n.module === m).length} files</span>
                      <span className="ast-arrow">&rarr;</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aside-card">
              <div className="aside-title">
                <span className="fn-kind" style={{ background: KIND_COLORS[selectedNode.kind], marginRight: 8 }}>{selectedNode.kind}</span>
                <span className="mono">{selectedNode.label}</span>
              </div>
              <div className="aside-path mono">{selectedNode.id}</div>
              <div className="aside-stats">
                <div className="ast-row"><span>lineas</span><b>{selectedNode.loc}</b></div>
                <div className="ast-row"><span>modulo</span><b>{selectedNode.module}</b></div>
                <div className="ast-row"><span>exports</span><b>{selectedNode.exports.length}</b></div>
                <div className="ast-row"><span>imports</span><b>{selectedNode.imports.length}</b></div>
              </div>

              {selectedNode.exports.length > 0 && (
                <div className="aside-section">
                  <div className="ast-section-title">Exports</div>
                  {selectedNode.exports.map((e) => (
                    <div key={e} className="ast-hot-row">
                      <span className="mono" style={{ fontSize: 12 }}>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {connectedIds.size > 0 && (
                <div className="aside-section">
                  <div className="ast-section-title">Conexiones ({connectedIds.size})</div>
                  {[...connectedIds].map((id) => {
                    const target = nodes.find((n) => n.id === id);
                    if (!target) return null;
                    const edge = edges.find((e) =>
                      (e.from === selected && e.to === id) || (e.to === selected && e.from === id)
                    );
                    const direction = edges.some((e) => e.from === selected && e.to === id) ? "importa" : "importado por";
                    return (
                      <button key={id} className="ast-file-link has-detail" onClick={() => setSelected(id)}>
                        <span className="fn-kind-dot" style={{ background: KIND_COLORS[target.kind] }}></span>
                        <div style={{ flex: 1 }}>
                          <span className="mono" style={{ fontSize: 12 }}>{target.label}</span>
                          <div className="muted" style={{ fontSize: 10 }}>
                            {direction}
                            {edge?.specifiers.length ? ": " + edge.specifiers.slice(0, 3).join(", ") : ""}
                          </div>
                        </div>
                        <span className="ast-arrow">&rarr;</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button className="btn-simple sm" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>
                &larr; Deseleccionar
              </button>
            </div>
          )}
        </aside>
      </div>

      <div className="map-legend">
        {Object.entries(KIND_COLORS).filter(([k]) => kindCounts[k]).map(([kind, color]) => (
          <span key={kind} className="lg-item">
            <span className="lg-dot" style={{ background: color }}></span>{kind}
          </span>
        ))}
      </div>
    </section>
  );
}
