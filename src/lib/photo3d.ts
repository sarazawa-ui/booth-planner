import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// 背景透過写真(シルエット)から簡易3Dモデルを作る。
// 座標系: X=幅(右+), Y=高さ(上+), Z=奥行(手前+)。正面写真は +Z 側から見た姿。
// 形状は写真の不透明度を「被覆率」として3D格子に展開し、Surface Nets で表面化する。

export type PhotoShape = 'box' | 'lathe' | 'extrude';
export type PhotoView = 'front' | 'side' | 'top' | 'back';

export interface Silhouette {
  /** 表面に貼る画像(切抜き済み・透明部は周囲の色で埋めて不透明化) */
  tex: HTMLCanvasElement;
  /** 被覆率マップ(0〜1, 行は上から) */
  cov: { w: number; h: number; data: Float32Array };
  /** 切抜き後の 幅/高さ */
  aspect: number;
  /** 切抜き画像のプレビュー(透過PNG) */
  preview: string;
  /** 透過がなく背景色を自動除去した */
  keyed: boolean;
}

export interface BuildInput {
  shape: PhotoShape;
  /** mm */
  w: number;
  d: number;
  h: number;
  views: Partial<Record<PhotoView, Silhouette>>;
  /** 長辺方向の格子分割数 */
  res: number;
}

const WORK_MAX = 1600;
const TEX_MAX = 1024;
const COV_MAX = 256;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function fitSize(w: number, h: number, max: number) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// ---------- 写真 → シルエット ----------

export async function loadSilhouette(file: Blob, mirror: boolean): Promise<Silhouette> {
  const bmp = await createImageBitmap(file);
  const s = fitSize(bmp.width, bmp.height, WORK_MAX);
  const work = canvas(s.w, s.h);
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  if (mirror) {
    ctx.translate(s.w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(bmp, 0, 0, s.w, s.h);
  bmp.close();
  const img = ctx.getImageData(0, 0, s.w, s.h);

  let keyed = false;
  if (!hasTransparency(img)) {
    keyBackground(img);
    keyed = true;
  }
  const bb = alphaBounds(img);
  if (!bb) throw new Error('写真の中に物体が見つかりません(全面が透明です)');
  ctx.resetTransform();
  ctx.putImageData(img, 0, 0);

  const cw = bb.x1 - bb.x0 + 1;
  const ch = bb.y1 - bb.y0 + 1;
  const crop = canvas(cw, ch);
  crop.getContext('2d')!.drawImage(work, bb.x0, bb.y0, cw, ch, 0, 0, cw, ch);

  const ts = fitSize(cw, ch, TEX_MAX);
  const tex = canvas(ts.w, ts.h);
  const tctx = tex.getContext('2d', { willReadFrequently: true })!;
  tctx.drawImage(crop, 0, 0, ts.w, ts.h);
  const preview = tex.toDataURL('image/png');
  const timg = tctx.getImageData(0, 0, ts.w, ts.h);
  bleed(timg);
  tctx.putImageData(timg, 0, 0);

  const cs = fitSize(cw, ch, COV_MAX);
  const cc = canvas(cs.w, cs.h);
  const cctx = cc.getContext('2d', { willReadFrequently: true })!;
  cctx.drawImage(crop, 0, 0, cs.w, cs.h);
  const cd = cctx.getImageData(0, 0, cs.w, cs.h).data;
  const data = new Float32Array(cs.w * cs.h);
  for (let i = 0; i < data.length; i++) data[i] = cd[i * 4 + 3] / 255;

  return { tex, cov: { w: cs.w, h: cs.h, data }, aspect: cw / ch, preview, keyed };
}

function hasTransparency(img: ImageData) {
  const d = img.data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128) n++;
  return n > (d.length / 4) * 0.01;
}

/** 透過のない写真: 外周から背景色に近い領域を塗りつぶし的に透明化する */
function keyBackground(img: ImageData) {
  const { width: w, height: h, data: d } = img;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const med = (ch: number) => {
    const v = border.map((p) => d[p * 4 + ch]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bg = [med(0), med(1), med(2)];
  const tol2 = 48 * 48;
  const near = (p: number) => {
    const dr = d[p * 4] - bg[0];
    const dg = d[p * 4 + 1] - bg[1];
    const db = d[p * 4 + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const seen = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;
  for (const p of border) {
    if (!seen[p] && near(p)) {
      seen[p] = 1;
      q[qt++] = p;
    }
  }
  while (qh < qt) {
    const p = q[qh++];
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const n of nb) {
      if (n >= 0 && !seen[n] && near(n)) {
        seen[n] = 1;
        q[qt++] = n;
      }
    }
  }
}

function alphaBounds(img: ImageData) {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] >= 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** 透明部を最寄りの不透明画素の色で埋める(輪郭付近で背景色がにじまないように) */
function bleed(img: ImageData) {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const done = new Uint8Array(n);
  const q = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  for (let p = 0; p < n; p++) {
    if (d[p * 4 + 3] >= 128) {
      done[p] = 1;
      d[p * 4 + 3] = 255;
      q[qt++] = p;
    }
  }
  while (qh < qt) {
    const p = q[qh++];
    const x = p % w;
    const y = (p / w) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const m of nb) {
      if (m >= 0 && !done[m]) {
        done[m] = 1;
        d[m * 4] = d[p * 4];
        d[m * 4 + 1] = d[p * 4 + 1];
        d[m * 4 + 2] = d[p * 4 + 2];
        d[m * 4 + 3] = 255;
        q[qt++] = m;
      }
    }
  }
}

/** 被覆率の双線形補間。u: 0=左 1=右, v: 0=下 1=上 */
function sampleCov(c: Silhouette['cov'], u: number, v: number) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const fx = u * c.w - 0.5;
  const fy = (1 - v) * c.h - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= c.w || y >= c.h ? 0 : c.data[y * c.w + x]);
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

// ---------- 各面の貼付け(平面投影) ----------
// 正規化座標 nx,ny,nz ∈ [0,1](nx: 左→右, ny: 下→上, nz: 奥→手前)から各写真の uv を求める。

type Proj = (nx: number, ny: number, nz: number) => [number, number];
const PROJ: Record<PhotoView, Proj> = {
  front: (x, y) => [x, y],
  back: (x, y) => [1 - x, y],
  // 右から撮った写真: 画像の右が奥
  side: (_x, y, z) => [1 - z, y],
  // 真上から撮った写真: 画像の下が手前
  top: (x, _y, z) => [x, 1 - z],
};

// ---------- 形状 ----------

export interface BuildResult {
  group: THREE.Group;
  triangles: number;
}

export function buildModel(inp: BuildInput): BuildResult {
  const front = inp.views.front;
  if (!front) throw new Error('正面の写真が必要です');
  const W = Math.max(1, inp.w);
  const H = Math.max(1, inp.h);
  const D = inp.shape === 'lathe' ? W : Math.max(1, inp.d);
  const side = inp.shape === 'box' ? inp.views.side : undefined;
  const top = inp.shape === 'box' ? inp.views.top : undefined;

  // 格子数(各軸最低 12、細長い物も潰れないように)
  const max = Math.max(W, H, D);
  const cells = (len: number) => Math.max(12, Math.round((inp.res * len) / max));
  const n = [cells(W), cells(H), cells(D)];
  const N = n.map((v) => v + 2); // 外周に空セルを1つずつ
  const field = new Float32Array(N[0] * N[1] * N[2]);

  for (let k = 1; k <= n[2]; k++) {
    const nz = (k - 0.5) / n[2];
    for (let j = 1; j <= n[1]; j++) {
      const ny = (j - 0.5) / n[1];
      for (let i = 1; i <= n[0]; i++) {
        const nx = (i - 0.5) / n[0];
        let v: number;
        if (inp.shape === 'lathe') {
          const r = Math.hypot(nx - 0.5, nz - 0.5);
          v = Math.max(sampleCov(front.cov, 0.5 + r, ny), sampleCov(front.cov, 0.5 - r, ny));
        } else {
          v = sampleCov(front.cov, nx, ny);
          if (side) v = Math.min(v, sampleCov(side.cov, ...PROJ.side(nx, ny, nz)));
          if (top) v = Math.min(v, sampleCov(top.cov, ...PROJ.top(nx, ny, nz)));
        }
        field[i + N[0] * (j + N[1] * k)] = v;
      }
    }
  }

  const geo = surfaceNets(field, N, 0.5);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  if (pos.count === 0) throw new Error('形状を作れませんでした。写真の切抜きを確認してください');

  // 外形をちょうど W×H×D(m)に合わせ、底面中央を原点にする
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const sz = bb.getSize(new THREE.Vector3());
  const norm = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nx = (pos.getX(i) - bb.min.x) / sz.x;
    const ny = (pos.getY(i) - bb.min.y) / sz.y;
    const nz = (pos.getZ(i) - bb.min.z) / sz.z;
    norm.set([nx, ny, nz], i * 3);
    pos.setXYZ(i, (nx - 0.5) * W * 0.001, ny * H * 0.001, (nz - 0.5) * D * 0.001);
  }
  geo.computeVertexNormals();

  // 面の向きごとに貼る写真を決める。写真がない向きは正面写真の投影で代用(輪郭の色が伸びる)
  const pick = (axis: number, sign: number): PhotoView => {
    if (inp.shape !== 'box') return 'front';
    if (axis === 0) return side ? 'side' : 'front';
    if (axis === 1) return sign > 0 && top ? 'top' : 'front';
    return sign < 0 && inp.views.back ? 'back' : 'front';
  };
  const idx = geo.getIndex()!;
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const buckets = new Map<PhotoView, number[]>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t));
    b.fromBufferAttribute(pos, idx.getX(t + 1));
    c.fromBufferAttribute(pos, idx.getX(t + 2));
    const fn = b.sub(a).cross(c.sub(a));
    const ax = [Math.abs(fn.x), Math.abs(fn.y), Math.abs(fn.z)];
    const axis = ax[0] >= ax[1] && ax[0] >= ax[2] ? 0 : ax[1] >= ax[2] ? 1 : 2;
    const view = pick(axis, fn.getComponent(axis));
    let arr = buckets.get(view);
    if (!arr) buckets.set(view, (arr = []));
    arr.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  }

  const group = new THREE.Group();
  group.name = 'photo-model';
  for (const [view, tris] of buckets) {
    const sil = inp.views[view] ?? front;
    const remap = new Map<number, number>();
    const P: number[] = [];
    const Nn: number[] = [];
    const UV: number[] = [];
    const I: number[] = [];
    for (const vi of tris) {
      let ni = remap.get(vi);
      if (ni === undefined) {
        ni = remap.size;
        remap.set(vi, ni);
        P.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
        Nn.push(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi));
        UV.push(...PROJ[view](norm[vi * 3], norm[vi * 3 + 1], norm[vi * 3 + 2]));
      }
      I.push(ni);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    const mesh = new THREE.Mesh(g, materialFor(sil));
    mesh.name = view;
    group.add(mesh);
  }
  geo.dispose();
  return { group, triangles: idx.count / 3 };
}

const matCache = new WeakMap<Silhouette, THREE.MeshStandardMaterial>();
function materialFor(s: Silhouette) {
  let m = matCache.get(s);
  if (!m) {
    const t = new THREE.CanvasTexture(s.tex);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    // 不透明化済みなので JPEG で書き出して容量を抑える
    t.userData.mimeType = 'image/jpeg';
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, metalness: 0 });
    matCache.set(s, m);
  }
  return m;
}

export function disposeModel(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}

export async function exportGlb(g: THREE.Group): Promise<Blob> {
  const buf = (await new GLTFExporter().parseAsync(g, { binary: true })) as ArrayBuffer;
  return new Blob([buf], { type: 'model/gltf-binary' });
}

// ---------- Surface Nets ----------
// 各セルの角の符号が混在するとき、等値面と交わる辺の交点平均に頂点を1つ置き、
// 符号が変わる格子辺ごとに周囲4セルの頂点で四角形を張る。

function surfaceNets(f: Float32Array, N: number[], iso: number): THREE.BufferGeometry {
  const [nx, ny, nz] = N;
  const at = (i: number, j: number, k: number) => f[i + nx * (j + ny * k)] - iso;
  const cellIdx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const P: number[] = [];
  const corners = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges: [number, number][] = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
    const d = corners[a].reduce((s, v, x) => s + Math.abs(v - corners[b][x]), 0);
    if (d === 1) edges.push([a, b]);
  }
  const val = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const v = at(i + corners[c][0], j + corners[c][1], k + corners[c][2]);
          val[c] = v;
          if (v > 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (const [a, b] of edges) {
          const va = val[a];
          const vb = val[b];
          if (va > 0 === vb > 0) continue;
          const t = va / (va - vb);
          sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
          sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
          sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
          cnt++;
        }
        cellIdx[cid(i, j, k)] = P.length / 3;
        P.push(i + sx / cnt, j + sy / cnt, k + sz / cnt);
      }
    }
  }

  const I: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) I.push(a, c, b, a, d, c);
    else I.push(a, b, c, a, c, d);
  };
  // 格子点 (i,j,k) から各軸 +1 方向の辺。辺を囲む4セルは他の2軸で -1 ずらしたもの
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const v0 = at(i, j, k) > 0;
        if (v0 !== at(i + 1, j, k) > 0) {
          quad(cellIdx[cid(i, j - 1, k - 1)], cellIdx[cid(i, j, k - 1)], cellIdx[cid(i, j, k)], cellIdx[cid(i, j - 1, k)], !v0);
        }
        if (v0 !== at(i, j + 1, k) > 0) {
          quad(cellIdx[cid(i - 1, j, k - 1)], cellIdx[cid(i - 1, j, k)], cellIdx[cid(i, j, k)], cellIdx[cid(i, j, k - 1)], !v0);
        }
        if (v0 !== at(i, j, k + 1) > 0) {
          quad(cellIdx[cid(i - 1, j - 1, k)], cellIdx[cid(i, j - 1, k)], cellIdx[cid(i, j, k)], cellIdx[cid(i - 1, j, k)], !v0);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  return g;
}
