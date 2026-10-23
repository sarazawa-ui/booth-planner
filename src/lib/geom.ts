import type { Booth, BoothStyle, Item, OpenType, Wall } from '../types';
import { defOf } from '../catalog';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const OCTA_PITCH = 1000;
export const OCTA_POST = 50;
export const OCTA_PANEL_H = 2400;

export function wallThickness(style: BoothStyle) {
  return style === 'wood' ? 100 : OCTA_POST;
}

export function wallLen(w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

export function wallAngle(w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>) {
  return Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
}

/** A面方向の単位法線 */
export function wallNormal(w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>) {
  const L = wallLen(w) || 1;
  return { x: -(w.y2 - w.y1) / L, y: (w.x2 - w.x1) / L };
}

export const OPEN_TYPES: { id: OpenType; name: string; desc: string }[] = [
  { id: 'one', name: '一面開放', desc: '背面+両側面に壁' },
  { id: 'corner', name: '二面開放(角小間)', desc: '背面+左側面に壁' },
  { id: 'three', name: '三面開放', desc: '背面のみ壁' },
  { id: 'island', name: '四面開放(島小間)', desc: '壁なし' },
];

/** 壁芯の小間境界からの入り寸法。オクタノルムは支柱芯を小間境界に置く(隣接小間と共有する前提) */
export function wallInset(style: BoothStyle) {
  return style === 'wood' ? 50 : 0;
}

export function presetWalls(booth: Booth, base?: Partial<Wall>): Wall[] {
  const t = wallThickness(booth.style);
  const i = wallInset(booth.style);
  const { w: W, d: D } = booth;
  const mk = (x1: number, y1: number, x2: number, y2: number): Wall => ({
    id: uid(),
    x1, y1, x2, y2,
    height: booth.wallHeight,
    thickness: t,
    color: base?.color ?? '#f2f1ec',
    finish: base?.finish ?? 'paint',
    graphicA: null,
    graphicB: null,
  });
  const back = mk(i, i, W - i, i);
  const left = mk(i, D - i, i, i);
  const right = mk(W - i, i, W - i, D - i);
  switch (booth.open) {
    case 'one':
      return [back, left, right];
    case 'corner':
      return [back, left];
    case 'three':
      return [back];
    default:
      return [];
  }
}

/** オクタノルムの支柱位置(壁ごと)。始点から 1000mm ピッチ、端数は最後の支柱で調整。 */
export function octaPostOffsets(L: number): number[] {
  const out = [0];
  let s = OCTA_PITCH;
  while (s < L - 150) {
    out.push(s);
    s += OCTA_PITCH;
  }
  if (L > 0) out.push(L);
  return out;
}

export function octaPostPositions(walls: Wall[]): { x: number; y: number; h: number }[] {
  const pts: { x: number; y: number; h: number }[] = [];
  for (const w of walls) {
    const L = wallLen(w);
    const a = wallAngle(w);
    for (const s of octaPostOffsets(L)) {
      const x = w.x1 + Math.cos(a) * s;
      const y = w.y1 + Math.sin(a) * s;
      const hit = pts.find((p) => Math.hypot(p.x - x, p.y - y) < 40);
      if (hit) hit.h = Math.max(hit.h, w.height);
      else pts.push({ x, y, h: w.height });
    }
  }
  return pts;
}

export interface OctaCount {
  posts: Map<number, number>;
  panels: Map<string, number>;
  upper: Map<string, number>;
  beams: number;
  special: number;
}

export function octaCount(walls: Wall[]): OctaCount {
  const posts = new Map<number, number>();
  for (const p of octaPostPositions(walls)) posts.set(p.h, (posts.get(p.h) ?? 0) + 1);
  const panels = new Map<string, number>();
  const upper = new Map<string, number>();
  let beams = 0;
  let special = 0;
  for (const w of walls) {
    const offs = octaPostOffsets(wallLen(w));
    const lower = Math.min(OCTA_PANEL_H, w.height);
    for (let k = 0; k < offs.length - 1; k++) {
      const gap = Math.round(offs[k + 1] - offs[k]);
      const pw = gap - OCTA_POST;
      if (gap !== OCTA_PITCH) special++;
      const key = `W${pw}×H${lower}`;
      panels.set(key, (panels.get(key) ?? 0) + 1);
      if (w.height > OCTA_PANEL_H + 60) {
        beams++;
        const uk = `W${pw}×H${w.height - OCTA_PANEL_H - 50}`;
        upper.set(uk, (upper.get(uk) ?? 0) + 1);
      }
    }
  }
  return { posts, panels, upper, beams, special };
}

export function snap(v: number, step: number) {
  return Math.round(v / step) * step;
}

/** 壁付けアイテムを最寄りの壁面に吸着させる */
export function snapToWall(it: Item, x: number, y: number, walls: Wall[]): { x: number; y: number; rot: number } | null {
  let best: { x: number; y: number; rot: number; dist: number } | null = null;
  for (const w of walls) {
    const L = wallLen(w);
    if (L < 1) continue;
    const ux = (w.x2 - w.x1) / L;
    const uy = (w.y2 - w.y1) / L;
    const n = wallNormal(w);
    const rx = x - w.x1;
    const ry = y - w.y1;
    const t = rx * ux + ry * uy;
    if (t < -100 || t > L + 100) continue;
    const s = rx * n.x + ry * n.y;
    const off = w.thickness / 2 + it.d / 2;
    const dist = Math.abs(Math.abs(s) - off);
    if (dist > Math.max(250, it.d)) continue;
    if (best && best.dist < dist) continue;
    const side = s >= 0 ? 1 : -1;
    const half = Math.min(it.w / 2, L / 2);
    const tc = Math.max(half, Math.min(L - half, t));
    const a = (Math.atan2(uy, ux) * 180) / Math.PI;
    best = {
      x: w.x1 + ux * tc + n.x * off * side,
      y: w.y1 + uy * tc + n.y * off * side,
      rot: normDeg(side > 0 ? a : a + 180),
      dist,
    };
  }
  return best;
}

export function normDeg(d: number) {
  let r = d % 360;
  if (r < 0) r += 360;
  return Math.round(r * 100) / 100;
}

export function isWallMount(it: Item) {
  return defOf(it.kind).mount === 'wall';
}

/** アイテムの四隅(平面図座標) */
export function itemCorners(it: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rot'>) {
  const r = (it.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-it.w / 2, -it.d / 2],
    [it.w / 2, -it.d / 2],
    [it.w / 2, it.d / 2],
    [-it.w / 2, it.d / 2],
  ].map(([u, v]) => ({ x: it.x + u * c - v * s, y: it.y + u * s + v * c }));
}

export function toLocal(it: Pick<Item, 'x' | 'y' | 'rot'>, x: number, y: number) {
  const r = (-it.rot * Math.PI) / 180;
  const dx = x - it.x;
  const dy = y - it.y;
  return { u: dx * Math.cos(r) - dy * Math.sin(r), v: dx * Math.sin(r) + dy * Math.cos(r) };
}

export function fromLocal(it: Pick<Item, 'x' | 'y' | 'rot'>, u: number, v: number) {
  const r = (it.rot * Math.PI) / 180;
  return { x: it.x + u * Math.cos(r) - v * Math.sin(r), y: it.y + u * Math.sin(r) + v * Math.cos(r) };
}

export function fmtMm(v: number) {
  return Math.round(v).toLocaleString('ja-JP');
}

/** 点(x,y)がアイテムの平面形状の内側か */
export function insideFootprint(s: Item, x: number, y: number, margin = 0) {
  const { u, v } = toLocal(s, x, y);
  if (defOf(s.kind).round) return Math.hypot(u, v) <= s.w / 2 + margin;
  return Math.abs(u) <= s.w / 2 + margin && Math.abs(v) <= s.d / 2 + margin;
}

/** 載せ物(卓上モニター等)の下にある天板の高さ。なければ 0(床) */
export function supportTop(it: Item, x: number, y: number, items: Item[], surfaces: Set<string>) {
  let top = 0;
  for (const s of items) {
    if (s.id === it.id || !surfaces.has(s.kind)) continue;
    if (insideFootprint(s, x, y)) top = Math.max(top, s.elev + s.h);
  }
  return top;
}
