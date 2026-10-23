import { useRef, useState } from 'react';
import { CATALOG, CATEGORIES, MODEL_DEF, type CategoryId } from '../catalog';
import { useStore } from '../store';
import { Icon } from './ui';
import { fmtMm } from '../lib/geom';
import { importModelFile } from '../lib/importer';

export default function Catalog() {
  const [cat, setCat] = useState<CategoryId>('stage');
  const addItem = useStore((s) => s.addItem);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const list = CATALOG.filter((c) => c.cat === cat);

  const onModel = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await importModelFile(f);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <aside className="catalog">
      <nav className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={c.id === cat ? 'on' : ''} onClick={() => setCat(c.id)}>
            {c.name}
          </button>
        ))}
      </nav>
      <div className="cat-list">
        {list.map((d) => (
          <button
            key={d.kind}
            className="cat-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/x-booth-kind', d.kind);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => addItem(d.kind)}
            title="クリックで追加/図面や3Dへドラッグして配置"
          >
            <span className="cat-icon">
              <Icon d={d.icon} />
            </span>
            <span className="cat-text">
              <b>{d.name}</b>
              <small>{d.round ? `φ${fmtMm(d.w)}` : `${fmtMm(d.w)}×${fmtMm(d.d)}`} H{fmtMm(d.h)}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="cat-import">
        <button className="cat-item import" onClick={() => fileRef.current?.click()} disabled={busy}>
          <span className="cat-icon">
            <Icon d={MODEL_DEF.icon} />
          </span>
          <span className="cat-text">
            <b>{busy ? '読み込み中…' : '3Dデータを読み込む'}</b>
            <small>GLB / glTF / OBJ / STL / FBX</small>
          </span>
        </button>
        <input ref={fileRef} type="file" accept=".glb,.gltf,.obj,.stl,.fbx" multiple hidden onChange={(e) => onModel(e.target.files)} />
        <p className="cat-help">図面・3Dビューにファイルを直接ドロップしても配置できます。画像をドロップすると選択中の壁・パネルに貼り付けます。</p>
      </div>
    </aside>
  );
}
