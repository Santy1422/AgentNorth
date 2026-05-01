"use client";

import { useState, useEffect, useMemo } from "react";
import {
  NODES, EDGES, MODULE_DETAILS, FILE_DETAILS,
  personById, type FileNode, type ModuleDetail,
} from "@/data/mock";

const W = 900, H = 540;
const xy = (n: { x: number; y: number }) => ({
  x: (n.x / 100) * W,
  y: (n.y / 100) * H,
});

export function MapView() {
  const [drill, setDrill] = useState<string | null>(null);
  const [fileDrill, setFileDrill] = useState<FileNode | null>(null);
  const [search, setSearch] = useState("");

  const detail = drill ? MODULE_DETAILS[drill] : null;

  useEffect(() => {
    if (!drill) setFileDrill(null);
  }, [drill]);

  type SearchHit = FileNode & { modId?: string };

  const searchHits = useMemo((): SearchHit[] => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    if (drill && detail) {
      return detail.files.filter((f) => f.name.toLowerCase().includes(q));
    }
    const out: SearchHit[] = [];
    Object.entries(MODULE_DETAILS).forEach(([modId, mod]) => {
      mod.files.forEach((f) => {
        if (f.name.toLowerCase().includes(q)) out.push({ ...f, modId });
      });
    });
    return out.slice(0, 8);
  }, [search, drill, detail]);

  return (
    <section className="map-simple">
      <div className="map-head-row">
        <div className="card-simple-head" style={{ padding: "0", flex: 1 }}>
          <h2 className="breadcrumb">
            <button
              className={"crumb" + (!drill ? " current" : "")}
              onClick={() => { setDrill(null); setFileDrill(null); }}
            >
              Mapa
            </button>
            {drill && (
              <>
                <span className="crumb-sep">/</span>
                <button
                  className={"crumb" + (drill && !fileDrill ? " current" : "")}
                  onClick={() => setFileDrill(null)}
                >
                  <span className="mono">{drill}</span>
                </button>
              </>
            )}
            {fileDrill && (
              <>
                <span className="crumb-sep">/</span>
                <span className="crumb current">
                  <span className="mono">{fileDrill.name}</span>
                </span>
              </>
            )}
          </h2>
          <span className="meta">
            {fileDrill
              ? fileDrill.kind + " · " + (FILE_DETAILS[fileDrill.id]?.path || "")
              : drill && detail
                ? `${detail.files.length} archivos · click en un nodo para ver mas`
                : "click en un modulo para ver dentro · 9 modulos · 3 hot zones"}
          </span>
        </div>
        <div className="map-search">
          <span className="search-icon">&#x2315;</span>
          <input
            type="text"
            placeholder={drill ? `buscar en ${drill}...` : "buscar archivo en el codebase..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>
              x
            </button>
          )}
          {searchHits.length > 0 && (
            <div className="search-results">
              {searchHits.map((h) => (
                <button
                  key={(h.modId || drill) + h.id}
                  className="search-hit"
                  onClick={() => {
                    if (h.modId && h.modId !== drill) setDrill(h.modId);
                    setFileDrill(h);
                    setSearch("");
                  }}
                >
                  <span className={"sh-kind " + h.kind}>{h.kind}</span>
                  <span className="mono">{h.name}</span>
                  {h.modId && <span className="sh-mod mono">{h.modId}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="map-layout">
        <div className="map-canvas">
          {!drill && <OverviewGraph onDrill={setDrill} />}
          {drill && !fileDrill && detail && (
            <DrillGraph detail={detail} onSelectFile={setFileDrill} />
          )}
          {fileDrill && (
            <FileDrillGraph file={fileDrill} onSelectFile={setFileDrill} />
          )}
        </div>

        <aside className="map-aside">
          {!drill && <MapOverviewPanel />}
          {drill && !fileDrill && detail && (
            <ModulePanel modId={drill} detail={detail} onSelectFile={setFileDrill} />
          )}
          {fileDrill && (
            <FilePanel
              file={fileDrill}
              onNavigate={(toId) => {
                for (const [mid, mod] of Object.entries(MODULE_DETAILS)) {
                  const f = mod.files.find((x) => x.id === toId);
                  if (f) {
                    if (mid !== drill) setDrill(mid);
                    setFileDrill(f);
                    return;
                  }
                }
              }}
            />
          )}
        </aside>
      </div>

      {!drill && (
        <div className="map-legend">
          <span className="lg-item"><span className="lg-dot frontend"></span>Frontend</span>
          <span className="lg-item"><span className="lg-dot backend"></span>Backend</span>
          <span className="lg-item"><span className="lg-dot shared"></span>Shared</span>
          <span className="lg-item"><span className="lg-dot infra"></span>Infra</span>
          <span className="lg-item"><span className="lg-dot test"></span>Tests</span>
          <span className="lg-item" style={{ marginLeft: 12 }}>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>&#x25CF;</span> hot zone
          </span>
        </div>
      )}
    </section>
  );
}

function OverviewGraph({ onDrill }: { onDrill: (id: string) => void }) {
  return (
    <>
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {EDGES.map(([a, b], i) => {
          const na = NODES.find((n) => n.id === a)!;
          const nb = NODES.find((n) => n.id === b)!;
          const pa = xy(na), pb = xy(nb);
          const isHot = na.hot && nb.hot;
          return (
            <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={isHot ? "var(--accent)" : "rgba(80,80,95,0.4)"}
              strokeWidth={isHot ? 1.4 : 0.8}
              strokeDasharray={isHot ? "0" : "3 3"} />
          );
        })}
      </svg>
      {NODES.map((n) => {
        const p = xy(n);
        const hasDetail = !!MODULE_DETAILS[n.bundle];
        return (
          <div key={n.id}
            className={"node-simple" + (n.hot ? " hot" : "") + (hasDetail ? " clickable" : "")}
            style={{ left: p.x, top: p.y }}
            onClick={() => hasDetail && onDrill(n.bundle)}
          >
            <div className="ns-name">{n.name}</div>
            <div className="ns-meta">
              {n.files} files{n.decisions ? ` · ${n.decisions} decisiones` : ""}
            </div>
            {hasDetail && <div className="ns-hint">click para abrir &rarr;</div>}
          </div>
        );
      })}
    </>
  );
}

function DrillGraph({ detail, onSelectFile }: { detail: ModuleDetail; onSelectFile: (f: FileNode) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <>
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {detail.edges.map(([a, b], i) => {
          const na = detail.files.find((n) => n.id === a);
          const nb = detail.files.find((n) => n.id === b);
          if (!na || !nb) return null;
          const pa = xy(na), pb = xy(nb);
          const active = hover && (hover === a || hover === b);
          return (
            <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={active ? "var(--accent)" : "rgba(80,80,95,0.55)"}
              strokeWidth={active ? 1.6 : 0.9} />
          );
        })}
      </svg>
      {detail.files.map((f) => {
        const p = xy(f);
        const hasDetail = !!FILE_DETAILS[f.id];
        return (
          <div key={f.id}
            className={"file-node " + f.kind + (hover === f.id ? " active" : "") + (hasDetail ? " clickable" : "")}
            style={{ left: p.x, top: p.y }}
            onMouseEnter={() => setHover(f.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => hasDetail && onSelectFile(f)}
          >
            <span className={"fn-kind " + f.kind}>{f.kind}</span>
            <span className="fn-name mono">{f.name}</span>
            {hasDetail && <span className="fn-hint">click &rarr;</span>}
          </div>
        );
      })}
      <div className="drill-legend">
        <span className="lg-item"><span className="lg-dot screen"></span>screen</span>
        <span className="lg-item"><span className="lg-dot comp"></span>componente</span>
        <span className="lg-item"><span className="lg-dot hook"></span>hook</span>
        <span className="lg-item"><span className="lg-dot lib"></span>lib</span>
        <span className="lg-item"><span className="lg-dot schema"></span>schema</span>
        <span className="lg-item"><span className="lg-dot test"></span>test</span>
      </div>
    </>
  );
}

function FileDrillGraph({ file, onSelectFile }: { file: FileNode; onSelectFile: (f: FileNode) => void }) {
  const fd = FILE_DETAILS[file.id];
  if (!fd) return null;

  const cx = W / 2, cy = H / 2;

  const positionItems = (items: string[], side: string) =>
    items.map((_, i) => {
      const total = items.length;
      const t = (i + 1) / (total + 1);
      if (side === "top") return { x: W * t, y: 90 };
      if (side === "left") return { x: 130, y: cy - 60 + i * 80 };
      if (side === "right") return { x: W - 130, y: cy - 60 + i * 80 };
      return { x: W * t, y: H - 90 };
    });

  const cps = positionItems(fd.renders, "top");
  const hps = positionItems(fd.hooks, "left");
  const lps = positionItems(fd.libs, "right");
  const nps = fd.navTo.map((_, i) => {
    const t = (i + 1) / (fd.navTo.length + 1);
    return { x: W * t, y: H - 90 };
  });

  return (
    <>
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {cps.map((p, i) => (
          <line key={"c" + i} x1={cx} y1={cy} x2={p.x} y2={p.y + 18}
            stroke="rgba(167,139,250,0.55)" strokeWidth={1} />
        ))}
        {hps.map((p, i) => (
          <line key={"h" + i} x1={cx - 90} y1={cy} x2={p.x + 60} y2={p.y + 14}
            stroke="rgba(74,222,128,0.55)" strokeWidth={1} />
        ))}
        {lps.map((p, i) => (
          <line key={"l" + i} x1={cx + 90} y1={cy} x2={p.x - 60} y2={p.y + 14}
            stroke="rgba(251,191,36,0.55)" strokeWidth={1} />
        ))}
        {nps.map((p, i) => (
          <line key={"n" + i} x1={cx} y1={cy + 24} x2={p.x} y2={p.y - 14}
            stroke="var(--accent)" strokeWidth={1.2} />
        ))}
      </svg>

      <div className="file-center" style={{ left: cx, top: cy }}>
        <span className={"fn-kind " + file.kind}>{file.kind}</span>
        <div className="fc-name mono">{file.name}</div>
        <div className="fc-summary">{fd.summary}</div>
      </div>

      {fd.renders.map((r, i) => (
        <div key={r} className="mini-node comp" style={{ left: cps[i].x, top: cps[i].y }}>
          <span className="mn-kind">renders</span>
          <span className="mn-name mono">&lt;{r} /&gt;</span>
        </div>
      ))}
      {fd.hooks.map((h, i) => (
        <div key={h} className="mini-node hook" style={{ left: hps[i].x, top: hps[i].y }}>
          <span className="mn-kind">hook</span>
          <span className="mn-name mono">{h}()</span>
        </div>
      ))}
      {fd.libs.map((l, i) => (
        <div key={l} className="mini-node lib" style={{ left: lps[i].x, top: lps[i].y }}>
          <span className="mn-kind">lib</span>
          <span className="mn-name mono">{l}</span>
        </div>
      ))}
      {fd.navTo.map((n, i) => (
        <div key={n.to} className="mini-node nav" style={{ left: nps[i].x, top: nps[i].y }}>
          <span className="mn-kind">navega</span>
          <span className="mn-name mono">&rarr; {n.to}</span>
          <span className="mn-sub">{n.label}</span>
        </div>
      ))}

      <div className="drill-legend">
        <span className="lg-item"><span className="lg-dot comp"></span>renderiza</span>
        <span className="lg-item"><span className="lg-dot hook"></span>usa hook</span>
        <span className="lg-item"><span className="lg-dot lib"></span>llama lib</span>
        <span className="lg-item"><span style={{ color: "var(--accent)" }}>&rarr;</span> navega a</span>
      </div>
    </>
  );
}

function MapOverviewPanel() {
  const totalFiles = NODES.reduce((s, n) => s + n.files, 0);
  const totalDecisions = NODES.reduce((s, n) => s + (n.decisions || 0), 0);
  const hotMods = NODES.filter((n) => n.hot);
  return (
    <div className="aside-card">
      <div className="aside-title">Resumen del codebase</div>
      <div className="aside-stats">
        <div className="ast-row"><span>modulos</span><b>{NODES.length}</b></div>
        <div className="ast-row"><span>archivos totales</span><b>{totalFiles.toLocaleString("es")}</b></div>
        <div className="ast-row"><span>decisiones fijadas</span><b>{totalDecisions}</b></div>
        <div className="ast-row"><span>hot zones</span><b style={{ color: "var(--accent)" }}>{hotMods.length}</b></div>
      </div>
      <div className="aside-section">
        <div className="ast-section-title">Hot zones</div>
        {hotMods.map((m) => (
          <div key={m.id} className="ast-hot-row">
            <span className="ast-hot-dot"></span>
            <span className="mono">{m.bundle}</span>
            <span className="muted">{m.files} archivos</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModulePanel({ modId, detail, onSelectFile }: { modId: string; detail: ModuleDetail; onSelectFile: (f: FileNode) => void }) {
  const node = NODES.find((n) => n.bundle === modId);
  const screens = detail.files.filter((f) => f.kind === "screen");
  return (
    <div className="aside-card">
      <div className="aside-title"><span className="mono">{modId}</span></div>
      <div className="aside-sub">{node?.name}</div>
      <div className="aside-stats">
        <div className="ast-row"><span>archivos en mapa</span><b>{detail.files.length}</b></div>
        <div className="ast-row"><span>archivos totales</span><b>{node?.files}</b></div>
        {node?.decisions && <div className="ast-row"><span>decisiones</span><b>{node.decisions}</b></div>}
        {node?.hot && <div className="ast-row"><span>actividad</span><b style={{ color: "var(--accent)" }}>hot zone</b></div>}
      </div>
      {screens.length > 0 && (
        <div className="aside-section">
          <div className="ast-section-title">Screens</div>
          {screens.map((s) => {
            const has = !!FILE_DETAILS[s.id];
            return (
              <button key={s.id}
                className={"ast-file-link" + (has ? " has-detail" : "")}
                disabled={!has}
                onClick={() => has && onSelectFile(s)}
              >
                <span className="kind-pill screen">screen</span>
                <span className="mono">{s.name}</span>
                {has && <span className="ast-arrow">&rarr;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilePanel({ file, onNavigate }: { file: FileNode; onNavigate: (toId: string) => void }) {
  const fd = FILE_DETAILS[file.id];
  if (!fd) return null;
  const owner = personById(fd.owner);
  return (
    <div className="aside-card">
      <div className="aside-title">
        <span className={"fn-kind " + file.kind} style={{ marginRight: 8 }}>{file.kind}</span>
        <span className="mono">{file.name}</span>
      </div>
      <div className="aside-path mono">{fd.path}</div>
      <div className="aside-summary">{fd.summary}</div>
      <div className="aside-stats">
        <div className="ast-row"><span>lineas</span><b>{fd.lines}</b></div>
        <div className="ast-row"><span>owner</span><b>{owner?.name}</b></div>
        <div className="ast-row">
          <span>ultimo cambio</span>
          <b>
            {fd.lastChange}
            {fd.changedBy === "claude" && <span className="by-claude"> · por Claude</span>}
          </b>
        </div>
      </div>
      {fd.notes && (
        <div className="aside-section">
          <div className="ast-section-title">Notas</div>
          <div className="ast-notes">{fd.notes}</div>
        </div>
      )}
      {fd.decisions.length > 0 && (
        <div className="aside-section">
          <div className="ast-section-title">Decisiones aplicables</div>
          {fd.decisions.map((d, i) => (
            <div key={i} className="ast-decision">
              <span>&#x1F4CC;</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      )}
      {fd.navTo.length > 0 && (
        <div className="aside-section">
          <div className="ast-section-title">Navega a</div>
          {fd.navTo.map((n, i) => (
            <button key={i}
              className="ast-file-link nav has-detail"
              onClick={() => onNavigate(n.to)}
            >
              <span style={{ color: "var(--accent)" }}>&rarr;</span>
              <span className="mono">{n.to}</span>
              <span className="muted">{n.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
