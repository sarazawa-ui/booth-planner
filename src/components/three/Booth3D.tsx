import * as THREE from 'three';
import { memo, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Booth, Wall } from '../../types';
import { useStore } from '../../store';
import { OCTA_PANEL_H, OCTA_POST, octaPostOffsets, octaPostPositions, wallAngle, wallInset, wallLen } from '../../lib/geom';
import { concrete, flooring, punchCarpet, textTexture, tileCarpet, useHtmlImage, woodgrain } from '../../lib/textures';
import { aluminum, melamine, paint } from './materials';
import { GraphicPlane } from './Graphic3D';

const mm = (v: number) => v / 1000;

export function floorTopOf(b: Booth) {
  if (b.floor.raised) return 0.05;
  return b.floor.type === 'none' ? 0 : 0.007;
}

// ---- 会場 ----

export const Hall = memo(function Hall({ booth }: { booth: Booth }) {
  const mat = useMemo(() => {
    const { map } = concrete();
    const m = map.clone();
    m.repeat.set(20, 20);
    m.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: m, color: '#d8d6d1', roughness: 0.62, metalness: 0.0 });
  }, []);
  const cx = mm(booth.w) / 2;
  const cz = mm(booth.d) / 2;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} material={mat} receiveShadow>
      <planeGeometry args={[80, 80]} />
    </mesh>
  );
});

// ---- 床 ----

export const BoothFloor = memo(function BoothFloor({ booth, onDown }: { booth: Booth; onDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  const W = mm(booth.w);
  const D = mm(booth.d);
  const top = floorTopOf(booth);
  const { type, color, raised } = booth.floor;
  const mat = useMemo(() => {
    if (type === 'none') return null;
    const src = type === 'tile' ? tileCarpet() : type === 'flooring' ? flooring() : punchCarpet();
    const unit = type === 'flooring' ? 1.2 : 1;
    const map = src.map.clone();
    map.repeat.set(W / unit, D / unit);
    map.needsUpdate = true;
    const bump = src.bump!.clone();
    bump.repeat.set(W / unit, D / unit);
    bump.needsUpdate = true;
    if (type === 'flooring') {
      return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.3, roughness: 0.5, color: '#ffffff' });
    }
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.8, roughness: 1, color });
  }, [type, color, W, D]);
  if (!mat) return null;
  const carpetH = 0.007;
  return (
    <group onPointerDown={onDown}>
      {raised && (
        <mesh position={[W / 2, (top - carpetH) / 2, D / 2]} receiveShadow castShadow material={aluminum()}>
          <boxGeometry args={[W, top - carpetH, D]} />
        </mesh>
      )}
      <mesh position={[W / 2, top - carpetH / 2, D / 2]} material={mat} receiveShadow>
        <boxGeometry args={[W, carpetH, D]} />
      </mesh>
    </group>
  );
});

// ---- 壁 ----

function wallMaterial(w: Wall, style: Booth['style']) {
  if (style === 'octanorm') return melamine(w.color);
  if (w.finish === 'woodgrain') return null;
  return paint(w.color, 0.82);
}

function WoodGrainWall({ L, H, t }: { L: number; H: number; t: number }) {
  const mat = useMemo(() => {
    const src = woodgrain();
    const map = src.map.clone();
    map.repeat.set(L / 0.9, H / 2.7);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
  }, [L, H]);
  return (
    <RoundedBox args={[L, H, t]} radius={0.003} smoothness={2} position={[L / 2, H / 2, 0]} material={mat} castShadow receiveShadow />
  );
}

function WallGraphics({ w, L, H, faceZ, y0 = 0 }: { w: Wall; L: number; H: number; faceZ: number; y0?: number }) {
  return (
    <>
      {w.graphicA && <GraphicPlane graphic={w.graphicA} w={L} h={H} position={[L / 2, y0 + H / 2, faceZ + 0.0015]} />}
      {w.graphicB && <GraphicPlane graphic={w.graphicB} w={L} h={H} position={[L / 2, y0 + H / 2, -faceZ - 0.0015]} rotation={[0, Math.PI, 0]} />}
    </>
  );
}

export const Walls3D = memo(function Walls3D({
  walls,
  booth,
  selectedId,
  onDown,
}: {
  walls: Wall[];
  booth: Booth;
  selectedId?: string;
  onDown: (e: ThreeEvent<PointerEvent>, w: Wall) => void;
}) {
  const octa = booth.style === 'octanorm';
  const posts = useMemo(() => (octa ? octaPostPositions(walls) : []), [octa, walls]);
  return (
    <group>
      {walls.map((w) => {
        const L = mm(wallLen(w));
        const H = mm(w.height);
        const a = wallAngle(w);
        const sel = w.id === selectedId;
        return (
          <group key={w.id} position={[mm(w.x1), 0, mm(w.y1)]} rotation={[0, -a, 0]} onPointerDown={(e) => onDown(e, w)}>
            {octa ? <OctaWall w={w} L={L} H={H} /> : <WoodWall w={w} L={L} H={H} />}
            {sel && <WallSel L={L} H={H} t={mm(w.thickness)} />}
          </group>
        );
      })}
      {posts.map((p, i) => (
        <OctaPost key={i} x={mm(p.x)} z={mm(p.y)} h={mm(p.h)} />
      ))}
    </group>
  );
});

function WoodWall({ w, L, H }: { w: Wall; L: number; H: number }) {
  const t = mm(w.thickness);
  const mat = wallMaterial(w, 'wood');
  return (
    <>
      {mat ? (
        <RoundedBox args={[L, H, t]} radius={0.003} smoothness={2} position={[L / 2, H / 2, 0]} material={mat} castShadow receiveShadow />
      ) : (
        <WoodGrainWall L={L} H={H} t={t} />
      )}
      <WallGraphics w={w} L={L - 0.002} H={H - 0.002} faceZ={t / 2} y0={0.001} />
    </>
  );
}

function OctaWall({ w, L, H }: { w: Wall; L: number; H: number }) {
  const offs = octaPostOffsets(wallLen(w)).map(mm);
  const lowH = Math.min(mm(OCTA_PANEL_H), H);
  const hasUpper = H > lowH + 0.06;
  const pt = 0.008;
  const mat = melamine(w.color);
  const beam = mm(OCTA_POST);
  const panels: React.ReactNode[] = [];
  for (let k = 0; k < offs.length - 1; k++) {
    const s0 = offs[k] + beam / 2;
    const s1 = offs[k + 1] - beam / 2;
    const pw = s1 - s0;
    const cx = (s0 + s1) / 2;
    panels.push(
      <mesh key={'l' + k} position={[cx, 0.015 + (lowH - 0.015) / 2, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[pw, lowH - 0.015, pt]} />
      </mesh>,
    );
    if (hasUpper) {
      panels.push(
        <mesh key={'b' + k} position={[cx, lowH + 0.025, 0]} material={aluminum()} castShadow receiveShadow>
          <boxGeometry args={[pw, 0.05, 0.03]} />
        </mesh>,
        <mesh key={'u' + k} position={[cx, (lowH + 0.05 + H) / 2, 0]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[pw, H - lowH - 0.05, pt]} />
        </mesh>,
      );
    }
    // 上端ビーム
    panels.push(
      <mesh key={'t' + k} position={[cx, H - 0.012, 0]} material={aluminum()} castShadow>
        <boxGeometry args={[pw, 0.024, 0.03]} />
      </mesh>,
    );
  }
  // 出力シートは下段パネル面に貼る(上段がある場合は上段も含めた全面)
  return (
    <>
      {panels}
      <WallGraphics w={w} L={L} H={H - 0.015} faceZ={pt / 2} y0={0.015} />
    </>
  );
}

function OctaPost({ x, z, h }: { x: number; z: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} material={aluminum()} castShadow receiveShadow>
        <cylinderGeometry args={[0.025, 0.025, h, 8]} />
      </mesh>
      <mesh position={[0, h + 0.004, 0]} material={paint('#2a2b2d', 0.6)}>
        <cylinderGeometry args={[0.022, 0.024, 0.008, 8]} />
      </mesh>
    </group>
  );
}

function WallSel({ L, H, t }: { L: number; H: number; t: number }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(L + 0.02, H + 0.02, t + 0.02)), [L, H, t]);
  return (
    <lineSegments geometry={geo} position={[L / 2, H / 2, 0]} renderOrder={10}>
      <lineBasicMaterial color="#ff6a1f" depthTest={false} transparent opacity={0.9} />
    </lineSegments>
  );
}

// ---- 社名板 ----

export const Fascia = memo(function Fascia({ booth, walls }: { booth: Booth; walls: Wall[] }) {
  const f = booth.fascia;
  const asset = useStore((s) => (f.logo ? s.assets[f.logo.assetId] : undefined));
  const logo = useHtmlImage(asset);
  const W = mm(booth.w);
  const D = mm(booth.d);
  const H = mm(booth.wallHeight);
  const fh = mm(f.height);
  const octa = booth.style === 'octanorm';
  const inset = mm(wallInset(booth.style));
  const span = W - inset * 2;
  const tex = useMemo(() => textTexture(f.text, { w: span * 1000, h: fh * 1000, bg: f.bg, fg: f.fg, logo }), [f.text, span, fh, f.bg, f.fg, logo]);
  if (!f.enabled) return null;

  // 前端の角に壁の端点がなければ支柱を立てる
  const ins = wallInset(booth.style);
  const hasEnd = (x: number) => walls.some((w) => [[w.x1, w.y1], [w.x2, w.y2]].some(([px, py]) => Math.abs(px - x) < 120 && Math.abs(py - (booth.d - ins)) < 160));
  const needL = !hasEnd(ins);
  const needR = !hasEnd(booth.w - ins);
  const z = D - inset;
  const y = H - fh / 2;

  if (octa) {
    return (
      <group>
        <mesh position={[W / 2, y, z]} material={melamine(f.bg)} castShadow receiveShadow>
          <boxGeometry args={[span - 0.05, fh - 0.05, 0.008]} />
        </mesh>
        <mesh position={[W / 2, y, z + 0.0045]}>
          <planeGeometry args={[span - 0.05, fh - 0.05]} />
          <meshStandardMaterial map={tex} roughness={0.4} />
        </mesh>
        {[H - 0.012, H - fh + 0.025].map((yy) => (
          <mesh key={yy} position={[W / 2, yy, z]} material={aluminum()} castShadow>
            <boxGeometry args={[span - 0.05, yy === H - 0.012 ? 0.024 : 0.05, 0.03]} />
          </mesh>
        ))}
        {needL && <OctaPost x={inset} z={z} h={H} />}
        {needR && <OctaPost x={W - inset} z={z} h={H} />}
      </group>
    );
  }
  const depth = 0.1;
  return (
    <group>
      <RoundedBox args={[W, fh, depth]} radius={0.003} smoothness={2} position={[W / 2, y, D - depth / 2]} material={paint(f.bg, 0.6)} castShadow receiveShadow />
      <mesh position={[W / 2, y, D + 0.0015]}>
        <planeGeometry args={[W - 0.004, fh - 0.004]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
      {needL && <RoundedBox args={[0.1, H - fh, 0.1]} radius={0.003} position={[0.05, (H - fh) / 2, D - 0.05]} material={paint(f.bg, 0.6)} castShadow receiveShadow />}
      {needR && <RoundedBox args={[0.1, H - fh, 0.1]} radius={0.003} position={[W - 0.05, (H - fh) / 2, D - 0.05]} material={paint(f.bg, 0.6)} castShadow receiveShadow />}
    </group>
  );
});
