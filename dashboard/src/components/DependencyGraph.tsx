"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { ModuleData } from "@/app/page";

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  mod: ModuleData;
  score: number;
}
interface Edge {
  source: string;
  target: string;
}

function calcHealth(m: ModuleData): number {
  const files = m.files || [];
  const avgLoc = files.length > 0 ? Math.round(m.loc / files.length) : 0;
  const hasTests = files.some((f) => f.kind === "test");
  const largeFiles = files.filter((f) => f.loc > 300).length;
  let score = 100;
  if (!hasTests) score -= 20;
  if (largeFiles > 0) score -= largeFiles * 5;
  if (avgLoc > 200) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function healthColor(s: number): string {
  if (s > 80) return "#4ade80";
  if (s > 50) return "#fbbf24";
  return "#f87171";
}

function nodeRadius(loc: number, maxLoc: number): number {
  const t = maxLoc > 0 ? loc / maxLoc : 0;
  return 20 + t * 40;
}

export function DependencyGraph({ modules }: { modules: ModuleData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [cam, setCam] = useState({ x: 0, y: 0, zoom: 1 });
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Build graph data
  const { nodes, edges } = useMemo(() => {
    const maxLoc = Math.max(...modules.map((m) => m.loc), 1);
    const nameSet = new Set(modules.map((m) => m.name));
    const ns: Node[] = modules.map((m, i) => {
      const angle = (2 * Math.PI * i) / modules.length;
      const spread = 160;
      const score = calcHealth(m);
      return {
        id: m.name,
        x: Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
        y: Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
        r: nodeRadius(m.loc, maxLoc),
        color: healthColor(score),
        mod: m,
        score,
      };
    });
    const es: Edge[] = [];
    for (const m of modules) {
      for (const dep of m.dependencies?.internal || []) {
        if (nameSet.has(dep) && dep !== m.name) {
          es.push({ source: m.name, target: dep });
        }
      }
    }
    return { nodes: ns, edges: es };
  }, [modules]);

  // Force simulation on mount
  useEffect(() => {
    const ns = nodes.map((n) => ({ ...n }));
    const es = edges;
    const nodeMap = new Map(ns.map((n) => [n.id, n]));

    for (let iter = 0; iter < 120; iter++) {
      const alpha = 0.3 * (1 - iter / 120);
      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          let dx = ns[j].x - ns[i].x;
          let dy = ns[j].y - ns[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 4000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx -= fx; ns[i].vy -= fy;
          ns[j].vx += fx; ns[j].vy += fy;
        }
      }
      // Attraction along edges
      for (const e of es) {
        const s = nodeMap.get(e.source)!;
        const t = nodeMap.get(e.target)!;
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.005;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }
      // Gravity toward center
      for (const n of ns) {
        n.vx -= n.x * 0.002;
        n.vy -= n.y * 0.002;
        n.x += n.vx * alpha;
        n.y += n.vy * alpha;
        n.vx *= 0.6;
        n.vy *= 0.6;
      }
    }
    nodesRef.current = ns;
    edgesRef.current = es;
    draw();
  }, [nodes, edges]);

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d")!;
    const w = cvs.width;
    const h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    const ns = nodesRef.current;
    const es = edgesRef.current;
    const nodeMap = new Map(ns.map((n) => [n.id, n]));

    const connectedToHover = new Set<string>();
    if (hovered) {
      connectedToHover.add(hovered);
      for (const e of es) {
        if (e.source === hovered) connectedToHover.add(e.target);
        if (e.target === hovered) connectedToHover.add(e.source);
      }
    }

    // Edges
    for (const e of es) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const isHl = hovered && (e.source === hovered || e.target === hovered);
      const dimmed = hovered && !isHl;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = isHl ? "#a78bfa" : dimmed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = isHl ? 2 : 1;
      ctx.stroke();
    }

    // Nodes
    for (const n of ns) {
      const dimmed = hovered && !connectedToHover.has(n.id);
      const globalAlpha = dimmed ? 0.2 : 1;
      ctx.globalAlpha = globalAlpha;
      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = globalAlpha * 0.25;
      ctx.fill();
      ctx.globalAlpha = globalAlpha;
      ctx.strokeStyle = n.color;
      ctx.lineWidth = selected?.id === n.id ? 3 : 1.5;
      ctx.stroke();
      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.id, n.x, n.y + n.r + 14);
      ctx.globalAlpha = 1;
    }

    // Legend (top-right in screen space)
    ctx.restore();
    ctx.save();
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    const lx = w - 130;
    ctx.fillText("Size = LOC", lx, 20);
    ctx.fillStyle = "#4ade80"; ctx.fillRect(lx, 28, 8, 8);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillText("Health > 80", lx + 14, 36);
    ctx.fillStyle = "#fbbf24"; ctx.fillRect(lx, 42, 8, 8);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillText("Health > 50", lx + 14, 50);
    ctx.fillStyle = "#f87171"; ctx.fillRect(lx, 56, 8, 8);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillText("Health < 50", lx + 14, 64);
    ctx.restore();
  }, [cam, hovered, selected]);

  useEffect(() => { draw(); }, [draw]);

  const screenToWorld = useCallback((cx: number, cy: number) => {
    const cvs = canvasRef.current!;
    return {
      wx: (cx - cvs.width / 2 - cam.x) / cam.zoom,
      wy: (cy - cvs.height / 2 - cam.y) / cam.zoom,
    };
  }, [cam]);

  const hitTest = useCallback((cx: number, cy: number): Node | null => {
    const { wx, wy } = screenToWorld(cx, cy);
    for (const n of nodesRef.current) {
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= n.r * n.r) return n;
    }
    return null;
  }, [screenToWorld]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);
    if (drag) {
      const { wx, wy } = screenToWorld(cx, cy);
      const n = nodesRef.current.find((n) => n.id === drag.id);
      if (n) { n.x = wx; n.y = wy; draw(); }
      return;
    }
    const hit = hitTest(cx, cy);
    setHovered(hit ? hit.id : null);
    canvasRef.current!.style.cursor = hit ? "pointer" : "default";
  }, [drag, hitTest, screenToWorld, draw]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);
    const hit = hitTest(cx, cy);
    if (hit) {
      setDrag({ id: hit.id, ox: 0, oy: 0 });
      setSelected(hit);
    }
  }, [hitTest]);

  const onMouseUp = useCallback(() => { setDrag(null); }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCam((c) => ({ ...c, zoom: Math.max(0.3, Math.min(3, c.zoom - e.deltaY * 0.001)) }));
  }, []);

  // Resize
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const resize = () => {
      const par = cvs.parentElement!;
      cvs.width = par.clientWidth * 2;
      cvs.height = 1000;
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 500, borderRadius: 8 }}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        />
      </div>
      {selected && (
        <div style={{
          width: 260, padding: 16, background: "rgba(255,255,255,0.04)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
          fontSize: 13, color: "#e5e5e5", flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>{selected.mod.name}</strong>
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16,
            }}>x</button>
          </div>
          {selected.mod.description && (
            <p style={{ color: "#aaa", fontSize: 12, margin: "0 0 12px" }}>{selected.mod.description}</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              ["Files", String(selected.mod.files_count)],
              ["LOC", String(selected.mod.loc)],
              ["Exports", String(selected.mod.exports_count)],
              ["Health", `${selected.score}`],
            ].map(([label, val]) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: label === "Health" ? selected.color : "#fff" }}>{val}</div>
              </div>
            ))}
          </div>
          {(selected.mod.dependencies?.internal?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Internal deps</div>
              {selected.mod.dependencies!.internal.map((d) => (
                <div key={d} style={{
                  fontSize: 12, fontFamily: "monospace", padding: "2px 0",
                  color: nodesRef.current.find((n) => n.id === d) ? "#a78bfa" : "#888",
                  cursor: nodesRef.current.find((n) => n.id === d) ? "pointer" : "default",
                }} onClick={() => {
                  const node = nodesRef.current.find((n) => n.id === d);
                  if (node) setSelected(node);
                }}>{d}</div>
              ))}
            </div>
          )}
          {(selected.mod.dependencies?.external?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>External deps</div>
              {selected.mod.dependencies!.external.map((d) => (
                <div key={d} style={{ fontSize: 12, fontFamily: "monospace", padding: "2px 0", color: "#60a5fa" }}>{d}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
