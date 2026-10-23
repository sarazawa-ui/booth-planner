import * as THREE from 'three';
import { memo, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Item, LightSetting } from '../../types';
import { defOf } from '../../catalog';
import { useStore } from '../../store';
import { aluminum, blackMetal, chrome, emissive, fabric, foliage, glass, melamine, paint, plastic, screenOff, shade } from './materials';
import { GraphicCylinder, GraphicPlane } from './Graphic3D';
import { kelvinToColor, punchCarpet, textTexture, useHtmlImage } from '../../lib/textures';
import { loadModel, modelBounds } from '../../lib/models';

type V3 = [number, number, number];
const mm = (v: number) => v / 1000;

function Box({ s, p, m, r, noShadow }: { s: V3; p: V3; m: THREE.Material; r?: V3; noShadow?: boolean }) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow={!noShadow} receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

function RBox({ s, p, m, radius = 0.006 }: { s: V3; p: V3; m: THREE.Material; radius?: number }) {
  const rr = Math.min(radius, Math.min(...s) / 2.2);
  return (
    <RoundedBox args={s} radius={rr} smoothness={3} position={p} material={m} castShadow receiveShadow />
  );
}

function Cyl({ r, r2, h, p, m, seg = 40, rot }: { r: number; r2?: number; h: number; p: V3; m: THREE.Material; seg?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
    </mesh>
  );
}

/** 2点を結ぶ細い棒 */
function Rod({ a, b, r, m }: { a: V3; b: V3; r: number; m: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat, len };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={m} castShadow>
      <cylinderGeometry args={[r, r, len, 10]} />
    </mesh>
  );
}

// ---- 照明 ----

function lightIntensity(l: LightSetting, watt: number) {
  return l.on ? 9 * l.intensity * Math.sqrt(watt / 15) : 0;
}

function Spot({ pos, target, light, watt }: { pos: V3; target: V3; light: LightSetting; watt: number }) {
  const tObj = useMemo(() => new THREE.Object3D(), []);
  const quality = useStore((s) => s.quality);
  const shadowCount = useStore((s) => s.project.items.filter((i) => defOf(i.kind).light).length);
  useLayoutEffect(() => {
    tObj.position.set(...target);
    tObj.updateMatrixWorld();
  }, [tObj, target]);
  const color = useMemo(() => kelvinToColor(light.kelvin), [light.kelvin]);
  if (!light.on) return <primitive object={tObj} />;
  return (
    <>
      <primitive object={tObj} />
      <spotLight
        position={pos}
        target={tObj}
        color={color}
        intensity={lightIntensity(light, watt)}
        angle={((light.angle / 2) * Math.PI) / 180}
        penumbra={0.6}
        decay={2}
        distance={14}
        castShadow={quality === 'high' && shadowCount <= 12}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-near={0.05}
      />
    </>
  );
}

/** 灯体(円筒)を pos から target 方向へ向ける */
function Head({ pos, target, r, len, on, kelvin }: { pos: V3; target: V3; r: number; len: number; on: boolean; kelvin: number }) {
  const quat = useMemo(() => {
    const d = new THREE.Vector3(...target).sub(new THREE.Vector3(...pos)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  }, [pos, target]);
  const col = useMemo(() => '#' + kelvinToColor(kelvin).getHexString(), [kelvin]);
  return (
    <group position={pos} quaternion={quat}>
      <mesh material={blackMetal()} castShadow position={[0, len / 2, 0]}>
        <cylinderGeometry args={[r, r * 0.85, len, 24]} />
      </mesh>
      <mesh position={[0, -0.001, 0]} rotation={[Math.PI / 2, 0, 0]} material={on ? emissive(col, 6) : blackMetal()}>
        <circleGeometry args={[r * 0.8, 24]} />
      </mesh>
    </group>
  );
}

// ---- 本体 ----

function Body({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#f3f2ee';
  const def = defOf(it.kind);
  const watt = def.light?.watt ?? 15;
  const light = it.light ?? { on: true, intensity: 1, angle: 38, kelvin: 3500 };

  switch (it.kind) {
    case 'stage_box':
    case 'counter_storage': {
      const plinth = Math.min(0.04, H * 0.2);
      return (
        <>
          <Box s={[W - 0.03, plinth, D - 0.03]} p={[0, plinth / 2, 0]} m={paint('#2c2d30', 0.7)} />
          <RBox s={[W, H - plinth, D]} p={[0, plinth + (H - plinth) / 2, 0]} m={paint(col, 0.5)} />
          {it.kind === 'counter_storage' && (
            <>
              <Box s={[0.004, H - plinth - 0.06, 0.002]} p={[0, plinth + (H - plinth) / 2, D / 2 + 0.001]} m={paint(shade(col, 0.7), 0.6)} noShadow />
              {[-1, 1].map((s) => (
                <Box key={s} s={[0.012, 0.12, 0.02]} p={[s * 0.04, plinth + (H - plinth) * 0.75, D / 2 + 0.01]} m={chrome()} />
              ))}
            </>
          )}
        </>
      );
    }
    case 'stage_low':
      return <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={paint(col, 0.5)} radius={0.004} />;
    case 'stage_round': {
      const plinth = Math.min(0.04, H * 0.2);
      return (
        <>
          <Cyl r={W / 2 - 0.02} h={plinth} p={[0, plinth / 2, 0]} m={paint('#2c2d30', 0.7)} seg={64} />
          <Cyl r={W / 2} h={H - plinth} p={[0, plinth + (H - plinth) / 2, 0]} m={paint(col, 0.5)} seg={64} />
        </>
      );
    }
    case 'stage_acrylic': {
      const ch = Math.min(0.35, H * 0.35);
      const bh = H - ch;
      return (
        <>
          <RBox s={[W, bh, D]} p={[0, bh / 2, 0]} m={paint(col, 0.5)} />
          <Box s={[W - 0.02, ch, D - 0.02]} p={[0, bh + ch / 2, 0]} m={glass()} noShadow />
        </>
      );
    }
    case 'case_low': {
      const gh = Math.min(0.28, H * 0.3);
      const bh = H - gh;
      return (
        <>
          <RBox s={[W, bh, D]} p={[0, bh / 2, 0]} m={paint(col, 0.5)} />
          <Box s={[W - 0.01, gh, D - 0.01]} p={[0, bh + gh / 2, 0]} m={glass()} noShadow />
          <GlassFrame w={W - 0.01} h={gh} d={D - 0.01} y={bh} />
        </>
      );
    }
    case 'case_tower': {
      const bh = 0.3;
      const th = 0.12;
      const gh = Math.max(0.2, H - bh - th);
      return (
        <>
          <RBox s={[W, bh, D]} p={[0, bh / 2, 0]} m={paint(col, 0.5)} />
          <Box s={[W - 0.01, gh, D - 0.01]} p={[0, bh + gh / 2, 0]} m={glass()} noShadow />
          <GlassFrame w={W - 0.01} h={gh} d={D - 0.01} y={bh} />
          {[0.38, 0.7].map((f) => (
            <Box key={f} s={[W - 0.03, 0.008, D - 0.03]} p={[0, bh + gh * f, 0]} m={glass()} noShadow />
          ))}
          <RBox s={[W, th, D]} p={[0, bh + gh + th / 2, 0]} m={paint(col, 0.5)} />
          <mesh position={[0, bh + gh - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]} material={emissive('#fff4e0', 2.5)}>
            <planeGeometry args={[W * 0.6, D * 0.6]} />
          </mesh>
          <pointLight position={[0, bh + gh - 0.06, 0]} intensity={0.25} distance={1.2} decay={2} color="#fff1dc" />
        </>
      );
    }
    case 'counter': {
      const top = 0.03;
      const plinth = 0.05;
      const bodyH = H - top - plinth;
      return (
        <>
          <Box s={[W - 0.06, plinth, D - 0.06]} p={[0, plinth / 2, -0.01]} m={paint('#2c2d30', 0.7)} />
          <RBox s={[W, bodyH, D - 0.03]} p={[0, plinth + bodyH / 2, -0.015]} m={paint(col, 0.5)} />
          <RBox s={[W + 0.02, top, D + 0.02]} p={[0, H - top / 2, 0]} m={paint(col === '#f3f2ee' ? '#c89f6e' : '#f3f2ee', 0.45)} radius={0.008} />
          {it.graphic && <GraphicPlane graphic={it.graphic} w={W - 0.04} h={bodyH - 0.04} position={[0, plinth + bodyH / 2, D / 2 - 0.03 + 0.0015]} />}
        </>
      );
    }
    case 'table_round':
    case 'table_high': {
      const tr = W / 2;
      return (
        <>
          <Cyl r={tr} h={0.025} p={[0, H - 0.0125, 0]} m={paint(col, 0.4)} seg={64} />
          <Cyl r={0.03} h={H - 0.03} p={[0, (H - 0.03) / 2, 0]} m={chrome()} />
          <Cyl r={Math.min(0.28, tr * 0.7)} r2={Math.min(0.3, tr * 0.75)} h={0.015} p={[0, 0.0075, 0]} m={chrome()} seg={48} />
        </>
      );
    }
    case 'table_rect': {
      const leg = 0.035;
      return (
        <>
          <RBox s={[W, 0.025, D]} p={[0, H - 0.0125, 0]} m={paint(col, 0.4)} radius={0.004} />
          {[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([sx, sz], i) => (
            <Box key={i} s={[leg, H - 0.025, leg]} p={[sx * (W / 2 - 0.06), (H - 0.025) / 2, sz * (D / 2 - 0.06)]} m={aluminum()} />
          ))}
        </>
      );
    }
    case 'chair': {
      const seatH = 0.45;
      const m = plastic(col);
      return (
        <>
          <RBox s={[W * 0.95, 0.04, D * 0.85]} p={[0, seatH, 0.02]} m={m} radius={0.015} />
          <group position={[0, seatH + 0.22, -D / 2 + 0.06]} rotation={[-0.12, 0, 0]}>
            <RBox s={[W * 0.92, 0.28, 0.03]} p={[0, 0.06, 0]} m={m} radius={0.012} />
          </group>
          {[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([sx, sz], i) => (
            <Rod key={i} a={[sx * (W / 2 - 0.04), seatH - 0.02, sz * (D / 2 - 0.08) + 0.02]} b={[sx * (W / 2 - 0.02), 0, sz * (D / 2 - 0.04) + 0.02]} r={0.009} m={chrome()} />
          ))}
          {[-1, 1].map((sx) => (
            <Rod key={'b' + sx} a={[sx * (W / 2 - 0.05), seatH, -D / 2 + 0.07]} b={[sx * (W / 2 - 0.05), seatH + 0.28, -D / 2 + 0.03]} r={0.008} m={chrome()} />
          ))}
        </>
      );
    }
    case 'stool': {
      return (
        <>
          <Cyl r={W / 2} h={0.06} p={[0, H - 0.03, 0]} m={plastic(col)} seg={40} />
          <Cyl r={0.022} h={H - 0.06} p={[0, (H - 0.06) / 2, 0]} m={chrome()} />
          <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={chrome()} castShadow>
            <torusGeometry args={[W * 0.4, 0.009, 8, 40]} />
          </mesh>
          <Cyl r={W * 0.45} r2={W * 0.5} h={0.015} p={[0, 0.0075, 0]} m={chrome()} />
        </>
      );
    }
    case 'pamphlet': {
      const n = Math.max(2, Math.floor((H - 0.35) / 0.28));
      return (
        <>
          <Box s={[W, H - 0.02, 0.012]} p={[0, (H - 0.02) / 2 + 0.02, -D / 2 + 0.12]} m={aluminum()} />
          <Box s={[W * 0.9, 0.02, D]} p={[0, 0.01, 0]} m={blackMetal()} />
          {Array.from({ length: n }).map((_, i) => {
            const y = 0.35 + i * 0.28;
            return (
              <group key={i} position={[0, y, -D / 2 + 0.2]} rotation={[-0.25, 0, 0]}>
                <Box s={[W * 0.96, 0.18, 0.005]} p={[0, 0.09, 0.03]} m={glass()} noShadow />
                <Box s={[W * 0.96, 0.006, 0.035]} p={[0, 0, 0.012]} m={glass()} noShadow />
                <Box s={[W * 0.8, 0.22, 0.004]} p={[0, 0.13, 0.016]} m={paint(['#2c5d9c', '#f3f2ee', '#b3282d', '#3d7a4f'][i % 4], 0.5)} />
              </group>
            );
          })}
        </>
      );
    }
    case 'shelf': {
      return (
        <>
          <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={paint(col, 0.45)} radius={0.004} />
          {[-1, 1].map((s) => (
            <Box key={s} s={[0.012, 0.12, D * 0.8]} p={[s * (W / 2 - 0.12), -0.06, -D * 0.1]} m={aluminum()} />
          ))}
        </>
      );
    }
    case 'plant':
      return <Plant it={it} />;
    case 'arm_spot': {
      const head: V3 = [0, H * 0.7, D / 2 - 0.04];
      const target: V3 = [0, -1.35, -D / 2];
      return (
        <>
          <Box s={[0.08, 0.16, 0.03]} p={[0, H * 0.4, -D / 2 + 0.015]} m={blackMetal()} />
          <Rod a={[0, H * 0.6, -D / 2 + 0.02]} b={[0, head[1] + 0.06, head[2]]} r={0.008} m={blackMetal()} />
          <Head pos={head} target={target} r={0.035} len={0.13} on={light.on} kelvin={light.kelvin} />
          <Spot pos={head} target={target} light={light} watt={watt} />
        </>
      );
    }
    case 'stand_spot': {
      const head: V3 = [0, H - 0.08, 0];
      const target: V3 = [0, 0.4, 2.2];
      return (
        <>
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2;
            return <Rod key={i} a={[0, 0.6, 0]} b={[Math.sin(a) * W * 0.45, 0, Math.cos(a) * W * 0.45]} r={0.008} m={blackMetal()} />;
          })}
          <Cyl r={0.012} h={H - 0.1} p={[0, (H - 0.1) / 2 + 0.05, 0]} m={blackMetal()} />
          <Head pos={head} target={target} r={0.05} len={0.16} on={light.on} kelvin={light.kelvin} />
          <Spot pos={head} target={target} light={light} watt={watt} />
        </>
      );
    }
    case 'led_bar': {
      const col2 = '#' + kelvinToColor(light.kelvin).getHexString();
      return (
        <>
          <Box s={[W, H, D]} p={[0, H / 2, 0]} m={aluminum()} />
          <mesh position={[0, -0.0005, 0.005]} rotation={[Math.PI / 2, 0, 0]} material={light.on ? emissive(col2, 4) : blackMetal()}>
            <planeGeometry args={[W - 0.01, D * 0.5]} />
          </mesh>
          {light.on && (
            <rectAreaLight args={[col2, 3.2 * light.intensity, W, 0.03]} position={[0, -0.005, 0.01]} rotation={[-Math.PI / 2, 0, 0]} />
          )}
        </>
      );
    }
    case 'pendant': {
      const shadeH = 0.25;
      const col2 = '#' + kelvinToColor(light.kelvin).getHexString();
      return (
        <>
          <Cyl r={0.003} h={H - shadeH} p={[0, shadeH + (H - shadeH) / 2, 0]} m={blackMetal()} seg={6} />
          <mesh position={[0, shadeH / 2, 0]} material={plastic(col)} castShadow>
            <cylinderGeometry args={[0.04, W / 2, shadeH, 40, 1, true]} />
          </mesh>
          <mesh position={[0, shadeH * 0.35, 0]} material={light.on ? emissive(col2, 5) : paint('#ddd')}>
            <sphereGeometry args={[0.04, 16, 12]} />
          </mesh>
          <Spot pos={[0, 0.05, 0]} target={[0, -2, 0]} light={light} watt={watt} />
        </>
      );
    }
    case 'truss_spot': {
      const head: V3 = [0, H * 0.45, 0];
      const target: V3 = [0, -3.2, 0.5];
      return (
        <>
          <Box s={[0.06, 0.06, 0.08]} p={[0, H - 0.03, 0]} m={blackMetal()} />
          <Rod a={[0, H - 0.05, 0]} b={[0, head[1] + 0.08, 0]} r={0.008} m={blackMetal()} />
          <Head pos={head} target={target} r={0.05} len={0.17} on={light.on} kelvin={light.kelvin} />
          <Spot pos={head} target={target} light={light} watt={watt} />
        </>
      );
    }
    case 'panel_free': {
      const t = Math.max(0.02, D);
      return (
        <>
          <RBox s={[W, H - 0.04, t]} p={[0, 0.04 + (H - 0.04) / 2, 0]} m={paint(col, 0.5)} radius={0.003} />
          {[-1, 1].map((s) => (
            <Box key={s} s={[0.05, 0.04, 0.4]} p={[s * (W / 2 - 0.12), 0.02, 0]} m={blackMetal()} />
          ))}
          <GraphicPlane placeholder graphic={it.graphic} w={W - 0.004} h={H - 0.044} position={[0, 0.04 + (H - 0.04) / 2, t / 2 + 0.0012]} />
        </>
      );
    }
    case 'panel_wall': {
      const t = Math.max(0.003, D);
      return (
        <>
          <Box s={[W, H, t]} p={[0, H / 2, 0]} m={paint(col, 0.5)} />
          <GraphicPlane placeholder graphic={it.graphic} w={W} h={H} position={[0, H / 2, t / 2 + 0.0008]} />
        </>
      );
    }
    case 'banner_stand': {
      const gh = H - 0.09;
      return (
        <>
          <RBox s={[W + 0.02, 0.09, 0.2]} p={[0, 0.045, 0]} m={aluminum()} radius={0.03} />
          {[-1, 1].map((s) => (
            <Box key={s} s={[0.03, 0.01, 0.3]} p={[s * (W / 2 - 0.08), 0.005, 0]} m={aluminum()} />
          ))}
          <Box s={[W, gh, 0.002]} p={[0, 0.09 + gh / 2, 0.02]} m={paint('#f6f6f4', 0.6)} />
          <Cyl r={0.008} h={gh} p={[0, 0.09 + gh / 2, 0.005]} m={aluminum()} seg={8} />
          <Box s={[W, 0.02, 0.02]} p={[0, H - 0.01, 0.02]} m={aluminum()} />
          <GraphicPlane placeholder graphic={it.graphic} w={W} h={gh - 0.02} position={[0, 0.09 + (gh - 0.02) / 2, 0.0215]} />
        </>
      );
    }
    case 'hang_square': {
      const faces: { w: number; p: V3; r: number }[] = [
        { w: W, p: [0, H / 2, D / 2], r: 0 },
        { w: W, p: [0, H / 2, -D / 2], r: Math.PI },
        { w: D, p: [W / 2, H / 2, 0], r: Math.PI / 2 },
        { w: D, p: [-W / 2, H / 2, 0], r: -Math.PI / 2 },
      ];
      return (
        <>
          {faces.map((f, i) => (
            <group key={i} position={f.p} rotation={[0, f.r, 0]}>
              <Box s={[f.w, H, 0.01]} p={[0, 0, -0.005]} m={fabric('#f4f4f2')} />
              <GraphicPlane graphic={it.graphic} w={f.w} h={H} position={[0, 0, 0.0008]} />
            </group>
          ))}
          {[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([sx, sz], i) => (
            <Rod key={i} a={[(sx * W) / 2.05, H, (sz * D) / 2.05]} b={[(sx * W) / 2.6, H + 4, (sz * D) / 2.6]} r={0.002} m={blackMetal()} />
          ))}
        </>
      );
    }
    case 'hang_round': {
      const r = W / 2;
      return (
        <>
          <mesh position={[0, H / 2, 0]} material={fabric('#f4f4f2')} castShadow>
            <cylinderGeometry args={[r, r, H, 96, 1, true]} />
          </mesh>
          <mesh position={[0, H / 2, 0]}>
            <cylinderGeometry args={[r - 0.004, r - 0.004, H, 96, 1, true]} />
            <meshStandardMaterial side={THREE.BackSide} color="#e9e9e6" roughness={0.9} />
          </mesh>
          <GraphicCylinder graphic={it.graphic} r={r} h={H} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return <Rod key={i} a={[Math.sin(a) * r * 0.98, H, Math.cos(a) * r * 0.98]} b={[Math.sin(a) * r * 0.75, H + 4, Math.cos(a) * r * 0.75]} r={0.002} m={blackMetal()} />;
          })}
        </>
      );
    }
    case 'cutout':
      return <Cutout it={it} />;
    case 'monitor_stand': {
      const sw = W;
      const sh = W * 0.5625 + 0.03;
      const yTop = H;
      return (
        <>
          <RBox s={[sw, sh, 0.06]} p={[0, yTop - sh / 2, 0]} m={blackMetal()} radius={0.008} />
          <mesh position={[0, yTop - sh / 2, 0.0305]} material={screenOff()}>
            <planeGeometry args={[sw - 0.024, sh - 0.024]} />
          </mesh>
          <GraphicPlane graphic={it.graphic} w={sw - 0.026} h={sh - 0.026} position={[0, yTop - sh / 2, 0.031]} glow />
          {[-1, 1].map((s) => (
            <Box key={s} s={[0.05, yTop - sh * 0.4, 0.04]} p={[s * sw * 0.28, (yTop - sh * 0.4) / 2, -0.05]} m={blackMetal()} />
          ))}
          {[-1, 1].map((s) => (
            <Box key={'f' + s} s={[0.07, 0.04, D]} p={[s * sw * 0.28, 0.02, 0]} m={blackMetal()} />
          ))}
        </>
      );
    }
    case 'monitor_wall': {
      return (
        <>
          <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={blackMetal()} radius={0.008} />
          <mesh position={[0, H / 2, D / 2 + 0.0005]} material={screenOff()}>
            <planeGeometry args={[W - 0.024, H - 0.024]} />
          </mesh>
          <GraphicPlane graphic={it.graphic} w={W - 0.026} h={H - 0.026} position={[0, H / 2, D / 2 + 0.001]} glow />
        </>
      );
    }
    case 'monitor_desk': {
      const sh = W * 0.5625 + 0.02;
      const sy = H - sh / 2;
      const zs = -D * 0.12;
      return (
        <>
          <RBox s={[W * 0.42, 0.012, D]} p={[0, 0.006, 0]} m={blackMetal()} radius={0.005} />
          <Box s={[0.05, H - sh * 0.6, 0.025]} p={[0, (H - sh * 0.6) / 2, zs - 0.035]} m={blackMetal()} />
          <RBox s={[W, sh, 0.03]} p={[0, sy, zs]} m={blackMetal()} radius={0.005} />
          <mesh position={[0, sy, zs + 0.0155]} material={screenOff()}>
            <planeGeometry args={[W - 0.018, sh - 0.022]} />
          </mesh>
          <GraphicPlane graphic={it.graphic} w={W - 0.02} h={sh - 0.024} position={[0, sy, zs + 0.016]} glow />
        </>
      );
    }
    case 'tablet': {
      const tw = W * 0.96;
      const th = Math.min(H * 0.95, tw * 0.72);
      return (
        <>
          <RBox s={[W * 0.6, 0.015, D * 0.8]} p={[0, 0.0075, 0]} m={aluminum()} radius={0.006} />
          <Rod a={[0, 0.015, -D * 0.2]} b={[0, H * 0.5, -0.02]} r={0.008} m={aluminum()} />
          <group position={[0, H - th / 2 - 0.005, 0]} rotation={[-0.28, 0, 0]}>
            <RBox s={[tw, th, 0.009]} p={[0, 0, 0]} m={blackMetal()} radius={0.004} />
            <mesh position={[0, 0, 0.0046]} material={screenOff()}>
              <planeGeometry args={[tw - 0.016, th - 0.016]} />
            </mesh>
            <GraphicPlane graphic={it.graphic} w={tw - 0.018} h={th - 0.018} position={[0, 0, 0.0048]} glow />
          </group>
        </>
      );
    }
    case 'catalog_desk':
      return <CatalogDesk it={it} />;
    case 'catalog_rack':
      return <CatalogRack it={it} />;
    case 'outlet':
      return (
        <>
          <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={plastic('#f2f2f0')} radius={0.006} />
          {[-1, 1].map((s) => (
            <Box key={s} s={[0.025, 0.003, 0.012]} p={[s * W * 0.22, H + 0.001, 0]} m={blackMetal()} noShadow />
          ))}
        </>
      );
    case 'rug':
      return <Rug it={it} />;
    case 'pillar':
      return <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={paint(col, 0.75)} radius={0.003} />;
    case 'door': {
      return (
        <>
          <Box s={[W + 0.06, H + 0.03, 0.01]} p={[0, (H + 0.03) / 2, -D / 2 + 0.005]} m={paint(shade(col, 0.9), 0.6)} />
          <RBox s={[W, H, D - 0.01]} p={[0, H / 2, 0.005]} m={paint(col, 0.5)} radius={0.004} />
          <Box s={[0.12, 0.02, 0.03]} p={[W / 2 - 0.1, 1.0, D / 2 + 0.015]} m={chrome()} />
        </>
      );
    }
    case 'truss':
      return <Truss it={it} />;
    case 'person':
      return <Person it={it} />;
    case 'model':
      return <ModelBody it={it} />;
    default:
      return <RBox s={[W, H, D]} p={[0, H / 2, 0]} m={paint(col)} />;
  }
}

function GlassFrame({ w, h, d, y }: { w: number; h: number; d: number; y: number }) {
  const t = 0.012;
  const m = aluminum();
  const xs = [-w / 2, w / 2];
  const zs = [-d / 2, d / 2];
  return (
    <>
      {xs.flatMap((x) => zs.map((z) => <Box key={`${x}${z}`} s={[t, h, t]} p={[x, y + h / 2, z]} m={m} />))}
      {[y + h - t / 2].map((yy) => (
        <group key={yy}>
          {zs.map((z) => (
            <Box key={'x' + z} s={[w, t, t]} p={[0, yy, z]} m={m} />
          ))}
          {xs.map((x) => (
            <Box key={'z' + x} s={[t, t, d]} p={[x, yy, 0]} m={m} />
          ))}
        </group>
      ))}
    </>
  );
}

const COVER_COLORS = ['#1f4e8c', '#f3f2ee', '#b3282d', '#2f6b4a', '#d9a53a'];

/** A4カタログ1冊+アクリルポケット(ポケット底面中央が原点、正面が+z) */
function Pocket({ w, graphic, i, tilt = -0.2 }: { w: number; graphic: Item['graphic']; i: number; tilt?: number }) {
  const g = glass();
  return (
    <group rotation={[tilt, 0, 0]}>
      <Box s={[w, 0.2, 0.003]} p={[0, 0.1, -0.012]} m={g} noShadow />
      <Box s={[w, 0.07, 0.003]} p={[0, 0.035, 0.012]} m={g} noShadow />
      <Box s={[w, 0.003, 0.027]} p={[0, 0.0015, 0]} m={g} noShadow />
      <Box s={[0.21, 0.297, 0.005]} p={[0, 0.1515, -0.004]} m={paint(graphic ? '#f3f2ee' : COVER_COLORS[i % COVER_COLORS.length], 0.45)} />
      {graphic ? (
        <GraphicPlane graphic={graphic} w={0.21} h={0.297} position={[0, 0.1515, -0.0013]} />
      ) : (
        <Box s={[0.17, 0.02, 0.0005]} p={[0, 0.25, -0.0013]} m={paint(i % 5 === 1 ? '#1f4e8c' : '#f3f2ee', 0.5)} noShadow />
      )}
    </group>
  );
}

function CatalogDesk({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const tiers = D <= 0.13 ? 1 : D <= 0.18 ? 2 : 3;
  const cols = Math.max(1, Math.round(W / 0.235));
  const colW = W / cols;
  const zFront = D / 2 - 0.03;
  return (
    <>
      {Array.from({ length: tiers }).flatMap((_, k) =>
        Array.from({ length: cols }).map((__, c) => (
          <group key={`${k}-${c}`} position={[-W / 2 + colW * (c + 0.5), k * 0.05, zFront - k * 0.05]}>
            {k > 0 && <Box s={[colW - 0.004, k * 0.05, 0.026]} p={[0, -k * 0.025, 0]} m={glass()} noShadow />}
            <Pocket w={colW - 0.006} graphic={it.graphic} i={k * cols + c} />
          </group>
        )),
      )}
    </>
  );
}

function CatalogRack({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = mm(it.h);
  const col = it.color ?? '#c9cbcc';
  const rows = Math.max(2, Math.floor((H - 0.3) / 0.3));
  const cols = Math.max(1, Math.floor(W / 0.26));
  const colW = (W - 0.04) / cols;
  const backZ = -D / 2 + 0.06;
  return (
    <>
      <Box s={[W, 0.03, D]} p={[0, 0.015, 0]} m={aluminum()} />
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.025, H - 0.03, 0.025]} p={[s * (W / 2 - 0.0125), 0.03 + (H - 0.03) / 2, backZ]} m={aluminum()} />
      ))}
      <Box s={[W - 0.05, H - 0.1, 0.008]} p={[0, 0.06 + (H - 0.1) / 2, backZ]} m={paint(col, 0.5)} />
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <group key={`${r}-${c}`} position={[-W / 2 + 0.02 + colW * (c + 0.5), 0.12 + r * ((H - 0.42) / Math.max(1, rows - 1)), backZ + 0.07]}>
            <Pocket w={colW - 0.01} graphic={it.graphic} i={r * cols + c} tilt={-0.22} />
          </group>
        )),
      )}
    </>
  );
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function Plant({ it }: { it: Item }) {
  const W = mm(it.w);
  const H = mm(it.h);
  const potH = Math.min(0.42, H * 0.28);
  const potR = W * 0.32;
  const blobs = useMemo(() => {
    let s = hash(it.id);
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const out: { p: V3; sc: number; i: number }[] = [];
    const n = 26;
    const crownBase = potH + (H - potH) * 0.3;
    for (let i = 0; i < n; i++) {
      const t = r();
      const y = crownBase + t * (H - crownBase - 0.1);
      const rad = (W / 2) * (0.35 + (1 - Math.abs(t - 0.45)) * 0.6) * r();
      const a = r() * Math.PI * 2;
      out.push({ p: [Math.cos(a) * rad, y, Math.sin(a) * rad], sc: 0.08 + r() * 0.1 * Math.min(1.4, W / 0.5), i });
    }
    return out;
  }, [it.id, W, H, potH]);
  return (
    <>
      <Cyl r={potR} r2={potR * 0.8} h={potH} p={[0, potH / 2, 0]} m={plastic('#e9e8e3')} seg={36} />
      <Cyl r={potR * 0.95} h={0.01} p={[0, potH - 0.02, 0]} m={paint('#3b2b1f', 0.95)} seg={36} />
      <Rod a={[0, potH - 0.02, 0]} b={[0.02, H * 0.75, 0.01]} r={0.012} m={paint('#5b4331', 0.9)} />
      {blobs.map((b, k) => (
        <mesh key={k} position={b.p} scale={[b.sc * 1.25, b.sc * 0.8, b.sc * 1.25]} rotation={[b.i, b.i * 2, 0]} material={foliage(b.i)} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  );
}

function Rug({ it }: { it: Item }) {
  const W = mm(it.w);
  const D = mm(it.d);
  const H = Math.max(0.004, mm(it.h));
  const mat = useMemo(() => {
    const { map, bump } = punchCarpet();
    const m = map.clone();
    m.repeat.set(W, D);
    m.needsUpdate = true;
    const b = bump!.clone();
    b.repeat.set(W, D);
    b.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: it.color ?? '#4a4c4f', map: m, bumpMap: b, bumpScale: 0.6, roughness: 1 });
  }, [W, D, it.color]);
  return (
    <mesh position={[0, H / 2, 0]} material={mat} receiveShadow>
      <boxGeometry args={[W, H, D]} />
    </mesh>
  );
}

function Cutout({ it }: { it: Item }) {
  const W = mm(it.w);
  const H = mm(it.h);
  const asset = useStore((s) => (it.graphic ? s.assets[it.graphic.assetId] : undefined));
  const logo = useHtmlImage(asset);
  const tex = useMemo(() => textTexture(it.text ?? '', { w: it.w, h: it.h, bg: null, fg: it.textColor ?? it.color ?? '#1f2a44', logo }), [it.text, it.w, it.h, it.textColor, it.color, logo]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, transparent: false, alphaTest: 0.5, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }), [tex]);
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, color: '#666', alphaTest: 0.5, roughness: 0.6 }), [tex]);
  return (
    <>
      {[0, 0.003, 0.006].map((z, i) => (
        <mesh key={z} position={[0, H / 2, -mm(it.d) / 2 + 0.002 + z]} material={i === 2 ? mat : back} castShadow>
          <planeGeometry args={[W, H]} />
        </mesh>
      ))}
    </>
  );
}

function Truss({ it }: { it: Item }) {
  const L = mm(it.w);
  const S = mm(it.d);
  const m = aluminum();
  const half = S / 2 - 0.025;
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  const n = Math.max(2, Math.round(L / 0.5));
  const step = L / n;
  const diag: { a: V3; b: V3 }[] = [];
  for (let f = 0; f < 4; f++) {
    const c1 = corners[f];
    const c2 = corners[(f + 1) % 4];
    for (let i = 0; i < n; i++) {
      const x0 = -L / 2 + i * step;
      const x1 = x0 + step;
      const up = i % 2 === 0;
      diag.push({ a: [x0, S / 2 + (up ? c1[0] : c2[0]), up ? c1[1] : c2[1]], b: [x1, S / 2 + (up ? c2[0] : c1[0]), up ? c2[1] : c1[1]] });
    }
  }
  return (
    <>
      {corners.map(([y, z], i) => (
        <Cyl key={i} r={0.024} h={L} p={[0, S / 2 + y, z]} rot={[0, 0, Math.PI / 2]} m={m} seg={12} />
      ))}
      {diag.map((d, i) => (
        <Rod key={i} a={d.a} b={d.b} r={0.008} m={m} />
      ))}
      {[-1, 1].map((s) => (
        <Rod key={'w' + s} a={[s * L * 0.4, S, 0]} b={[s * L * 0.4, S + 4, 0]} r={0.004} m={blackMetal()} />
      ))}
    </>
  );
}

function Person({ it }: { it: Item }) {
  const H = mm(it.h);
  const k = H / 1.7;
  const m = paint(it.color ?? '#9aa0a6', 0.6);
  return (
    <group scale={[k, k, k]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.09, 0.43, 0]} material={m} castShadow>
          <capsuleGeometry args={[0.065, 0.72, 6, 12]} />
        </mesh>
      ))}
      <mesh position={[0, 1.13, 0]} material={m} castShadow scale={[1, 1, 0.62]}>
        <capsuleGeometry args={[0.17, 0.36, 8, 16]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={'a' + s} position={[s * 0.235, 1.07, 0]} rotation={[0, 0, s * 0.08]} material={m} castShadow>
          <capsuleGeometry args={[0.045, 0.55, 6, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 1.58, 0]} material={m} castShadow scale={[0.9, 1.08, 1]}>
        <sphereGeometry args={[0.105, 24, 18]} />
      </mesh>
    </group>
  );
}

function ModelBody({ it }: { it: Item }) {
  const asset = useStore((s) => (it.model ? s.assets[it.model.assetId] : undefined));
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!asset) return;
    loadModel(asset)
      .then((o) => alive && setObj(o))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [asset]);
  const inst = useMemo(() => {
    if (!obj || !it.model) return null;
    // Z-up は回転用グループで包み、回転後の外形で底面中央を原点に合わせる
    const rotG = new THREE.Group();
    if (it.model.upAxis === 'z') rotG.rotation.x = -Math.PI / 2;
    rotG.add(obj.clone(true));
    const { size, box } = modelBounds(obj, it.model.upAxis);
    const center = box.getCenter(new THREE.Vector3());
    const node = new THREE.Group();
    rotG.position.set(-center.x, -box.min.y, -center.z);
    node.add(rotG);
    return { node, size };
  }, [obj, it.model]);
  if (!asset || err) {
    return <RBox s={[mm(it.w), mm(it.h), mm(it.d)]} p={[0, mm(it.h) / 2, 0]} m={paint('#d98b8b', 0.6)} />;
  }
  if (!inst) {
    return (
      <mesh position={[0, mm(it.h) / 2, 0]}>
        <boxGeometry args={[mm(it.w), mm(it.h), mm(it.d)]} />
        <meshBasicMaterial color="#9aa" wireframe />
      </mesh>
    );
  }
  const sx = mm(it.w) / Math.max(1e-6, inst.size.x);
  const sy = mm(it.h) / Math.max(1e-6, inst.size.y);
  const sz = mm(it.d) / Math.max(1e-6, inst.size.z);
  return (
    <group scale={[sx, sy, sz]}>
      <primitive object={inst.node} />
    </group>
  );
}

function SelBox({ w, h, d }: { w: number; h: number; d: number }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.02, h + 0.02, d + 0.02)), [w, h, d]);
  return (
    <lineSegments geometry={geo} position={[0, h / 2, 0]} renderOrder={10}>
      <lineBasicMaterial color="#ff6a1f" depthTest={false} transparent opacity={0.9} />
    </lineSegments>
  );
}

export const ItemMesh = memo(function ItemMesh({
  it,
  selected,
  floorTop,
  onDown,
}: {
  it: Item;
  selected: boolean;
  floorTop: number;
  onDown: (e: ThreeEvent<PointerEvent>, it: Item) => void;
}) {
  const mount = defOf(it.kind).mount ?? 'floor';
  const y = mm(it.elev) + (mount === 'floor' ? floorTop : 0);
  return (
    <group position={[mm(it.x), y, mm(it.y)]} rotation={[0, (-it.rot * Math.PI) / 180, 0]} onPointerDown={(e) => onDown(e, it)}>
      <Body it={it} />
      {selected && <SelBox w={mm(it.w)} h={mm(it.h)} d={mm(it.d)} />}
    </group>
  );
});
