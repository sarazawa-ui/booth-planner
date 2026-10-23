// 単位はすべて mm。平面図は x=右、y=下(通路側)。小間の左上が原点。

export type BoothStyle = 'wood' | 'octanorm';
export type OpenType = 'one' | 'corner' | 'three' | 'island';
export type FloorType = 'punch' | 'tile' | 'flooring' | 'none';
export type WallFinish = 'paint' | 'woodgrain';
export type Fit = 'cover' | 'contain' | 'stretch';

export interface Graphic {
  assetId: string;
  fit: Fit;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  height: number;
  thickness: number;
  color: string;
  finish: WallFinish;
  /** A面 = 始点→終点に向かって左側(法線 n=(-dy,dx))。プリセットでは小間の内側。 */
  graphicA?: Graphic | null;
  graphicB?: Graphic | null;
}

export interface LightSetting {
  on: boolean;
  /** 0〜2 の相対強さ */
  intensity: number;
  /** 照射角(度) */
  angle: number;
  /** 色温度 K */
  kelvin: number;
}

export interface ModelSetting {
  assetId: string;
  /** モデル1単位あたりの mm */
  unit: number;
  upAxis: 'y' | 'z';
}

export interface Item {
  id: string;
  kind: string;
  x: number;
  y: number;
  /** 平面図上の時計回り角度(度)。0 のとき正面が通路側(+y)を向く */
  rot: number;
  /** 底面の高さ */
  elev: number;
  w: number;
  d: number;
  h: number;
  color?: string;
  graphic?: Graphic | null;
  text?: string;
  textColor?: string;
  light?: LightSetting;
  model?: ModelSetting;
  label?: string;
  note?: string;
}

export interface Booth {
  w: number;
  d: number;
  style: BoothStyle;
  open: OpenType;
  wallHeight: number;
  floor: {
    type: FloorType;
    color: string;
    raised: boolean;
  };
  fascia: {
    enabled: boolean;
    text: string;
    bg: string;
    fg: string;
    height: number;
    logo?: Graphic | null;
  };
}

export interface ProjectMeta {
  title: string;
  exhibition: string;
  venue: string;
  period: string;
  boothNo: string;
  company: string;
  contact: string;
  memo: string;
}

export interface Project {
  version: 1;
  meta: ProjectMeta;
  booth: Booth;
  walls: Wall[];
  items: Item[];
}

export type AssetKind = 'image' | 'model';
export type ModelFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'fbx';

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  format?: ModelFormat;
  blob: Blob;
  /** 実行時のみ。保存しない */
  url: string;
}

export type Selection = { type: 'wall' | 'item'; id: string } | null;
