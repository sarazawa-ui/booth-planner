import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls } from '@react-three/drei';
import { useStore } from '../store';
import { NumField, Seg, TextField } from './ui';
import { downloadBlob } from '../lib/assets';
import { placeGeneratedModel } from '../lib/importer';
import { buildModel, disposeModel, exportGlb, loadSilhouette, type BuildResult, type PhotoShape, type PhotoView, type Silhouette } from '../lib/photo3d';

interface Slot {
  file: File;
  mirror: boolean;
  sil?: Silhouette;
  err?: string;
}

const SHAPES: { id: PhotoShape; name: string }[] = [
  { id: 'box', name: '箱型(3面図)' },
  { id: 'lathe', name: '円筒(回転体)' },
  { id: 'extrude', name: '板状(押し出し)' },
];

const SHAPE_HELP: Record<PhotoShape, string> = {
  box: '正面・側面・上面の輪郭を重ねて削り出します。機器・什器・箱物向け。側面や上面がなければ、その方向はまっすぐな形になります。',
  lathe: '正面写真の輪郭を縦の軸で回して作ります。ボトル・タンク・円柱の機器向け。奥行は幅と同じになります。',
  extrude: '正面写真の輪郭に厚みをつけます。看板・パネル・切り文字・人物パネル向け。',
};

const VIEWS: { id: PhotoView; name: string; help: string }[] = [
  { id: 'front', name: '正面(必須)', help: '正面からまっすぐ撮った写真' },
  { id: 'side', name: '側面', help: '右側から撮った写真。左側から撮ったときは「左右反転」' },
  { id: 'top', name: '上面', help: '真上から、手前側を画像の下にして撮った写真' },
  { id: 'back', name: '背面', help: 'なければ正面の写真を裏側にも貼ります' },
];

const RES = [
  { id: 'std', name: '標準', n: 96 },
  { id: 'fine', name: '精細', n: 144 },
] as const;
type ResId = (typeof RES)[number]['id'];

export default function PhotoModelModal() {
  const close = () => useStore.getState().set({ showPhoto3d: false });
  const [shape, setShape] = useState<PhotoShape>('box');
  const [slots, setSlots] = useState<Partial<Record<PhotoView, Slot>>>({});
  const [lock, setLock] = useState(true);
  const [h, setH] = useState(1000);
  const [wFree, setWFree] = useState(1000);
  const [dFree, setDFree] = useState(600);
  const [thick, setThick] = useState(30);
  const [res, setRes] = useState<ResId>('std');
  const [name, setName] = useState('');
  const [result, setResult] = useState<BuildResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const views = shape === 'box' ? VIEWS : VIEWS.slice(0, 1);
  const sil = (v: PhotoView) => (views.some((x) => x.id === v) ? slots[v]?.sil : undefined);
  const front = sil('front');
  const side = sil('side');
  const top = sil('top');

  // 寸法: 「写真の縦横比に合わせる」なら高さだけを持ち、幅・奥行は写真の比率から決める
  const fa = front?.aspect ?? 1;
  const W = lock ? h * fa : wFree;
  const dLinked = lock && shape === 'box' && !!(side || top);
  const D = shape === 'lathe' ? W : shape === 'extrude' ? thick : dLinked ? (side ? h * side.aspect : W / top!.aspect) : dFree;
  const setW = (v: number) => (lock ? setH(v / fa) : setWFree(v));
  const setD = (v: number) => {
    if (shape === 'extrude') setThick(v);
    else if (dLinked) setH(side ? v / side.aspect : (v * top!.aspect) / fa);
    else setDFree(v);
  };
  const toggleLock = (on: boolean) => {
    if (!on) {
      setWFree(Math.round(W));
      if (shape === 'box') setDFree(Math.round(D));
    }
    setLock(on);
  };

  const pick = async (view: PhotoView, file: File, mirror = false) => {
    if (!file.type.startsWith('image/')) {
      alert(`${file.name}: 画像ファイルではありません`);
      return;
    }
    setSlots((s) => ({ ...s, [view]: { file, mirror } }));
    if (view === 'front' && !name) setName(file.name.replace(/\.[^.]+$/, ''));
    try {
      const sl = await loadSilhouette(file, mirror);
      setSlots((s) => (s[view]?.file === file && s[view]?.mirror === mirror ? { ...s, [view]: { file, mirror, sil: sl } } : s));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSlots((s) => (s[view]?.file === file ? { ...s, [view]: { file, mirror, err: msg } } : s));
    }
  };
  const remove = (view: PhotoView) =>
    setSlots((s) => {
      const n = { ...s };
      delete n[view];
      return n;
    });

  const resN = RES.find((r) => r.id === res)!.n;
  const back = sil('back');
  useEffect(() => {
    if (!front) {
      setResult(null);
      setErr(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      try {
        const r = buildModel({ shape, w: W, d: D, h, res: resN, views: { front, side, top, back } });
        setResult(r);
        setErr(null);
      } catch (e) {
        setResult(null);
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [shape, front, side, top, back, W, D, h, resN]);

  // 作り直した古い形状と、閉じたときの最後の形状を破棄
  const last = useRef<BuildResult | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = result;
    if (prev && prev !== result) disposeModel(prev.group);
  }, [result]);
  useEffect(() => () => void (last.current && disposeModel(last.current.group)), []);

  const label = name.trim() || '写真モデル';
  const run = async (mode: 'place' | 'save') => {
    if (!result) return;
    setSaving(true);
    try {
      const glb = await exportGlb(result.group);
      if (mode === 'save') {
        downloadBlob(glb, `${label}.glb`);
      } else {
        placeGeneratedModel(glb, label, { w: W, d: D, h });
        close();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const ready = !!result && !busy && !saving;
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal p3d" onClick={(e) => e.stopPropagation()}>
        <div className="modal-bar">
          <h2>写真から3Dモデルを作る</h2>
          <div className="row">
            <button className="btn" disabled={!ready} onClick={() => run('save')}>
              GLBで保存
            </button>
            <button className="btn primary" disabled={!ready} onClick={() => run('place')}>
              ブースに配置
            </button>
            <button className="btn ghost" onClick={close}>
              閉じる
            </button>
          </div>
        </div>

        <div className="p3d-body">
          <div className="p3d-form">
            <div className="p3d-group">
              <h3>形の作り方</h3>
              <Seg value={shape} options={SHAPES} onChange={setShape} small />
              <p className="hint">{SHAPE_HELP[shape]}</p>
            </div>

            <div className="p3d-group">
              <h3>写真</h3>
              <div className="p3d-slots">
                {views.map((v) => (
                  <PhotoSlot
                    key={v.id}
                    name={v.name}
                    help={v.help}
                    slot={slots[v.id]}
                    onFile={(f) => pick(v.id, f, slots[v.id]?.mirror)}
                    onMirror={(m) => slots[v.id] && pick(v.id, slots[v.id]!.file, m)}
                    onRemove={() => remove(v.id)}
                  />
                ))}
              </div>
              <p className="hint">背景を透過したPNGを使います。透過していない写真は、外周の色を背景とみなして自動で切り抜きます(無地の背景で撮ってください)。</p>
            </div>

            <div className="p3d-group">
              <h3>実寸</h3>
              <label className="check">
                <input type="checkbox" checked={lock} onChange={(e) => toggleLock(e.target.checked)} />
                写真の縦横比に合わせる
              </label>
              <div className="grid3">
                <NumField label="幅 W" value={Math.round(W)} onChange={setW} min={10} max={20000} />
                <NumField label={shape === 'extrude' ? '厚み' : '奥行 D'} value={Math.round(D)} onChange={setD} min={5} max={20000} disabled={shape === 'lathe'} />
                <NumField label="高さ H" value={Math.round(h)} onChange={setH} min={10} max={20000} />
              </div>
              <p className="hint">{lock ? '1か所を実測して入れると、ほかは写真の比率で決まります。' : '幅・奥行・高さをそれぞれ実測値で入れます。'}</p>
            </div>

            <div className="p3d-group">
              <h3>仕上げ</h3>
              <div className="field-row">
                <span>精細度</span>
                <Seg value={res} options={RES.map((r) => ({ id: r.id, name: r.name }))} onChange={setRes} small />
              </div>
              <TextField label="名前" value={name} onChange={setName} placeholder="写真モデル" />
            </div>
          </div>

          <div className="p3d-view">
            {result ? (
              <Preview result={result} />
            ) : (
              <div className="p3d-empty">{err ?? (front || busy ? '生成中…' : '正面の写真を入れると、ここに3Dモデルが表示されます')}</div>
            )}
            <div className="p3d-status">
              {err && result ? <span className="p3d-err">{err}</span> : null}
              {result && (
                <span>
                  {busy ? '更新中… ' : ''}
                  {Math.round(W)} × {Math.round(D)} × H{Math.round(h)} mm ・ {result.triangles.toLocaleString()} 面
                </span>
              )}
              <span className="p3d-tip">ドラッグで回転・ホイールで拡大</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({
  name,
  help,
  slot,
  onFile,
  onMirror,
  onRemove,
}: {
  name: string;
  help: string;
  slot?: Slot;
  onFile: (f: File) => void;
  onMirror: (m: boolean) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="p3d-slot">
      <button
        className={'p3d-drop' + (over ? ' over' : '') + (slot?.sil ? ' has' : '')}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        title="クリックで選択/ファイルをドロップ"
      >
        {slot?.sil ? <img src={slot.sil.preview} alt="" /> : <span>{slot ? (slot.err ? '読込失敗' : '読込中…') : '+'}</span>}
      </button>
      <div className="p3d-slot-text">
        <b>{name}</b>
        <small>{slot?.err ?? help}</small>
        {slot?.sil?.keyed && <small className="p3d-note">透過なし: 背景色を自動除去</small>}
        {slot && (
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={slot.mirror} onChange={(e) => onMirror(e.target.checked)} />
              左右反転
            </label>
            <button className="btn sm ghost" onClick={onRemove}>
              外す
            </button>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Preview({ result }: { result: BuildResult }) {
  const size = useMemo(() => {
    let m = 0;
    result.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (g) {
        g.computeBoundingBox();
        const b = g.boundingBox!;
        m = Math.max(m, b.max.x - b.min.x, b.max.y, b.max.z - b.min.z);
      }
    });
    return Math.max(0.1, m);
  }, [result]);
  return (
    <Canvas camera={{ position: [size * 1.1, size * 0.9, size * 1.6], fov: 35, near: size / 100, far: size * 50 }} dpr={[1, 2]}>
      <color attach="background" args={['#eef0f3']} />
      <hemisphereLight args={['#ffffff', '#b8bcc4', 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />
      <Bounds fit clip observe margin={1.3}>
        <primitive object={result.group} />
      </Bounds>
      <gridHelper args={[size * 4, 20, '#c3c8cf', '#d9dde2']} />
      <OrbitControls makeDefault target={[0, size * 0.4, 0]} />
    </Canvas>
  );
}

