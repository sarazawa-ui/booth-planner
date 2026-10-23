import * as THREE from 'three';
import { useMemo } from 'react';
import { useStore } from '../../store';
import type { Graphic } from '../../types';
import { useImageTexture } from '../../lib/textures';

type V3 = [number, number, number];

/** 画像の貼付面。fit に応じて切り抜き(cover)/余白(contain)/伸縮(stretch) */
export function GraphicPlane({
  graphic,
  w,
  h,
  position,
  rotation,
  glow,
  bg,
  placeholder,
}: {
  placeholder?: boolean;
  graphic: Graphic | null | undefined;
  w: number;
  h: number;
  position?: V3;
  rotation?: V3;
  /** モニター等の発光面 */
  glow?: boolean;
  /** contain の余白色(未指定なら余白は描かない) */
  bg?: string;
}) {
  const asset = useStore((s) => (graphic ? s.assets[graphic.assetId] : undefined));
  const base = useImageTexture(asset);
  const fit = graphic?.fit ?? 'cover';
  const res = useMemo(() => {
    if (!base) return null;
    const img = base.image as { width: number; height: number };
    const ia = img.width / img.height;
    const fa = w / h;
    const t = base.clone();
    let pw = w;
    let ph = h;
    if (fit === 'cover') {
      if (ia > fa) {
        t.repeat.set(fa / ia, 1);
        t.offset.set((1 - fa / ia) / 2, 0);
      } else {
        t.repeat.set(1, ia / fa);
        t.offset.set(0, (1 - ia / fa) / 2);
      }
    } else if (fit === 'contain') {
      if (ia > fa) ph = w / ia;
      else pw = h * ia;
    }
    t.needsUpdate = true;
    const mat = glow
      ? // 画面は照明の影響を受けず、画像の画素をそのまま表示する
        new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0 });
    return { mat, pw, ph };
  }, [base, w, h, fit, glow]);

  if (!res) {
    if (!placeholder || graphic) return null;
    // 画像未設定のパネルは薄いグレーで面を示す
    return (
      <mesh position={position} rotation={rotation} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#cfd3d8" roughness={0.7} />
      </mesh>
    );
  }
  return (
    <group position={position} rotation={rotation}>
      {bg && fit === 'contain' && (
        <mesh receiveShadow position={[0, 0, -0.0004]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={bg} roughness={0.6} />
        </mesh>
      )}
      <mesh receiveShadow material={res.mat}>
        <planeGeometry args={[res.pw, res.ph]} />
      </mesh>
    </group>
  );
}

/** 円筒(吊りバナー円形)への巻き付け */
export function GraphicCylinder({ graphic, r, h }: { graphic: Graphic | null | undefined; r: number; h: number }) {
  const asset = useStore((s) => (graphic ? s.assets[graphic.assetId] : undefined));
  const base = useImageTexture(asset);
  const mat = useMemo(() => {
    if (!base) return null;
    const img = base.image as { width: number; height: number };
    const ia = img.width / img.height;
    const circ = 2 * Math.PI * r;
    const t = base.clone();
    t.wrapS = THREE.RepeatWrapping;
    // 画像を高さに合わせ、周方向に繰り返す
    t.repeat.set(Math.max(1, Math.round(circ / (h * ia))), 1);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, side: THREE.FrontSide });
  }, [base, r, h]);
  if (!mat) return null;
  return (
    <mesh material={mat} position={[0, h / 2, 0]} castShadow>
      <cylinderGeometry args={[r + 0.002, r + 0.002, h, 96, 1, true]} />
    </mesh>
  );
}
