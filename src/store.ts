import { create } from 'zustand';
import { produce, setAutoFreeze } from 'immer';
import type { Asset, Booth, Item, Project, Selection, Wall } from './types';
import { SURFACE_KINDS, defOf } from './catalog';
import { insideFootprint, normDeg, presetWalls, supportTop, snapToWall, uid, wallInset, wallLen, wallNormal, wallThickness } from './lib/geom';
import { deleteAssetDb, loadAllAssets, loadProjectDb, saveAssetDb, saveProjectDb } from './lib/assets';

export type ViewMode = 'split' | 'plan' | '3d';
export type Tool = 'select' | 'wall';
export type CamPreset = 'persp' | 'front' | 'top' | 'eye' | 'left' | 'right';

export function makeItem(kind: string, booth: Booth, x: number, y: number): Item {
  const def = defOf(kind);
  let elev = def.elev ?? 0;
  if (kind === 'arm_spot') elev = booth.wallHeight - 130;
  const it: Item = {
    id: uid(),
    kind,
    x,
    y,
    rot: 0,
    elev,
    w: def.w,
    d: def.d,
    h: def.h,
    color: def.color,
    graphic: null,
  };
  if (def.text !== undefined) {
    it.text = def.text;
    it.textColor = def.color ?? '#1f2a44';
  }
  if (def.light) it.light = { on: true, intensity: 1, angle: def.light.angle, kelvin: def.light.kelvin };
  return it;
}

export function defaultProject(): Project {
  const booth: Booth = {
    w: 6000,
    d: 3000,
    style: 'wood',
    open: 'one',
    wallHeight: 2700,
    floor: { type: 'punch', color: '#4a4c4f', raised: false },
    fascia: { enabled: true, text: '株式会社サンプル', bg: '#ffffff', fg: '#1f2a44', height: 400, logo: null },
  };
  const walls = presetWalls(booth);
  const p: Project = {
    version: 1,
    meta: { title: '新規ブース', exhibition: '', venue: '', period: '', boothNo: '', company: '', contact: '', memo: '' },
    booth,
    walls,
    items: [],
  };
  const add = (kind: string, x: number, y: number, patch: Partial<Item> = {}) => {
    const it = { ...makeItem(kind, booth, x, y), ...patch };
    if (defOf(kind).mount === 'wall') {
      const s = snapToWall(it, x, y, walls);
      if (s) Object.assign(it, s);
    }
    p.items.push(it);
  };
  add('counter', 3000, 2350);
  add('stage_box', 1100, 1000, { w: 900, d: 600, h: 900 });
  add('stage_round', 4700, 1300);
  add('case_tower', 5300, 500);
  add('table_round', 4500, 2300, { w: 750, d: 750 });
  add('chair', 4000, 2300, { rot: 90 });
  add('chair', 5000, 2300, { rot: 270 });
  add('plant', 450, 2500);
  add('panel_wall', 3000, 140, { w: 1800, h: 900, elev: 1100 });
  for (const x of [1200, 3000, 4800]) add('arm_spot', x, 150);
  return p;
}

interface State {
  project: Project;
  assets: Record<string, Asset>;
  selection: Selection;
  tool: Tool;
  view: ViewMode;
  snapStep: number;
  quality: 'high' | 'std';
  showEstimate: boolean;
  past: Project[];
  future: Project[];
  ready: boolean;
  camCmd: { preset: CamPreset; n: number };
  capture: ((scale?: number) => Promise<string | null>) | null;

  init(): Promise<void>;
  mutate(fn: (p: Project) => void, history?: boolean): void;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  select(s: Selection): void;
  setTool(t: Tool): void;
  setView(v: ViewMode): void;
  set(patch: Partial<State>): void;

  addItem(kind: string, x?: number, y?: number, patch?: Partial<Item>): string;
  updateItem(id: string, patch: Partial<Item>, history?: boolean): void;
  moveItem(id: string, x: number, y: number, freeSnap?: boolean): void;
  updateWall(id: string, patch: Partial<Wall>, history?: boolean): void;
  addWall(w: Omit<Wall, 'id' | 'height' | 'thickness' | 'color' | 'finish'>): string;
  deleteSelected(): void;
  duplicateSelected(): void;
  rotateSelected(delta: number): void;
  setBooth(patch: Partial<Booth>, regenerate?: boolean, history?: boolean): void;
  regenerateWalls(): void;

  addAsset(a: Asset): void;
  replaceAll(p: Project, assets: Asset[]): void;
  newProject(): void;
  camera(preset: CamPreset): void;
}

const HISTORY_MAX = 80;
const clone = <T,>(v: T): T => structuredClone(v);
// 変更した部分だけ新しいオブジェクトにする(動かしていないアイテムは再描画されない)
setAutoFreeze(false);

export const useStore = create<State>((set, get) => ({
  project: defaultProject(),
  assets: {},
  selection: null,
  tool: 'select',
  view: 'split',
  snapStep: 100,
  quality: 'high',
  showEstimate: false,
  past: [],
  future: [],
  ready: false,
  camCmd: { preset: 'persp', n: 0 },
  capture: null,

  async init() {
    // 保存データの読込が終わらなくても画面(3D含む)は出す
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 4000));
    try {
      const res = await Promise.race([Promise.all([loadProjectDb(), loadAllAssets()]), timeout]);
      if (res === 'timeout') {
        console.warn('保存データの読み込みが時間切れになりました');
        set({ ready: true });
        return;
      }
      const [p, assets] = res;
      const map: Record<string, Asset> = {};
      assets.forEach((a) => (map[a.id] = a));
      set({ project: p ?? get().project, assets: map, ready: true });
    } catch (e) {
      console.warn('保存データの読み込みに失敗', e);
      set({ ready: true });
    }
  },

  mutate(fn, history = true) {
    const cur = get().project;
    const next = produce(cur, (d) => {
      fn(d as Project);
    });
    if (history) {
      set({ project: next, past: [...get().past.slice(-HISTORY_MAX), cur], future: [] });
    } else {
      set({ project: next });
    }
  },
  checkpoint() {
    set({ past: [...get().past.slice(-HISTORY_MAX), get().project], future: [] });
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], selection: validSel(get().selection, past[past.length - 1]) });
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length) return;
    set({ project: future[0], future: future.slice(1), past: [...past, project], selection: validSel(get().selection, future[0]) });
  },
  select(s) {
    set({ selection: s });
  },
  setTool(t) {
    set({ tool: t, selection: t === 'wall' ? null : get().selection });
  },
  setView(v) {
    set({ view: v });
  },
  set(patch) {
    set(patch);
  },

  addItem(kind, x, y, patch) {
    const { project } = get();
    const b = project.booth;
    const n = project.items.length;
    // 載せ物は、選択中の展示台・テーブルがあればその上に置く
    const sel = get().selection;
    const base = defOf(kind).stack && x === undefined && sel?.type === 'item' ? project.items.find((i) => i.id === sel.id && SURFACE_KINDS.has(i.kind)) : undefined;
    const px = x ?? base?.x ?? b.w / 2 + ((n % 5) - 2) * 150;
    const py = y ?? base?.y ?? b.d / 2 + ((n % 3) - 1) * 150;
    const it = { ...makeItem(kind, b, px, py), ...patch };
    if (defOf(kind).mount === 'wall' && project.walls.length) {
      let s = snapToWall(it, px, py, project.walls);
      if (!s && x === undefined) {
        const w = project.walls[0];
        const nrm = wallNormal(w);
        s = snapToWall(it, (w.x1 + w.x2) / 2 + nrm.x * 200, (w.y1 + w.y2) / 2 + nrm.y * 200, project.walls);
      }
      if (s) Object.assign(it, s);
    }
    if (defOf(kind).stack) it.elev = supportTop(it, it.x, it.y, project.items, SURFACE_KINDS);
    if (base) it.rot = base.rot;
    get().mutate((p) => {
      p.items.push(it);
    });
    set({ selection: { type: 'item', id: it.id }, tool: 'select' });
    return it.id;
  },
  updateItem(id, patch, history = true) {
    get().mutate((p) => {
      const it = p.items.find((i) => i.id === id);
      if (it) Object.assign(it, patch);
    }, history);
  },
  moveItem(id, x, y, freeSnap) {
    const { project, snapStep } = get();
    const it = project.items.find((i) => i.id === id);
    if (!it) return;
    let patch: Partial<Item> = { x: freeSnap ? x : Math.round(x / 10) * 10, y: freeSnap ? y : Math.round(y / 10) * 10 };
    if (defOf(it.kind).mount === 'wall' && !freeSnap) {
      const s = snapToWall(it, x, y, project.walls);
      if (s) patch = s;
    } else if (!freeSnap && snapStep >= 50) {
      // 小間の端にピタッと寄せる(半サイズ単位)
      const b = project.booth;
      const hw = it.w / 2;
      const hd = it.d / 2;
      const near = (v: number, target: number) => Math.abs(v - target) < 60;
      if (it.rot % 180 === 0) {
        if (near(x - hw, 0)) patch.x = hw;
        if (near(x + hw, b.w)) patch.x = b.w - hw;
        if (near(y - hd, 0)) patch.y = hd;
        if (near(y + hd, b.d)) patch.y = b.d - hd;
      }
    }
    const def = defOf(it.kind);
    // 卓上モニター等は下の天板の高さへ自動で載せる
    if (def.stack && !freeSnap) patch.elev = supportTop(it, patch.x ?? x, patch.y ?? y, project.items, SURFACE_KINDS);
    // 展示台等を動かしたら、上に載っている物も一緒に動かす
    const riders = SURFACE_KINDS.has(it.kind)
      ? project.items.filter((r) => r.id !== it.id && defOf(r.kind).stack && Math.abs(r.elev - (it.elev + it.h)) < 5 && insideFootprint(it, r.x, r.y))
      : [];
    const dx = (patch.x ?? it.x) - it.x;
    const dy = (patch.y ?? it.y) - it.y;
    get().mutate((p) => {
      const t = p.items.find((i) => i.id === id);
      if (t) Object.assign(t, patch);
      riders.forEach((r) => {
        const m = p.items.find((i) => i.id === r.id);
        if (m) {
          m.x += dx;
          m.y += dy;
        }
      });
    }, false);
  },
  updateWall(id, patch, history = true) {
    get().mutate((p) => {
      const w = p.walls.find((i) => i.id === id);
      if (w) Object.assign(w, patch);
    }, history);
  },
  addWall(w) {
    const b = get().project.booth;
    const wall: Wall = {
      id: uid(),
      ...w,
      height: b.wallHeight,
      thickness: wallThickness(b.style),
      color: get().project.walls[0]?.color ?? '#f2f1ec',
      finish: get().project.walls[0]?.finish ?? 'paint',
      graphicA: null,
      graphicB: null,
    };
    if (wallLen(wall) < 50) return '';
    get().mutate((p) => {
      p.walls.push(wall);
    });
    return wall.id;
  },
  deleteSelected() {
    const s = get().selection;
    if (!s) return;
    get().mutate((p) => {
      if (s.type === 'item') p.items = p.items.filter((i) => i.id !== s.id);
      else p.walls = p.walls.filter((w) => w.id !== s.id);
    });
    set({ selection: null });
  },
  duplicateSelected() {
    const s = get().selection;
    if (!s) return;
    const p0 = get().project;
    if (s.type === 'item') {
      const it = p0.items.find((i) => i.id === s.id);
      if (!it) return;
      const copy = { ...clone(it), id: uid() };
      const r = (it.rot * Math.PI) / 180;
      const step = Math.max(it.w, 200) + 100;
      copy.x += Math.cos(r) * step;
      copy.y += Math.sin(r) * step;
      get().mutate((p) => {
        p.items.push(copy);
      });
      set({ selection: { type: 'item', id: copy.id } });
    } else {
      const w = p0.walls.find((i) => i.id === s.id);
      if (!w) return;
      const n = wallNormal(w);
      const copy = { ...clone(w), id: uid(), x1: w.x1 + n.x * 500, y1: w.y1 + n.y * 500, x2: w.x2 + n.x * 500, y2: w.y2 + n.y * 500 };
      get().mutate((p) => {
        p.walls.push(copy);
      });
      set({ selection: { type: 'wall', id: copy.id } });
    }
  },
  rotateSelected(delta) {
    const s = get().selection;
    if (!s || s.type !== 'item') return;
    const it = get().project.items.find((i) => i.id === s.id);
    if (!it) return;
    get().updateItem(s.id, { rot: normDeg(it.rot + delta) });
  },
  setBooth(patch, regenerate, history = true) {
    get().mutate((p) => {
      const prevStyle = p.booth.style;
      const prevH = p.booth.wallHeight;
      const prevW = p.booth.w;
      const prevD = p.booth.d;
      p.booth = { ...p.booth, ...patch };
      if (!regenerate && (p.booth.w !== prevW || p.booth.d !== prevD)) {
        // 右端・前端にある壁の端点は小間の拡縮に追従させる
        const dw = p.booth.w - prevW;
        const dd = p.booth.d - prevD;
        p.walls.forEach((w) => {
          const t = w.thickness;
          if (w.x1 > prevW - t) w.x1 += dw;
          if (w.x2 > prevW - t) w.x2 += dw;
          if (w.y1 > prevD - t) w.y1 += dd;
          if (w.y2 > prevD - t) w.y2 += dd;
        });
      }
      if (patch.style && patch.style !== prevStyle) {
        const t = wallThickness(patch.style);
        const i0 = wallInset(prevStyle);
        const i1 = wallInset(patch.style);
        const { w: W, d: D } = p.booth;
        // 小間境界に沿った壁は芯の入り寸法を切り替える
        const mv = (v: number, max: number) => (Math.abs(v - i0) < 1 ? i1 : Math.abs(v - (max - i0)) < 1 ? max - i1 : v);
        p.walls.forEach((w) => {
          w.thickness = t;
          w.x1 = mv(w.x1, W);
          w.x2 = mv(w.x2, W);
          w.y1 = mv(w.y1, D);
          w.y2 = mv(w.y2, D);
        });
        p.booth.fascia.height = patch.style === 'wood' ? 400 : 300;
        // 壁厚が変わるので壁付けアイテムを吸着し直す
        p.items.forEach((it) => {
          if (defOf(it.kind).mount !== 'wall') return;
          const s = snapToWall(it, it.x, it.y, p.walls);
          if (s) Object.assign(it, s);
        });
      }
      if (patch.wallHeight && patch.wallHeight !== prevH) {
        p.walls.forEach((w) => {
          if (w.height === prevH) w.height = patch.wallHeight!;
        });
        p.items.forEach((it) => {
          if (it.kind === 'arm_spot') it.elev = patch.wallHeight! - 130;
        });
      }
      if (regenerate) {
        const base = p.walls[0];
        p.walls = presetWalls(p.booth, base);
      }
    }, history);
  },
  regenerateWalls() {
    get().setBooth({}, true);
    set({ selection: null });
  },

  addAsset(a) {
    set({ assets: { ...get().assets, [a.id]: a } });
    saveAssetDb(a).catch((e) => console.warn('画像/モデルの保存に失敗', e));
  },
  replaceAll(p, assets) {
    const old = get().assets;
    Object.values(old).forEach((a) => {
      URL.revokeObjectURL(a.url);
      deleteAssetDb(a.id).catch(() => {});
    });
    const map: Record<string, Asset> = {};
    assets.forEach((a) => {
      map[a.id] = a;
      saveAssetDb(a).catch(() => {});
    });
    set({ project: p, assets: map, selection: null, past: [], future: [] });
  },
  newProject() {
    const p = defaultProject();
    p.items = [];
    p.booth.fascia.text = '社名';
    get().replaceAll(p, []);
  },
  camera(preset) {
    set({ camCmd: { preset, n: get().camCmd.n + 1 } });
  },
}));

function validSel(s: Selection, p: Project): Selection {
  if (!s) return null;
  if (s.type === 'item') return p.items.some((i) => i.id === s.id) ? s : null;
  return p.walls.some((w) => w.id === s.id) ? s : null;
}

// 自動保存
let saveTimer: number | undefined;
useStore.subscribe((s, prev) => {
  if (!s.ready || s.project === prev.project) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveProjectDb(useStore.getState().project).catch((e) => console.warn('自動保存に失敗', e));
  }, 500);
});

export const useSelectedItem = () =>
  useStore((s) => (s.selection?.type === 'item' ? s.project.items.find((i) => i.id === s.selection!.id) : undefined));
export const useSelectedWall = () =>
  useStore((s) => (s.selection?.type === 'wall' ? s.project.walls.find((w) => w.id === s.selection!.id) : undefined));
