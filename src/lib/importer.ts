import { useStore } from '../store';
import { makeAsset, modelFormatOf, readImageSize } from './assets';
import { guessUnit, loadModel, modelBounds } from './models';
import { defOf } from '../catalog';
import type { Graphic } from '../types';

export async function importModelFile(file: File, at?: { x: number; y: number }) {
  const fmt = modelFormatOf(file.name);
  if (!fmt) throw new Error(`${file.name}: 対応形式は GLB / glTF / OBJ / STL / FBX です`);
  const asset = makeAsset(file, file.name, 'model', fmt);
  const obj = await loadModel(asset);
  const upAxis = fmt === 'stl' ? 'z' : 'y';
  const { size } = modelBounds(obj, upAxis);
  const unit = guessUnit(Math.max(size.x, size.y, size.z));
  const st = useStore.getState();
  st.addAsset(asset);
  return st.addItem('model', at?.x, at?.y, {
    w: Math.max(10, Math.round(size.x * unit)),
    d: Math.max(10, Math.round(size.z * unit)),
    h: Math.max(10, Math.round(size.y * unit)),
    label: file.name.replace(/\.[^.]+$/, ''),
    model: { assetId: asset.id, unit, upAxis },
  });
}

export async function importImageAsset(file: File) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: 画像ファイルではありません`);
  const asset = makeAsset(file, file.name, 'image');
  useStore.getState().addAsset(asset);
  const size = await readImageSize(asset.url);
  return { asset, size };
}

/** 平面図/3Dへのファイルドロップ。モデルは配置、画像は選択中の対象へ貼付(なければ自立パネル化) */
export async function importDroppedFiles(files: FileList | File[], at?: { x: number; y: number }) {
  const errors: string[] = [];
  for (const f of Array.from(files)) {
    try {
      if (modelFormatOf(f.name)) {
        await importModelFile(f, at);
      } else if (f.type.startsWith('image/')) {
        const { asset, size } = await importImageAsset(f);
        const g: Graphic = { assetId: asset.id, fit: 'cover' };
        const st = useStore.getState();
        const sel = st.selection;
        if (sel?.type === 'wall') {
          st.updateWall(sel.id, { graphicA: g });
        } else if (sel?.type === 'item' && defOf(st.project.items.find((i) => i.id === sel.id)?.kind ?? '').graphic) {
          st.updateItem(sel.id, { graphic: g });
        } else {
          const h = 1800;
          const w = Math.round(Math.min(2400, (h * size.w) / size.h) / 10) * 10;
          st.addItem('panel_free', at?.x, at?.y, { w, h, graphic: g });
        }
      } else {
        errors.push(`${f.name}: 未対応のファイルです`);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (errors.length) alert(errors.join('\n'));
}
