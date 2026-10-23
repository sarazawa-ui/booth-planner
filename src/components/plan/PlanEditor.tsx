import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import PlanContent from './PlanContent';
import { defOf } from '../../catalog';
import { fmtMm, fromLocal, normDeg, snap, toLocal, wallLen } from '../../lib/geom';
import { importDroppedFiles } from '../../lib/importer';
import type { Item, Wall } from '../../types';

interface View {
  tx: number;
  ty: number;
  s: number;
}

type Drag =
  | { mode: 'pan'; sx: number; sy: number; v: View; moved: boolean }
  | { mode: 'item'; id: string; ox: number; oy: number; moved: boolean; sx: number; sy: number }
  | { mode: 'wall'; id: string; wx: number; wy: number; orig: Wall; moved: boolean; sx: number; sy: number }
  | { mode: 'wallEnd'; id: string; end: 1 | 2; moved: boolean }
  | { mode: 'rotate'; id: string; moved: boolean }
  | { mode: 'resize'; id: string; orig: Item; moved: boolean };

export default function PlanEditor() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const snapStep = useStore((s) => s.snapStep);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ tx: 80, ty: 80, s: 0.1 });
  const fitted = useRef(false);
  const userMoved = useRef(false);
  const drag = useRef<Drag | null>(null);
  const [draw, setDraw] = useState<{ start: { x: number; y: number } | null; cur: { x: number; y: number } | null }>({ start: null, cur: null });
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const { booth } = useStore.getState().project;
    const W = el.clientWidth;
    const H = el.clientHeight;
    // 寸法線・通路表示の余白(狭いペインでは詰める)
    const pad = Math.max(36, Math.min(90, Math.min(W, H) * 0.14));
    const s = Math.min((W - pad * 2) / booth.w, (H - pad * 2) / booth.d);
    setView({ s, tx: (W - booth.w * s) / 2, ty: (H - booth.d * s) / 2 });
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      // 手でズーム/パンするまではペインの大きさに合わせて全体表示を保つ
      if (!userMoved.current && el.clientWidth > 0) {
        fitted.current = true;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // 小間サイズを変えたら自動で全体表示
  const bw = project.booth.w;
  const bd = project.booth.d;
  useEffect(() => {
    if (fitted.current) fit();
  }, [bw, bd, fit]);

  useEffect(() => {
    if (tool !== 'wall') setDraw({ start: null, cur: null });
  }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraw({ start: null, cur: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const k = 1 / view.s;

  const toWorld = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.tx) / view.s, y: (clientY - r.top - view.ty) / view.s };
  };

  /** 壁の端点吸着 → グリッド吸着 → 直交補正 */
  const snapPoint = (p: { x: number; y: number }, from: { x: number; y: number } | null, free: boolean, excludeId?: string) => {
    const tol = 12 * k;
    for (const w of useStore.getState().project.walls) {
      if (w.id === excludeId) continue;
      for (const q of [
        { x: w.x1, y: w.y1 },
        { x: w.x2, y: w.y2 },
      ]) {
        if (Math.hypot(q.x - p.x, q.y - p.y) < tol) return q;
      }
    }
    let x = snap(p.x, snapStep);
    let y = snap(p.y, snapStep);
    if (from && !free) {
      const dx = x - from.x;
      const dy = y - from.y;
      const ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90;
      if (ang < 10 || ang > 80) {
        if (Math.abs(dx) > Math.abs(dy)) y = from.y;
        else x = from.x;
      }
    }
    return { x, y };
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    userMoved.current = true;
    const f = Math.exp(-e.deltaY * 0.0015);
    const s = Math.min(2, Math.max(0.01, view.s * f));
    setView({ s, tx: mx - ((mx - view.tx) / view.s) * s, ty: my - ((my - view.ty) / view.s) * s });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const st = useStore.getState();
    const target = (e.target as Element).closest('[data-hit]') as HTMLElement | null;
    const hit = target?.dataset.hit;
    const id = target?.dataset.id ?? '';
    const p = toWorld(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    if (e.button === 1 || (tool === 'select' && !hit)) {
      drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: view, moved: false };
      return;
    }
    if (tool === 'wall') {
      const q = snapPoint(p, draw.start, e.shiftKey);
      if (!draw.start) {
        setDraw({ start: q, cur: q });
      } else {
        if (Math.hypot(q.x - draw.start.x, q.y - draw.start.y) > 50) {
          st.addWall({ x1: draw.start.x, y1: draw.start.y, x2: q.x, y2: q.y });
          setDraw({ start: q, cur: q });
        }
      }
      return;
    }
    if (hit === 'item') {
      st.select({ type: 'item', id });
      const it = st.project.items.find((i) => i.id === id)!;
      drag.current = { mode: 'item', id, ox: p.x - it.x, oy: p.y - it.y, moved: false, sx: e.clientX, sy: e.clientY };
    } else if (hit === 'wall') {
      st.select({ type: 'wall', id });
      const w = st.project.walls.find((i) => i.id === id)!;
      drag.current = { mode: 'wall', id, wx: p.x, wy: p.y, orig: { ...w }, moved: false, sx: e.clientX, sy: e.clientY };
    } else if (hit === 'wallEnd') {
      drag.current = { mode: 'wallEnd', id, end: target!.dataset.end === '2' ? 2 : 1, moved: false };
    } else if (hit === 'rotate') {
      drag.current = { mode: 'rotate', id, moved: false };
    } else if (hit === 'resize') {
      const it = st.project.items.find((i) => i.id === id)!;
      drag.current = { mode: 'resize', id, orig: { ...it }, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toWorld(e.clientX, e.clientY);
    if (tool === 'wall') {
      const q = snapPoint(p, draw.start, e.shiftKey);
      setHoverPt(q);
      if (draw.start) setDraw((d) => ({ ...d, cur: q }));
    }
    const d = drag.current;
    if (!d) return;
    const st = useStore.getState();
    const firstMove = () => {
      if (!d.moved) {
        d.moved = true;
        if (d.mode !== 'pan') st.checkpoint();
      }
    };
    switch (d.mode) {
      case 'pan': {
        d.moved = true;
        userMoved.current = true;
        setView({ ...d.v, tx: d.v.tx + e.clientX - d.sx, ty: d.v.ty + e.clientY - d.sy });
        break;
      }
      case 'item': {
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
        firstMove();
        st.moveItem(d.id, p.x - d.ox, p.y - d.oy, e.altKey);
        break;
      }
      case 'wall': {
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
        firstMove();
        const dx = snap(p.x - d.wx, snapStep);
        const dy = snap(p.y - d.wy, snapStep);
        st.updateWall(d.id, { x1: d.orig.x1 + dx, y1: d.orig.y1 + dy, x2: d.orig.x2 + dx, y2: d.orig.y2 + dy }, false);
        break;
      }
      case 'wallEnd': {
        firstMove();
        const w = st.project.walls.find((i) => i.id === d.id);
        if (!w) return;
        const other = d.end === 1 ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 };
        const q = snapPoint(p, other, e.shiftKey, d.id);
        st.updateWall(d.id, d.end === 1 ? { x1: q.x, y1: q.y } : { x2: q.x, y2: q.y }, false);
        break;
      }
      case 'rotate': {
        firstMove();
        const it = st.project.items.find((i) => i.id === d.id);
        if (!it) return;
        let deg = (Math.atan2(p.x - it.x, -(p.y - it.y)) * 180) / Math.PI;
        if (!e.shiftKey) deg = Math.round(deg / 15) * 15;
        st.updateItem(d.id, { rot: normDeg(deg) }, false);
        break;
      }
      case 'resize': {
        firstMove();
        const o = d.orig;
        const def = defOf(o.kind);
        const loc = toLocal(o, p.x, p.y);
        const fixedU = -o.w / 2;
        const fixedV = -o.d / 2;
        let w = def.resizable?.includes('w') ? Math.max(50, snap(loc.u - fixedU, 10)) : o.w;
        let dd = def.resizable?.includes('d') ? Math.max(5, snap(loc.v - fixedV, 10)) : o.d;
        if (def.round) {
          w = Math.max(w, dd);
          dd = w;
        } else if (!def.resizable?.includes('d')) dd = o.d;
        const c = fromLocal(o, fixedU + w / 2, fixedV + dd / 2);
        st.updateItem(d.id, { w, d: dd, x: Math.round(c.x), y: Math.round(c.y) }, false);
        break;
      }
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'pan' && !d.moved && tool === 'select') useStore.getState().select(null);
  };

  const endDraw = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setDraw({ start: null, cur: null });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    const kind = e.dataTransfer.getData('text/x-booth-kind');
    if (kind) {
      useStore.getState().addItem(kind, Math.round(p.x), Math.round(p.y));
      return;
    }
    if (e.dataTransfer.files.length) importDroppedFiles(e.dataTransfer.files, { x: Math.round(p.x), y: Math.round(p.y) });
  };

  const selItem = selection?.type === 'item' ? project.items.find((i) => i.id === selection.id) : undefined;
  const selWall = selection?.type === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;

  return (
    <div
      ref={wrapRef}
      className="plan-wrap"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{ cursor: tool === 'wall' ? 'crosshair' : undefined }}
    >
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverPt(null)}
        onDoubleClick={endDraw}
        onContextMenu={endDraw}
      >
        <rect width={size.w} height={size.h} fill="#eef0f2" />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <PlanContent project={project} k={k} selection={selection} />

          {selItem && <ItemHandles it={selItem} k={k} />}
          {selWall && (
            <g>
              {[1, 2].map((end) => (
                <circle
                  key={end}
                  data-hit="wallEnd"
                  data-id={selWall.id}
                  data-end={end}
                  cx={end === 1 ? selWall.x1 : selWall.x2}
                  cy={end === 1 ? selWall.y1 : selWall.y2}
                  r={6 * k}
                  fill="#fff"
                  stroke="#d6581f"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'grab' }}
                />
              ))}
            </g>
          )}

          {tool === 'wall' && draw.start && draw.cur && (
            <g pointerEvents="none">
              <line x1={draw.start.x} y1={draw.start.y} x2={draw.cur.x} y2={draw.cur.y} stroke="#d6581f" strokeWidth={project.booth.style === 'wood' ? 100 : 50} strokeOpacity={0.45} />
              <line x1={draw.start.x} y1={draw.start.y} x2={draw.cur.x} y2={draw.cur.y} stroke="#d6581f" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <text x={(draw.start.x + draw.cur.x) / 2} y={(draw.start.y + draw.cur.y) / 2 - 12 * k} fontSize={12 * k} fill="#d6581f" textAnchor="middle" stroke="#fff" strokeWidth={4 * k} paintOrder="stroke">
                {fmtMm(wallLen({ x1: draw.start.x, y1: draw.start.y, x2: draw.cur.x, y2: draw.cur.y }))}
              </text>
            </g>
          )}
          {tool === 'wall' && hoverPt && (
            <g pointerEvents="none">
              <line x1={hoverPt.x - 10 * k} y1={hoverPt.y} x2={hoverPt.x + 10 * k} y2={hoverPt.y} stroke="#d6581f" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <line x1={hoverPt.x} y1={hoverPt.y - 10 * k} x2={hoverPt.x} y2={hoverPt.y + 10 * k} stroke="#d6581f" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </g>
      </svg>

      <div className="plan-tools">
        <button
          className="icon-btn"
          title="全体表示"
          onClick={() => {
            userMoved.current = false;
            fit();
          }}
        >
          全体表示
        </button>
        <span className="plan-scale">1:{Math.round(1000 / (view.s * 3.78)).toLocaleString()}</span>
      </div>
      {tool === 'wall' && (
        <div className="plan-hint">
          クリックで壁の始点→終点(続けて描けます)。ダブルクリック/右クリック/Escで終了。Shiftで角度自由。
        </div>
      )}
    </div>
  );
}

function ItemHandles({ it, k }: { it: Item; k: number }) {
  const def = defOf(it.kind);
  const rotP = fromLocal(it, 0, -it.d / 2 - 26 * k);
  const back = fromLocal(it, 0, -it.d / 2);
  const resP = fromLocal(it, it.w / 2, it.d / 2);
  const canResize = !!def.resizable?.some((r) => r === 'w' || r === 'd');
  const dimP = fromLocal(it, 0, it.d / 2 + 16 * k);
  return (
    <g>
      <line x1={back.x} y1={back.y} x2={rotP.x} y2={rotP.y} stroke="#d6581f" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <circle data-hit="rotate" data-id={it.id} cx={rotP.x} cy={rotP.y} r={6 * k} fill="#fff" stroke="#d6581f" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }} />
      {canResize && (
        <rect data-hit="resize" data-id={it.id} x={resP.x - 5 * k} y={resP.y - 5 * k} width={10 * k} height={10 * k} fill="#d6581f" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ cursor: 'nwse-resize' }} />
      )}
      <text x={dimP.x} y={dimP.y} fontSize={10.5 * k} fill="#d6581f" textAnchor="middle" dominantBaseline="middle" stroke="#fff" strokeWidth={3.5 * k} paintOrder="stroke" pointerEvents="none">
        {def.round ? `φ${fmtMm(it.w)}` : `${fmtMm(it.w)}×${fmtMm(it.d)}`} H{fmtMm(it.h)}
        {it.elev > 0 ? ` / 取付${fmtMm(it.elev)}` : ''}
      </text>
    </g>
  );
}
