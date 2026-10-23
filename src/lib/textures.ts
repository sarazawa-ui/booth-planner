import * as THREE from 'three';
import { useEffect, useState } from 'react';
import type { Asset } from '../types';

// ---- 手続き生成テクスチャ(外部ファイル不要) ----

/** three 側で GPU の上限に丸められるので大きめに指定 */
const MAX_ANISO = 16;
/** 文字テクスチャの最大辺(多くの GPU で安全な値) */
const MAX_TEX = 8192;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTex(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAX_ANISO;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const memo = new Map<string, { map: THREE.Texture; bump?: THREE.Texture; rough?: THREE.Texture }>();

function cached(key: string, make: () => { map: THREE.Texture; bump?: THREE.Texture; rough?: THREE.Texture }) {
  let v = memo.get(key);
  if (!v) {
    v = make();
    memo.set(key, v);
  }
  return v;
}

/** パンチカーペット: 細かいフェルト状のムラ。1テクスチャ=1m角 */
export function punchCarpet() {
  return cached('punch', () => {
    const N = 512;
    const c = canvas(N);
    const g = c.getContext('2d')!;
    const img = g.createImageData(N, N);
    const r = rng(7);
    for (let i = 0; i < N * N; i++) {
      const v = 200 + (r() - 0.5) * 70 + (r() < 0.04 ? -40 : 0);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 大きめのムラ
    g.globalAlpha = 0.06;
    for (let i = 0; i < 120; i++) {
      g.fillStyle = r() > 0.5 ? '#000' : '#fff';
      g.beginPath();
      g.arc(r() * N, r() * N, 10 + r() * 40, 0, Math.PI * 2);
      g.fill();
    }
    const map = toTex(c);
    const bump = toTex(c, false);
    return { map, bump };
  });
}

/** タイルカーペット: 500角を市松に向きを変えて敷いた状態。1テクスチャ=1m角 */
export function tileCarpet() {
  return cached('tile', () => {
    const N = 512;
    const c = canvas(N);
    const g = c.getContext('2d')!;
    const r = rng(11);
    const half = N / 2;
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const ox = tx * half;
        const oy = ty * half;
        g.fillStyle = '#c8c8c8';
        g.fillRect(ox, oy, half, half);
        const vertical = (tx + ty) % 2 === 0;
        for (let i = 0; i < half; i += 2) {
          const v = 170 + r() * 60;
          g.fillStyle = `rgb(${v},${v},${v})`;
          if (vertical) g.fillRect(ox + i, oy, 1.4, half);
          else g.fillRect(ox, oy + i, half, 1.4);
        }
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1.5;
        g.strokeRect(ox + 0.5, oy + 0.5, half - 1, half - 1);
      }
    }
    const map = toTex(c);
    const bump = toTex(c, false);
    return { map, bump };
  });
}

/** フローリング調シート。1テクスチャ=1.2m角 */
export function flooring() {
  return cached('flooring', () => {
    const N = 1024;
    const c = canvas(N);
    const g = c.getContext('2d')!;
    const r = rng(23);
    const plankW = N / 8;
    for (let row = 0; row < 8; row++) {
      let x = -r() * N * 0.5;
      while (x < N) {
        const len = N * (0.35 + r() * 0.4);
        const base = 150 + r() * 40;
        const grd = g.createLinearGradient(0, row * plankW, 0, (row + 1) * plankW);
        grd.addColorStop(0, `rgb(${base + 20},${base - 15},${base - 60})`);
        grd.addColorStop(1, `rgb(${base},${base - 35},${base - 80})`);
        g.fillStyle = grd;
        g.fillRect(x, row * plankW, len, plankW);
        g.strokeStyle = 'rgba(60,35,15,0.25)';
        for (let k = 0; k < 14; k++) {
          g.lineWidth = 0.5 + r() * 1.2;
          g.beginPath();
          const yy = row * plankW + r() * plankW;
          g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 8, x + len * 0.6, yy + (r() - 0.5) * 8, x + len, yy + (r() - 0.5) * 6);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,20,5,0.5)';
        g.fillRect(x, row * plankW, 1.5, plankW);
        x += len;
      }
      g.fillStyle = 'rgba(40,20,5,0.45)';
      g.fillRect(0, row * plankW, N, 1.5);
    }
    return { map: toTex(c), bump: toTex(c, false) };
  });
}

/** 会場床(コンクリート)。1テクスチャ=4m角 */
export function concrete() {
  return cached('concrete', () => {
    const N = 1024;
    const c = canvas(N);
    const g = c.getContext('2d')!;
    g.fillStyle = '#9b9a96';
    g.fillRect(0, 0, N, N);
    const r = rng(5);
    for (let i = 0; i < 900; i++) {
      g.globalAlpha = 0.025 + r() * 0.03;
      g.fillStyle = r() > 0.5 ? '#6d6c68' : '#c4c2bd';
      g.beginPath();
      g.arc(r() * N, r() * N, 4 + r() * 70, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.5;
    g.strokeStyle = '#5c5b58';
    g.lineWidth = 2;
    g.strokeRect(0, 0, N, N);
    g.globalAlpha = 1;
    const map = toTex(c);
    return { map };
  });
}

/** 木目化粧シート。1テクスチャ=幅0.9m × 高さ2.7m 程度 */
export function woodgrain() {
  return cached('woodgrain', () => {
    const W = 512;
    const H = 1024;
    const c = canvas(W, H);
    const g = c.getContext('2d')!;
    const r = rng(31);
    g.fillStyle = '#c69a68';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const x = r() * W;
      g.strokeStyle = r() > 0.5 ? 'rgba(110,70,35,0.22)' : 'rgba(230,190,140,0.2)';
      g.lineWidth = 0.6 + r() * 2.5;
      g.beginPath();
      g.moveTo(x, 0);
      let xx = x;
      for (let y = 0; y <= H; y += 32) {
        xx += (r() - 0.5) * 3;
        g.lineTo(xx, y);
      }
      g.stroke();
    }
    return { map: toTex(c), bump: toTex(c, false) };
  });
}

// ---- 文字テクスチャ ----

const textMemo = new Map<string, THREE.CanvasTexture>();

export function textTexture(text: string, opt: { w: number; h: number; bg: string | null; fg: string; logo?: HTMLImageElement | null }) {
  const key = JSON.stringify([text, opt.w, opt.h, opt.bg, opt.fg, opt.logo?.src ?? '']);
  const hit = textMemo.get(key);
  if (hit) return hit;
  // 縦横比を崩さずに、高さ 512px を基準に描く(横長すぎる場合は高さ側を下げる)
  const aspect = opt.w / opt.h;
  const H = Math.round(Math.min(512, MAX_TEX / aspect));
  const W = Math.max(1, Math.round(H * aspect));
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  if (opt.bg) {
    g.fillStyle = opt.bg;
    g.fillRect(0, 0, W, H);
  }
  let x0 = 0;
  if (opt.logo && opt.logo.naturalWidth) {
    const lh = H * 0.7;
    const lw = (lh * opt.logo.naturalWidth) / opt.logo.naturalHeight;
    const total = lw + (text ? H * 0.25 : 0);
    x0 = total;
    const textW = text ? measure(g, text, H) : 0;
    const start = (W - (total + textW)) / 2;
    g.drawImage(opt.logo, Math.max(H * 0.1, start), (H - lh) / 2, lw, lh);
    x0 = Math.max(H * 0.1, start) + total;
    if (text) drawText(g, text, x0, H, W - x0 - H * 0.1, opt.fg, 'left');
  } else if (text) {
    drawText(g, text, W / 2, H, W * 0.92, opt.fg, 'center');
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  textMemo.set(key, t);
  return t;
}

const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';

function measure(g: CanvasRenderingContext2D, text: string, H: number) {
  g.font = `700 ${H * 0.56}px ${FONT}`;
  return g.measureText(text).width;
}

function drawText(g: CanvasRenderingContext2D, text: string, x: number, H: number, maxW: number, fg: string, align: CanvasTextAlign) {
  let size = H * 0.56;
  g.font = `700 ${size}px ${FONT}`;
  const w = g.measureText(text).width;
  if (w > maxW) {
    size *= maxW / w;
    g.font = `700 ${size}px ${FONT}`;
  }
  g.fillStyle = fg;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, x, H / 2 + size * 0.04);
}

// ---- アップロード画像 ----

const imgTex = new Map<string, Promise<THREE.Texture>>();
const loader = new THREE.TextureLoader();

export function loadImageTexture(asset: Asset): Promise<THREE.Texture> {
  let p = imgTex.get(asset.id);
  if (!p) {
    p = loader.loadAsync(asset.url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = MAX_ANISO;
      return t;
    });
    imgTex.set(asset.id, p);
  }
  return p;
}

export function useImageTexture(asset: Asset | undefined) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    if (!asset) {
      setTex(null);
      return;
    }
    loadImageTexture(asset).then((t) => alive && setTex(t));
    return () => {
      alive = false;
    };
  }, [asset]);
  return tex;
}

export function useHtmlImage(asset: Asset | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!asset) {
      setImg(null);
      return;
    }
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = asset.url;
  }, [asset]);
  return img;
}

/** 色温度(K)→ RGB(近似) */
export function kelvinToColor(k: number) {
  const t = k / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}
