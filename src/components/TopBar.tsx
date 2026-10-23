import { useRef } from 'react';
import { useStore, type ViewMode } from '../store';
import type { BoothStyle } from '../types';
import { Seg } from './ui';
import { downloadBlob, exportProjectFile, importProjectFile } from '../lib/assets';

export default function TopBar() {
  const st = useStore();
  const { project, view, tool, past, future, snapStep } = st;
  const fileRef = useRef<HTMLInputElement>(null);

  const saveImage = () => {
    if (view === 'plan') st.setView('split');
    setTimeout(async () => {
      const url = await useStore.getState().capture?.(2);
      if (!url) return alert('3Dビューを表示してから保存してください');
      const b = await (await fetch(url)).blob();
      downloadBlob(b, `${project.meta.title || 'booth'}_3D.png`);
    }, view === 'plan' ? 800 : 0);
  };

  const openFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { project: p, assets } = await importProjectFile(f);
      st.replaceAll(p, assets);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 8l9-4 9 4-9 4z" />
          <path d="M3 8v8l9 4 9-4V8" />
          <path d="M12 12v8" />
        </svg>
        <span>ブースプランナー</span>
      </div>
      <input className="title-input" value={project.meta.title} onChange={(e) => st.mutate((p) => void (p.meta.title = e.target.value), false)} />

      <div className="tb-group">
        <span className="tb-label">施工</span>
        <Seg<BoothStyle>
          value={project.booth.style}
          options={[
            { id: 'wood', name: '木工' },
            { id: 'octanorm', name: 'オクタノルム' },
          ]}
          onChange={(style) => st.setBooth({ style })}
        />
      </div>

      <div className="tb-group">
        <Seg
          value={tool}
          options={[
            { id: 'select', name: '選択・移動' },
            { id: 'wall', name: '壁を描く' },
          ]}
          onChange={(t) => st.setTool(t)}
        />
        <select className="sel slim" value={snapStep} onChange={(e) => st.set({ snapStep: Number(e.target.value) })} title="吸着グリッド">
          <option value={10}>吸着 10mm</option>
          <option value={50}>吸着 50mm</option>
          <option value={100}>吸着 100mm</option>
          <option value={500}>吸着 500mm</option>
          <option value={1000}>吸着 1000mm</option>
        </select>
      </div>

      <div className="tb-group">
        <button className="btn icon" disabled={!past.length} onClick={st.undo} title="元に戻す (Ctrl+Z)">
          ↶
        </button>
        <button className="btn icon" disabled={!future.length} onClick={st.redo} title="やり直し (Ctrl+Y)">
          ↷
        </button>
      </div>

      <div className="tb-spacer" />

      <Seg<ViewMode>
        value={view}
        options={[
          { id: 'plan', name: '平面図' },
          { id: 'split', name: '分割' },
          { id: '3d', name: '3D' },
        ]}
        onChange={st.setView}
      />

      <div className="tb-group">
        <button className="btn" onClick={saveImage}>
          画像保存
        </button>
        <button className="btn primary" onClick={() => st.set({ showEstimate: true })}>
          備品リスト
        </button>
      </div>

      <div className="tb-group">
        <button className="btn ghost" onClick={() => confirm('新しいブースを作成します。現在の内容は消えます(必要なら先に「保存」してください)。') && st.newProject()}>
          新規
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          開く
        </button>
        <button className="btn ghost" onClick={() => exportProjectFile(project, st.assets)} title="画像・3Dデータを含めて1ファイルに保存">
          保存
        </button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => openFile(e.target.files?.[0])} />
      </div>
    </header>
  );
}
