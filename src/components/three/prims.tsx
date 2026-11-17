import * as THREE from 'three';
import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';

export type V3 = [number, number, number];

export function Box({ s, p, m, r, noShadow }: { s: V3; p: V3; m: THREE.Material; r?: V3; noShadow?: boolean }) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow={!noShadow} receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

export function RBox({ s, p, m, radius = 0.006 }: { s: V3; p: V3; m: THREE.Material; radius?: number }) {
  const rr = Math.min(radius, Math.min(...s) / 2.2);
  return (
    <RoundedBox args={s} radius={rr} smoothness={3} position={p} material={m} castShadow receiveShadow />
  );
}

export function Cyl({ r, r2, h, p, m, seg = 40, rot }: { r: number; r2?: number; h: number; p: V3; m: THREE.Material; seg?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
    </mesh>
  );
}

/** 2点を結ぶ細い棒 */
export function Rod({ a, b, r, m }: { a: V3; b: V3; r: number; m: THREE.Material }) {
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
