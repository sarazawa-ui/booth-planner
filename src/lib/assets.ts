import type { Asset, AssetKind, ModelFormat, Project } from '../types';
import { uid } from './geom';

// 画像・3Dモデルは容量が大きいので IndexedDB に Blob のまま保存する。
const DB_NAME = 'booth-planner';
const STORE_ASSETS = 'assets';
const STORE_KV = 'kv';

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_ASSETS)) d.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
        if (!d.objectStoreNames.contains(STORE_KV)) d.createObjectStore(STORE_KV);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB が他のタブで使用中です'));
    });
    dbp.catch(() => (dbp = null));
  }
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

type StoredAsset = Omit<Asset, 'url'>;

export async function saveAssetDb(a: Asset) {
  const { url: _url, ...rest } = a;
  await tx(STORE_ASSETS, 'readwrite', (s) => s.put(rest));
}

export async function deleteAssetDb(id: string) {
  await tx(STORE_ASSETS, 'readwrite', (s) => s.delete(id));
}

export async function loadAllAssets(): Promise<Asset[]> {
  const rows = await tx<StoredAsset[]>(STORE_ASSETS, 'readonly', (s) => s.getAll() as IDBRequest<StoredAsset[]>);
  return rows.map((r) => ({ ...r, url: URL.createObjectURL(r.blob) }));
}

export async function saveProjectDb(p: Project) {
  await tx(STORE_KV, 'readwrite', (s) => s.put(p, 'project'));
}

export async function loadProjectDb(): Promise<Project | undefined> {
  return tx<Project | undefined>(STORE_KV, 'readonly', (s) => s.get('project') as IDBRequest<Project | undefined>);
}

export function modelFormatOf(name: string): ModelFormat | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'glb' || ext === 'gltf' || ext === 'obj' || ext === 'stl' || ext === 'fbx') return ext;
  return null;
}

export function makeAsset(file: Blob, name: string, kind: AssetKind, format?: ModelFormat): Asset {
  return {
    id: uid(),
    kind,
    name,
    mime: file.type || 'application/octet-stream',
    format,
    blob: file,
    url: URL.createObjectURL(file),
  };
}

// ---- ファイル書き出し/読み込み(.booth.json) ----

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

interface FileAsset extends Omit<StoredAsset, 'blob'> {
  data: string;
}

export function usedAssetIds(p: Project): Set<string> {
  const ids = new Set<string>();
  const add = (g?: { assetId: string } | null) => g && ids.add(g.assetId);
  p.walls.forEach((w) => {
    add(w.graphicA);
    add(w.graphicB);
  });
  p.items.forEach((it) => {
    add(it.graphic);
    if (it.model) ids.add(it.model.assetId);
  });
  add(p.booth.fascia.logo);
  return ids;
}

export async function exportProjectFile(p: Project, assets: Record<string, Asset>) {
  const used = usedAssetIds(p);
  const list: FileAsset[] = [];
  for (const id of used) {
    const a = assets[id];
    if (!a) continue;
    list.push({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, format: a.format, data: await blobToBase64(a.blob) });
  }
  const json = JSON.stringify({ app: 'booth-planner', project: p, assets: list });
  const blob = new Blob([json], { type: 'application/json' });
  const name = `${p.meta.title || 'booth'}.booth.json`;
  downloadBlob(blob, name);
}

export async function importProjectFile(file: File): Promise<{ project: Project; assets: Asset[] }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'booth-planner' || !data.project) throw new Error('ブースプランナーの保存ファイルではありません');
  const assets: Asset[] = (data.assets as FileAsset[]).map((fa) => {
    const blob = base64ToBlob(fa.data, fa.mime);
    return { id: fa.id, kind: fa.kind, name: fa.name, mime: fa.mime, format: fa.format, blob, url: URL.createObjectURL(blob) };
  });
  return { project: data.project as Project, assets };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readImageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = url;
  });
}
