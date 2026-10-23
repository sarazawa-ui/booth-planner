import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { Asset } from '../types';

const cache = new Map<string, Promise<THREE.Object3D>>();

const fallbackMat = () => new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.45, metalness: 0.2 });

export function loadModel(asset: Asset): Promise<THREE.Object3D> {
  let p = cache.get(asset.id);
  if (!p) {
    p = loadRaw(asset).then((obj) => {
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            const mm = mat as THREE.MeshStandardMaterial;
            if (mm && 'map' in mm && mm.map) mm.map.colorSpace = THREE.SRGBColorSpace;
          });
        }
      });
      return obj;
    });
    cache.set(asset.id, p);
    p.catch(() => cache.delete(asset.id));
  }
  return p;
}

async function loadRaw(asset: Asset): Promise<THREE.Object3D> {
  const url = asset.url;
  switch (asset.format) {
    case 'glb':
    case 'gltf': {
      const g = await new GLTFLoader().loadAsync(url);
      return g.scene;
    }
    case 'obj': {
      const o = await new OBJLoader().loadAsync(url);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          // OBJ は MTL なしだと質感が乏しいので標準マテリアルに置き換える
          const prev = m.material as THREE.MeshPhongMaterial;
          const mat = fallbackMat();
          if (prev?.color) mat.color.copy(prev.color);
          if (prev?.map) mat.map = prev.map;
          m.material = mat;
        }
      });
      return o;
    }
    case 'stl': {
      const geo = await new STLLoader().loadAsync(url);
      geo.computeVertexNormals();
      const hasColor = !!geo.getAttribute('color');
      const mat = fallbackMat();
      if (hasColor) mat.vertexColors = true;
      return new THREE.Mesh(geo, mat);
    }
    case 'fbx': {
      return new FBXLoader().loadAsync(url);
    }
    default:
      throw new Error('未対応の形式です');
  }
}

/** モデルの外形寸法(モデル単位)。upAxis='z' のときは Z を高さとして扱う */
export function modelBounds(obj: THREE.Object3D, upAxis: 'y' | 'z') {
  const o = new THREE.Group();
  if (upAxis === 'z') o.rotation.x = -Math.PI / 2;
  o.add(obj.clone(true));
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3());
  return { size, box };
}

/** 外形寸法からモデル単位を推定(mm/単位) */
export function guessUnit(maxDim: number): number {
  if (maxDim <= 0) return 1;
  if (maxDim < 30) return 1000; // m
  return 1; // mm(CADデータはほぼ mm)
}
