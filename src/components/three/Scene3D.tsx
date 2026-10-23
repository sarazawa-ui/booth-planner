import * as THREE from 'three';
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore, type CamPreset } from '../../store';
import type { Item, Wall } from '../../types';
import { BoothFloor, Fascia, Hall, Walls3D, floorTopOf } from './Booth3D';
import { ItemMesh } from './Items3D';
import { importDroppedFiles } from '../../lib/importer';

RectAreaLightUniformsLib.init();

const mm = (v: number) => v / 1000;

interface DragState {
  id: string;
  ox: number;
  oy: number;
  plane: THREE.Plane;
  moved: boolean;
}

/** 描画画素数の上限(GPUメモリ不足で WebGL が落ちるのを防ぐ) */
const PIXEL_BUDGET = { high: 4.0e6, std: 2.4e6 };

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export default function Scene3D() {
  const quality = useStore((s) => s.quality);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const dropRef = useRef<((e: React.DragEvent) => void) | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState(0);
  const [gen, setGen] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [webgl] = useState(hasWebGL2);
  const lostCount = useRef(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea(Math.round((el.clientWidth * el.clientHeight) / 20000) * 20000));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 高画質時は画面の画素密度より少し細かく描いて縮小表示する(文字・画像のにじみ対策)。
  // ただし描画画素数が上限を超えないよう、大きな画面では自動で下げる。
  const base = window.devicePixelRatio || 1;
  const want = quality === 'high' ? Math.min(2, Math.max(1.5, base)) : Math.min(1.5, base);
  const cap = area > 0 ? Math.sqrt(PIXEL_BUDGET[quality] / area) : want;
  const dpr = Math.max(0.75, Math.round(Math.min(want, cap) * 20) / 20);
  const heavy = area * dpr * dpr > 2.6e6;

  const onLost = () => {
    lostCount.current++;
    if (useStore.getState().quality === 'high') {
      useStore.getState().set({ quality: 'std' });
      setNotice('GPUの負荷が高かったため、標準画質に切り替えて表示し直しました。');
    } else {
      setNotice('3D表示が中断されたため、表示し直しました。続く場合はブラウザの「ハードウェアアクセラレーション」が有効か確認してください。');
    }
    if (lostCount.current <= 3) setTimeout(() => setGen((g) => g + 1), 300);
  };

  if (!webgl) {
    return (
      <div className="scene-wrap scene-msg">
        <p>
          このブラウザでは3D表示(WebGL2)が使えません。
          <br />
          Chrome / Edge の最新版で開き、設定の「ハードウェアアクセラレーション」を有効にしてください。
        </p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="scene-wrap"
      onPointerDown={(e) => (downPos.current = { x: e.clientX, y: e.clientY })}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => dropRef.current?.(e)}
    >
      <SceneErrorBoundary key={gen} onRetry={() => setGen((g) => g + 1)}>
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          dpr={dpr}
          frameloop="demand"
          gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }}
          camera={{ fov: 38, near: 0.05, far: 200, position: [8, 5, 10] }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              onLost();
            });
          }}
          onPointerMissed={(e) => {
            const d = downPos.current;
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) useStore.getState().select(null);
          }}
        >
          <SceneContent dropRef={dropRef} dpr={dpr} />
          {quality === 'high' ? (
            <EffectComposer multisampling={4} enableNormalPass={false}>
              <N8AO aoRadius={0.45} intensity={2.2} distanceFalloff={0.6} quality="medium" halfRes={heavy} />
              <Vignette offset={0.4} darkness={0.28} />
              <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            </EffectComposer>
          ) : (
            <EffectComposer multisampling={4} enableNormalPass={false}>
              <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            </EffectComposer>
          )}
        </Canvas>
      </SceneErrorBoundary>
      {notice && (
        <div className="scene-notice">
          {notice}
          <button onClick={() => setNotice(null)}>閉じる</button>
        </div>
      )}
      <CameraBar />
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: React.ReactNode; onRetry: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  componentDidCatch(e: unknown) {
    console.error('3D表示エラー', e);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="scene-msg">
          <p>
            3D表示でエラーが発生しました。
            <br />
            <small>{this.state.error}</small>
          </p>
          <button
            className="btn"
            onClick={() => {
              useStore.getState().set({ quality: 'std' });
              this.props.onRetry();
            }}
          >
            標準画質で再表示
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SceneContent({ dropRef, dpr }: { dropRef: React.MutableRefObject<((e: React.DragEvent) => void) | null>; dpr: number }) {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const { booth, walls, items } = project;
  const controls = useRef<OrbitControlsImpl>(null);
  const drag = useRef<DragState | null>(null);
  const { camera, gl, raycaster, scene } = useThree();
  const setDpr = useThree((s) => s.setDpr);
  const advance = useThree((s) => s.advance);
  const floorTop = floorTopOf(booth);
  const W = mm(booth.w);
  const D = mm(booth.d);
  const span = Math.max(W, D);

  // 画像保存用
  // 画面より高い解像度で一度だけ描き直して書き出す
  useEffect(() => {
    useStore.getState().set({
      capture: async (scale = 1) => {
        const prev = gl.getPixelRatio();
        const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
        try {
          if (scale > 1) {
            const { width } = gl.domElement.getBoundingClientRect();
            // 横 4000px 程度まで
            setDpr(Math.min(prev * scale, 4000 / Math.max(1, width)));
            await nextFrame();
            await nextFrame();
            advance(performance.now());
            await nextFrame();
          }
          return gl.domElement.toDataURL('image/png');
        } catch {
          return null;
        } finally {
          if (scale > 1) setDpr(prev);
        }
      },
    });
    return () => useStore.getState().set({ capture: null });
  }, [gl, setDpr, advance]);

  const rayToPlane = (clientX: number, clientY: number, plane: THREE.Plane) => {
    const r = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  };

  // カタログ/ファイルを3Dビューへドロップ
  dropRef.current = (e: React.DragEvent) => {
    e.preventDefault();
    const hit = rayToPlane(e.clientX, e.clientY, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const at = hit ? { x: Math.round(hit.x * 1000), y: Math.round(hit.z * 1000) } : undefined;
    const kind = e.dataTransfer.getData('text/x-booth-kind');
    if (kind) {
      useStore.getState().addItem(kind, at?.x, at?.y);
    } else if (e.dataTransfer.files.length) {
      importDroppedFiles(e.dataTransfer.files, at);
    }
  };

  // ドラッグ移動(床面に沿って)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const hit = rayToPlane(e.clientX, e.clientY, d.plane);
      if (!hit) return;
      if (!d.moved) {
        d.moved = true;
        useStore.getState().checkpoint();
      }
      useStore.getState().moveItem(d.id, hit.x * 1000 - d.ox, hit.z * 1000 - d.oy, e.altKey);
    };
    const up = () => {
      if (drag.current) {
        drag.current = null;
        if (controls.current) controls.current.enabled = true;
        gl.domElement.style.cursor = '';
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const handlers = useRef({ item: (_e: ThreeEvent<PointerEvent>, _it: Item) => {}, wall: (_e: ThreeEvent<PointerEvent>, _w: Wall) => {} });
  const onItemDownStable = useCallback((e: ThreeEvent<PointerEvent>, it: Item) => handlers.current.item(e, it), []);
  const onWallDownStable = useCallback((e: ThreeEvent<PointerEvent>, w: Wall) => handlers.current.wall(e, w), []);
  const onItemDown = (e: ThreeEvent<PointerEvent>, it: Item) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useStore.getState().select({ type: 'item', id: it.id });
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y);
    const hit = rayToPlane(e.nativeEvent.clientX, e.nativeEvent.clientY, plane) ?? e.point;
    drag.current = { id: it.id, ox: hit.x * 1000 - it.x, oy: hit.z * 1000 - it.y, plane, moved: false };
    if (controls.current) controls.current.enabled = false;
    gl.domElement.style.cursor = 'grabbing';
  };
  handlers.current.item = onItemDown;
  const onWallDown = (e: ThreeEvent<PointerEvent>, w: Wall) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useStore.getState().select({ type: 'wall', id: w.id });
  };
  handlers.current.wall = onWallDown;

  // 影カメラを小間の大きさに合わせる
  const dirLight = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = dirLight.current;
    if (!l) return;
    const s = span * 0.85 + 2;
    const cam = l.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 1;
    cam.far = 40;
    cam.updateProjectionMatrix();
    l.target.position.set(W / 2, 0, D / 2);
    l.target.updateMatrixWorld();
    scene.add(l.target);
  }, [span, W, D, scene]);

  return (
    <>
      <color attach="background" args={['#c9ccd0']} />
      <fog attach="fog" args={['#c9ccd0', 22, 70]} />
      <hemisphereLight args={['#ffffff', '#7d8086', 0.22]} />
      <directionalLight
        ref={dirLight}
        position={[W / 2 + 4, 14, D / 2 + 7]}
        intensity={1.05}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={4}
      />
      <Environment resolution={256} frames={1} environmentIntensity={0.5}>
        {/* 展示会場の天井照明を模した光源 */}
        <Lightformer form="rect" intensity={2.4} position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} color="#f3f5f8" />
        {[-12, -4, 4, 12].map((x) =>
          [-12, -4, 4, 12].map((z) => <Lightformer key={`${x}${z}`} form="rect" intensity={4} position={[x, 8.5, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1.5, 1.5, 1]} />),
        )}
        <Lightformer form="rect" intensity={0.7} position={[0, 3, -20]} scale={[60, 6, 1]} color="#d9dbe0" />
        <Lightformer form="rect" intensity={0.5} position={[-20, 3, 0]} rotation={[0, Math.PI / 2, 0]} scale={[60, 6, 1]} color="#d9dbe0" />
        <Lightformer form="rect" intensity={0.5} position={[20, 3, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[60, 6, 1]} color="#d9dbe0" />
        <Lightformer form="rect" intensity={0.6} position={[0, 3, 20]} rotation={[0, Math.PI, 0]} scale={[60, 6, 1]} color="#d9dbe0" />
      </Environment>

      <Hall booth={booth} />
      <BoothFloor booth={booth} />
      <Walls3D walls={walls} booth={booth} selectedId={selection?.type === 'wall' ? selection.id : undefined} onDown={onWallDownStable} />
      <Fascia booth={booth} walls={walls} />
      {items.map((it) => (
        <ItemMesh key={it.id} it={it} floorTop={floorTop} selected={selection?.type === 'item' && selection.id === it.id} onDown={onItemDownStable} />
      ))}

      <OrbitControls
        ref={controls}
        makeDefault
        target={[W / 2, 1, D / 2]}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={0.6}
        maxDistance={60}
        enableDamping
        dampingFactor={0.12}
      />
      <CameraRig controls={controls} />
      <ShadowManager />
      <MotionDpr controls={controls} dpr={dpr} />
    </>
  );
}

/** 画角と縦横比から小間全体が収まる距離を求めてカメラ位置を決める */
function presetPose(p: CamPreset, W: number, D: number, H: number, cam: THREE.PerspectiveCamera) {
  const cx = W / 2;
  const cz = D / 2;
  const tgt = new THREE.Vector3(cx, H * 0.38, cz);
  const radius = 0.5 * Math.hypot(W, D, H);
  const vf = (cam.fov * Math.PI) / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
  const dist = (radius / Math.sin(Math.min(vf, hf) / 2)) * 0.92;
  const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(dist).add(tgt);
  switch (p) {
    case 'front':
      return { pos: dir(0, 0.18, 1), tgt };
    case 'top':
      return { pos: dir(0, 1, 0.0015), tgt: new THREE.Vector3(cx, 0, cz) };
    case 'eye':
      return { pos: new THREE.Vector3(cx - W * 0.12, 1.6, D + Math.max(2, dist * 0.45)), tgt: new THREE.Vector3(cx, 1.3, cz) };
    case 'left':
      return { pos: dir(-0.85, 0.32, 1), tgt };
    case 'right':
      return { pos: dir(0.85, 0.32, 1), tgt };
    default:
      return { pos: dir(0.5, 0.42, 1), tgt };
  }
}

function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const cmd = useStore((s) => s.camCmd);
  const bw = useStore((s) => s.project.booth.w);
  const bd = useStore((s) => s.project.booth.d);
  const bh = useStore((s) => s.project.booth.wallHeight);
  const { camera, size } = useThree();
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3; t: number } | null>(null);
  const first = useRef(true);
  const moved = useRef(false);
  const aspect = size.width / Math.max(1, size.height);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = aspect;
    const pose = presetPose(cmd.preset, mm(bw), mm(bd), mm(bh), cam);
    const c = controls.current;
    if (first.current || !c) {
      first.current = false;
      camera.position.copy(pose.pos);
      c?.target.copy(pose.tgt);
      c?.update();
      return;
    }
    anim.current = { from: camera.position.clone(), to: pose.pos, tf: c.target.clone(), tt: pose.tgt, t: 0 };
    // aspect は初回の位置決めにだけ使う(画面サイズ変更で勝手にカメラが動かないように)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd, bw, bd, bh, camera, controls]);

  useEffect(() => {
    if (anim.current) return;
    const t = setTimeout(() => {
      if (!controls.current) return;
      const cam = camera as THREE.PerspectiveCamera;
      cam.aspect = aspect;
      if (first.current === false && moved.current) return;
      const pose = presetPose(cmd.preset, mm(bw), mm(bd), mm(bh), cam);
      camera.position.copy(pose.pos);
      controls.current.target.copy(pose.tgt);
      controls.current.update();
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // ユーザーが視点を動かしたら、画面サイズ変更時の自動調整はしない
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const on = () => (moved.current = true);
    c.addEventListener('start', on);
    return () => c.removeEventListener('start', on);
  }, [controls]);

  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 0.7);
    const e = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.from, a.to, e);
    c.target.lerpVectors(a.tf, a.tt, e);
    c.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });
  return null;
}

function CameraBar() {
  const cam = useStore((s) => s.camera);
  const quality = useStore((s) => s.quality);
  const set = useStore((s) => s.set);
  const list: { id: CamPreset; name: string }[] = [
    { id: 'persp', name: '斜め' },
    { id: 'front', name: '正面' },
    { id: 'left', name: '左から' },
    { id: 'right', name: '右から' },
    { id: 'eye', name: '来場者目線' },
    { id: 'top', name: '真上' },
  ];
  return (
    <div className="cam-bar">
      <div className="seg">
        {list.map((c) => (
          <button key={c.id} onClick={() => cam(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <label className="cam-q">
        <input type="checkbox" checked={quality === 'high'} onChange={(e) => set({ quality: e.target.checked ? 'high' : 'std' })} />
        高画質
      </label>
    </div>
  );
}

/**
 * 影は視点に関係なく決まるので、カメラだけが動いているフレームでは影を描き直さない。
 * (スポット照明の数だけ全体を描き直す処理を省けるので、視点操作がかなり軽くなる)
 */
function ShadowManager() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const lastPos = useRef(new THREE.Vector3(NaN, 0, 0));
  const lastQuat = useRef(new THREE.Quaternion());
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
      clearTimeout(timer.current);
    };
  }, [gl]);
  useFrame(() => {
    const moved = !camera.position.equals(lastPos.current) || !camera.quaternion.equals(lastQuat.current);
    lastPos.current.copy(camera.position);
    lastQuat.current.copy(camera.quaternion);
    if (!moved) {
      gl.shadowMap.needsUpdate = true;
      return;
    }
    // 視点操作が止まったら一度だけ影を描き直す(操作中に変わった物があっても反映される)
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }, 250);
  });
  return null;
}

/** 視点を動かしている間だけ解像度を下げ、止まったら元に戻す */
function MotionDpr({ controls, dpr }: { controls: React.RefObject<OrbitControlsImpl | null>; dpr: number }) {
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    let t: number | undefined;
    const low = Math.max(0.75, Math.round(dpr * 0.6 * 20) / 20);
    const start = () => {
      clearTimeout(t);
      if (low < dpr) setDpr(low);
    };
    const end = () => {
      clearTimeout(t);
      t = window.setTimeout(() => setDpr(dpr), 300);
    };
    c.addEventListener('start', start);
    c.addEventListener('end', end);
    return () => {
      clearTimeout(t);
      c.removeEventListener('start', start);
      c.removeEventListener('end', end);
    };
  }, [controls, dpr, setDpr]);
  return null;
}
