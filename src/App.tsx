import { useEffect } from 'react';
import { useStore } from './store';
import TopBar from './components/TopBar';
import Catalog from './components/Catalog';
import Inspector from './components/Inspector';
import PlanEditor from './components/plan/PlanEditor';
import Scene3D from './components/three/Scene3D';
import EstimateModal from './components/EstimateModal';
import PhotoModelModal from './components/PhotoModelModal';

export default function App() {
  const view = useStore((s) => s.view);
  const ready = useStore((s) => s.ready);
  const showEstimate = useStore((s) => s.showEstimate);
  const showPhoto3d = useStore((s) => s.showPhoto3d);

  useEffect(() => {
    useStore.getState().init();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      const st = useStore.getState();
      // 写真から3Dの画面中は、背後の選択アイテムを消したり動かしたりしない
      if (st.showPhoto3d) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        st.deleteSelected();
      } else if (e.key.toLowerCase() === 'r' && !ctrl) {
        st.rotateSelected(e.shiftKey ? -15 : 90);
      } else if (e.key.toLowerCase() === 'w' && !ctrl) {
        st.setTool(st.tool === 'wall' ? 'select' : 'wall');
      } else if (e.key === 'Escape') {
        if (st.tool === 'wall') st.setTool('select');
        else st.select(null);
      } else if (e.key.startsWith('Arrow') && st.selection?.type === 'item') {
        e.preventDefault();
        const it = st.project.items.find((i) => i.id === st.selection!.id);
        if (!it) return;
        const d = e.shiftKey ? 100 : 10;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        st.updateItem(it.id, { x: it.x + dx, y: it.y + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <Catalog />
        <div className={`stage view-${view}`}>
          {view !== '3d' && (
            <div className="pane pane-plan">
              <div className="pane-label">平面図</div>
              <PlanEditor />
            </div>
          )}
          {view !== 'plan' && ready && (
            <div className="pane pane-3d">
              <div className="pane-label">3Dビュー</div>
              <Scene3D />
            </div>
          )}
        </div>
        <Inspector />
      </div>
      {showEstimate && <EstimateModal />}
      {showPhoto3d && <PhotoModelModal />}
    </div>
  );
}
