import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();

function get<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

/** 塗装・化粧板 */
export const paint = (color: string, rough = 0.55) =>
  get(`paint:${color}:${rough}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));

/** メラミン(オクタノルムパネル等) */
export const melamine = (color: string) =>
  get(`mel:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }));

export const fabric = (color: string) =>
  get(`fab:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));

export const plastic = (color: string) =>
  get(`pl:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 }));

/** 塗装した金属(缶・機械の外装) */
export const metalPaint = (color: string) =>
  get(`mp:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.55 }));

export const aluminum = () =>
  get('alu', () => new THREE.MeshStandardMaterial({ color: '#d2d5d9', roughness: 0.3, metalness: 0.9 }));

export const chrome = () =>
  get('chrome', () => new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.08, metalness: 1 }));

export const blackMetal = () =>
  get('blackmetal', () => new THREE.MeshStandardMaterial({ color: '#1d1e20', roughness: 0.45, metalness: 0.6 }));

export const glass = () =>
  get(
    'glass',
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#e8f2f2',
        roughness: 0.02,
        metalness: 0,
        transparent: true,
        opacity: 0.16,
        ior: 1.5,
        specularIntensity: 1,
        envMapIntensity: 2.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
  );

export const screenOff = () =>
  get('screen', () => new THREE.MeshPhysicalMaterial({ color: '#07080a', roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }));

export const emissive = (color: string, intensity = 3) =>
  get(`em:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: intensity }));

export const foliage = (i: number) =>
  get(`leaf:${i % 4}`, () => new THREE.MeshStandardMaterial({ color: ['#2f5d2c', '#3b6e33', '#264d25', '#4a7c3a'][i % 4], roughness: 0.75, metalness: 0, flatShading: true }));

/** 色の明暗を少し変える */
export function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
