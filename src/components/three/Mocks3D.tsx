import * as THREE from 'three';
import { useMemo } from 'react';
import type { Item } from '../../types';
import { aluminum, blackMetal, chrome, emissive, glass, metalPaint, paint, plastic, screenOff, shade } from './materials';
import { GraphicCylinder, GraphicPlane } from './Graphic3D';
import { Box, Cyl, RBox, Rod, type V3 } from './prims';

const mm = (v: number) => v / 1000;

/** 回転体。pts は [半径, 高さ] を下から順に */
function Lathe({ pts, m }: { pts: [number, number][]; m: THREE.Material }) {
  const key = JSON.stringify(pts);
  const geo = useMemo(() => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 56), [key]);
  return <mesh geometry={geo} material={m} castShadow receiveShadow />;
}

/** 発光面+貼付画像(画面) */
function Screen({ w, h, p, graphic }: { w: number; h: number; p: V3; graphic: Item['graphic'] }) {
  return (
    <>
      <mesh position={p} material={screenOff()}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <GraphicPlane graphic={graphic} w={w * 0.98} h={h * 0.98} position={[p[0], p[1], p[2] + 0.0006]} glow />
    </>
  );
}

/** 正面(+z)に向けた小さな丸部品 */
function Knob({ r, d, p, m }: { r: number; d: number; p: V3; m: THREE.Material }) {
  return <Cyl r={r} h={d} p={p} m={m} seg={20} rot={[Math.PI / 2, 0, 0]} />;
}

function Bottle({ it }: { it: Item }) {
  const R = mm(it.w) / 2;
  const H = mm(it.h);
  const col = it.color ?? '#2c5d9c';
  const body = useMemo<[number, number][]>(
    () => [
      [0, 0],
      [R * 0.8, 0],
      [R * 0.95, H * 0.012],
      [R, H * 0.05],
      [R, H * 0.6],
      [R * 0.97, H * 0.66],
      [R * 0.8, H * 0.76],
      [R * 0.55, H * 0.83],
      [R * 0.42, H * 0.86],
      [R * 0.42, H * 0.9],
    ],
    [R, H],
  );
  const labelY = H * 0.2;
  const labelH = H * 0.36;
  return (
    <>
      <Lathe pts={body} m={plastic(col)} />
      <Cyl r={R * 0.46} h={H * 0.1} p={[0, H * 0.95, 0]} m={plastic('#f3f2ee')} seg={32} />
      {it.graphic ? (
        <group position={[0, labelY, 0]}>
          <GraphicCylinder graphic={it.graphic} r={R} h={labelH} />
        </group>
      ) : (
        <Cyl r={R + 0.0006} h={labelH} p={[0, labelY + labelH / 2, 0]} m={paint('#f3f2ee', 0.5)} seg={48} />
      )}
    </>
  );
}

function Can({ it }: { it: Item }) {
  const R = mm(it.w) / 2;
  const H = mm(it.h);
  const col = it.color ?? '#b3282d';
  const body = useMemo<[number, number][]>(
    () => [
      [R * 0.74, 0],
      [R * 0.84, 0],
      [R, H * 0.06],
      [R, H * 0.92],
      [R * 0.86, H * 0.975],
      [R * 0.86, H],
    ],
    [R, H],
  );
  return (
    <>
      <Lathe pts={body} m={metalPaint(col)} />
      <Cyl r={R * 0.84} h={H * 0.012} p={[0, H * 0.985, 0]} m={aluminum()} seg={40} />
      <Cyl r={R * 0.74} h={H * 0.012} p={[0, H * 0.006, 0]} m={aluminum()} seg={40} />
      {it.graphic && (
        <group position={[0, H * 0.08, 0]}>
          <GraphicCylinder graphic={it.graphic} r={R} h={H * 0.82} />
        </group>
      )}
    </>
  );
}

function Device({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const foot = Math.min(0.012, H * 0.08);
  const bh = H - foot;
  const front = D / 2;
  const sw = W * 0.52;
  const sh = bh * 0.56;
  const cy = foot + bh * 0.54;
  return (
    <>
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz], i) => (
        <Cyl key={i} r={foot * 0.9} h={foot} p={[sx * (W / 2 - 0.025), foot / 2, sz * (D / 2 - 0.025)]} m={blackMetal()} seg={12} />
      ))}
      <RBox s={[W, bh, D]} p={[0, foot + bh / 2, 0]} m={metalPaint(it.color ?? '#c9cbcc')} radius={0.006} />
      <Screen w={sw} h={sh} p={[-W * 0.17, cy, front + 0.0006]} graphic={it.graphic} />
      {[0, 1, 2].map((i) => (
        <Knob key={i} r={Math.min(0.011, W * 0.04)} d={0.008} p={[W * 0.22 + (i - 1) * W * 0.085, cy + sh * 0.2, front + 0.004]} m={blackMetal()} />
      ))}
      <Knob r={Math.min(0.006, W * 0.02)} d={0.003} p={[W * 0.22 - W * 0.085, cy - sh * 0.25, front + 0.0015]} m={emissive('#35d06a', 2.5)} />
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[W * 0.4, 0.0015, 0.006]} p={[W * 0.14, H + 0.0002, -D * 0.22 + i * 0.014]} m={paint('#1d1e20', 0.8)} noShadow />
      ))}
    </>
  );
}

function CtrlBox({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#c9cbcc';
  const front = D / 2;
  const lampR = Math.min(0.016, W * 0.045);
  return (
    <>
      <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={metalPaint(col)} radius={0.005} />
      <Box s={[W - 0.03, H - 0.03, 0.004]} p={[0, H / 2, front + 0.002]} m={metalPaint(shade(col, 0.93))} />
      <Screen w={W * 0.6} h={H * 0.32} p={[0, H * 0.56, front + 0.0046]} graphic={it.graphic} />
      {['#ff3b30', '#ffc107', '#35d06a'].map((c, i) => (
        <Knob key={c} r={lampR} d={0.012} p={[(i - 1) * lampR * 3.2, H * 0.84, front + 0.008]} m={emissive(c, 2.2)} />
      ))}
      <Knob r={lampR * 1.5} d={0.022} p={[-W * 0.22, H * 0.22, front + 0.014]} m={plastic('#c8201f')} />
      <Knob r={lampR * 0.9} d={0.012} p={[W * 0.02, H * 0.22, front + 0.009]} m={plastic('#2a2b2d')} />
      <Box s={[0.02, H * 0.14, 0.018]} p={[W / 2 - 0.05, H * 0.5, front + 0.012]} m={chrome()} />
    </>
  );
}

function Motor({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#2c5d9c';
  const baseH = Math.max(0.01, H * 0.06);
  const R = Math.min(D / 2, (H - baseH) * 0.47);
  const cy = H - R;
  const L = W * 0.68;
  const shaftL = W * 0.14;
  const cx = -W / 2 + W * 0.04 + L / 2;
  const axis: V3 = [0, 0, Math.PI / 2];
  return (
    <>
      <Box s={[L * 0.8, baseH, D * 0.96]} p={[cx, baseH / 2, 0]} m={metalPaint(col)} />
      {[-1, 1].map((s) => (
        <Box key={s} s={[L * 0.14, cy - baseH, D * 0.62]} p={[cx + s * L * 0.3, baseH + (cy - baseH) / 2, 0]} m={metalPaint(col)} />
      ))}
      <Cyl r={R * 0.9} h={L} p={[cx, cy, 0]} m={metalPaint(col)} rot={axis} seg={40} />
      {Array.from({ length: 20 }).map((_, i) => (
        <group key={i} position={[cx, cy, 0]} rotation={[(i / 20) * Math.PI * 2, 0, 0]}>
          <Box s={[L * 0.86, R * 0.12, Math.max(0.002, R * 0.05)]} p={[0, R * 0.94, 0]} m={metalPaint(col)} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <Cyl key={s} r={R} r2={R} h={L * 0.09} p={[cx + (s * (L - L * 0.09)) / 2, cy, 0]} m={metalPaint(shade(col, 0.85))} rot={axis} seg={40} />
      ))}
      <Cyl r={R * 0.2} h={W * 0.04 + shaftL} p={[cx + L / 2 + (W * 0.04 + shaftL) / 2, cy, 0]} m={chrome()} rot={axis} seg={20} />
      <Cyl r={R * 0.72} h={W * 0.04} p={[-W / 2 + W * 0.02, cy, 0]} m={blackMetal()} rot={axis} seg={32} />
      <RBox s={[L * 0.26, R * 0.46, R * 0.5]} p={[cx, cy + R * 0.3, R * 0.92]} m={metalPaint(shade(col, 0.9))} radius={0.004} />
    </>
  );
}

function Compressor({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#b3282d';
  const legH = H * 0.1;
  const R = Math.min(D / 2, H * 0.27);
  const cy = legH + R;
  const capX = R * 0.45;
  const L = W - capX * 2;
  const axis: V3 = [0, 0, Math.PI / 2];
  const top = cy + R;
  const upH = H - top;
  const wheelR = legH * 0.75;
  return (
    <>
      <Cyl r={R} h={L} p={[0, cy, 0]} m={metalPaint(col)} rot={axis} seg={40} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * L) / 2, cy, 0]} scale={[capX, R, R]} material={metalPaint(col)} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 20]} />
        </mesh>
      ))}
      {/* 脚と車輪 */}
      <Box s={[0.03, legH + R * 0.2, D * 0.7]} p={[-L * 0.34, (legH + R * 0.2) / 2, 0]} m={blackMetal()} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cyl r={wheelR} h={0.03} p={[L * 0.34, wheelR, s * D * 0.4]} m={blackMetal()} rot={[Math.PI / 2, 0, 0]} seg={28} />
          <Cyl r={wheelR * 0.5} h={0.032} p={[L * 0.34, wheelR, s * D * 0.4]} m={aluminum()} rot={[Math.PI / 2, 0, 0]} seg={20} />
        </group>
      ))}
      <Box s={[0.02, 0.02, D * 0.8]} p={[L * 0.34, wheelR, 0]} m={aluminum()} />
      {/* 架台の上の機器 */}
      <Box s={[W * 0.62, Math.max(0.008, upH * 0.05), R * 1.5]} p={[0, top + upH * 0.025, 0]} m={blackMetal()} />
      <Cyl r={Math.min(upH * 0.34, R * 0.75)} h={W * 0.24} p={[-W * 0.17, top + upH * 0.05 + Math.min(upH * 0.34, R * 0.75), 0]} m={metalPaint('#2a2b2d')} rot={axis} seg={28} />
      <RBox s={[W * 0.12, upH * 0.86, R * 0.95]} p={[W * 0.16, top + upH * 0.05 + upH * 0.43, 0]} m={aluminum()} radius={0.008} />
      <Cyl r={W * 0.075} h={upH * 0.09} p={[W * 0.16, H - upH * 0.045, 0]} m={blackMetal()} seg={24} />
      <RBox s={[W * 0.05, upH * 0.6, R * 1.15]} p={[0, top + upH * 0.05 + upH * 0.3, 0]} m={metalPaint(shade(col, 0.85))} radius={0.01} />
      {/* 圧力計・配管 */}
      <Rod a={[W * 0.26, top, R * 0.5]} b={[W * 0.26, top + upH * 0.34, R * 0.5]} r={0.006} m={chrome()} />
      <Knob r={Math.min(0.03, upH * 0.13)} d={0.016} p={[W * 0.26, top + upH * 0.42, R * 0.5]} m={chrome()} />
      <Knob r={Math.min(0.025, upH * 0.11)} d={0.002} p={[W * 0.26, top + upH * 0.42, R * 0.5 + 0.009]} m={paint('#f3f2ee', 0.3)} />
    </>
  );
}

function Machine({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#e4e5e3';
  const baseH = H * 0.08;
  const bodyH = H * 0.8;
  const front = D / 2;
  const bodyTop = baseH + bodyH;
  const winW = W * 0.56;
  const winH = bodyH * 0.5;
  const winX = -W * 0.16;
  const winY = baseH + bodyH * 0.6;
  const panelW = W * 0.2;
  const panelX = W * 0.32;
  const towerR = Math.min(0.04, W * 0.03);
  const towerY = bodyTop + H * 0.05;
  const seg = (H - towerY - 0.02) / 3;
  return (
    <>
      <Box s={[W * 0.97, baseH, D * 0.95]} p={[0, baseH / 2, 0]} m={blackMetal()} />
      <RBox s={[W, bodyH, D]} p={[0, baseH + bodyH / 2, 0]} m={metalPaint(col)} radius={0.01} />
      <RBox s={[W * 0.86, H * 0.05, D * 0.8]} p={[0, bodyTop + H * 0.025, 0]} m={metalPaint(shade(col, 0.88))} radius={0.008} />
      {/* 加工室の窓 */}
      <Box s={[winW + 0.04, winH + 0.04, 0.008]} p={[winX, winY, front + 0.004]} m={metalPaint(shade(col, 0.75))} />
      <mesh position={[winX, winY, front + 0.0085]}>
        <planeGeometry args={[winW, winH]} />
        <meshStandardMaterial color="#20252b" roughness={0.5} metalness={0.4} />
      </mesh>
      <Knob r={Math.min(winW, winH) * 0.2} d={0.01} p={[winX, winY + winH * 0.08, front + 0.012]} m={chrome()} />
      <Knob r={Math.min(winW, winH) * 0.09} d={0.01} p={[winX, winY + winH * 0.08, front + 0.02]} m={aluminum()} />
      <Box s={[winW * 0.8, 0.012, 0.004]} p={[winX, winY - winH * 0.3, front + 0.011]} m={aluminum()} />
      <mesh position={[winX, winY, front + 0.03]} material={glass()}>
        <planeGeometry args={[winW, winH]} />
      </mesh>
      <Box s={[winW * 0.5, 0.02, 0.03]} p={[winX, winY - winH / 2 - 0.05, front + 0.02]} m={chrome()} />
      {/* 下部の扉 */}
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.004, bodyH * 0.2, 0.002]} p={[s * W * 0.2 + winX, baseH + bodyH * 0.14, front + 0.001]} m={paint('#5b6068', 0.7)} noShadow />
      ))}
      <Box s={[W * 0.9, 0.004, 0.002]} p={[0, baseH + bodyH * 0.27, front + 0.001]} m={paint('#5b6068', 0.7)} noShadow />
      {/* 操作盤 */}
      <RBox s={[panelW, bodyH * 0.5, 0.05]} p={[panelX, winY, front + 0.025]} m={metalPaint('#3a3f47')} radius={0.008} />
      <Screen w={panelW * 0.84} h={bodyH * 0.24} p={[panelX, winY + bodyH * 0.1, front + 0.0512]} graphic={it.graphic} />
      {[0, 1, 2, 3].map((i) => (
        <Knob key={i} r={panelW * 0.05} d={0.008} p={[panelX - panelW * 0.3 + i * panelW * 0.2, winY - bodyH * 0.08, front + 0.054]} m={plastic(['#35a853', '#d9a53a', '#2c5d9c', '#f3f2ee'][i])} />
      ))}
      <Knob r={panelW * 0.1} d={0.022} p={[panelX, winY - bodyH * 0.18, front + 0.06]} m={plastic('#c8201f')} />
      {/* 積層表示灯 */}
      <Cyl r={towerR * 0.45} h={towerY - bodyTop} p={[W * 0.36, (towerY + bodyTop) / 2, -D * 0.3]} m={aluminum()} seg={12} />
      {['#35d06a', '#ffc107', '#ff3b30'].map((c, i) => (
        <Cyl key={c} r={towerR} h={seg * 0.92} p={[W * 0.36, towerY + seg * (i + 0.5), -D * 0.3]} m={emissive(c, i === 0 ? 2.2 : 0.5)} seg={20} />
      ))}
    </>
  );
}

export function MockBody({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#f3f2ee';
  switch (it.kind) {
    case 'mock_cylinder':
      return <Cyl r={W / 2} h={H} p={[0, H / 2, 0]} m={paint(col, 0.5)} seg={64} />;
    case 'mock_bottle':
      return <Bottle it={it} />;
    case 'mock_can':
      return <Can it={it} />;
    case 'mock_device':
      return <Device it={it} />;
    case 'mock_ctrlbox':
      return <CtrlBox it={it} />;
    case 'mock_motor':
      return <Motor it={it} />;
    case 'mock_compressor':
      return <Compressor it={it} />;
    case 'mock_machine':
      return <Machine it={it} />;
    default:
      return (
        <>
          <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={paint(col, 0.5)} radius={0.003} />
          <GraphicPlane graphic={it.graphic} w={W} h={H} position={[0, H / 2, D / 2 + 0.0008]} />
        </>
      );
  }
}
