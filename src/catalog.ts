import type { Item } from './types';

export type CategoryId = 'stage' | 'mock' | 'case' | 'furniture' | 'light' | 'graphic' | 'av' | 'deco';

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: 'stage', name: '展示台' },
  { id: 'mock', name: '展示モック' },
  { id: 'case', name: 'ケース・カウンター' },
  { id: 'furniture', name: '家具' },
  { id: 'light', name: '照明' },
  { id: 'graphic', name: 'グラフィック' },
  { id: 'av', name: '映像・電気' },
  { id: 'deco', name: '装飾・構造' },
];

export type Mount = 'floor' | 'wall' | 'ceiling';

export interface SizePreset {
  label: string;
  w: number;
  d: number;
  h: number;
}

export interface CatalogDef {
  kind: string;
  cat: CategoryId | 'model';
  name: string;
  w: number;
  d: number;
  h: number;
  elev?: number;
  round?: boolean;
  mount?: Mount;
  color?: string;
  colors?: { name: string; hex: string }[];
  graphic?: boolean;
  /** 文字入力欄を出す場合の初期値 */
  text?: string;
  light?: { watt: number; angle: number; kelvin: number };
  sizes?: SizePreset[];
  unit: string;
  /** 見積リストの区分 */
  estimate: string;
  /** 見積リストに載せない(スケール人物など) */
  noEstimate?: boolean;
  /** w,d,h のうちサイズ変更を許すもの */
  resizable?: ('w' | 'd' | 'h')[];
  /** 画像欄の見出し(未指定なら品目に応じた既定の見出し) */
  graphicTitle?: string;
  /** 展示台・テーブル等の上に置くもの(下にある天板の高さへ自動で載る) */
  stack?: boolean;
  /** 一覧のアイコン(24x24 viewBox の SVG path) */
  icon: string;
}

export const FURNITURE_COLORS = [
  { name: 'ホワイト', hex: '#f3f2ee' },
  { name: 'ライトグレー', hex: '#c9cbcc' },
  { name: 'ブラック', hex: '#2a2b2d' },
  { name: 'ナチュラル木目', hex: '#c89f6e' },
  { name: 'ダーク木目', hex: '#6b4a32' },
  { name: 'ネイビー', hex: '#24324f' },
  { name: 'レッド', hex: '#b3282d' },
];

export const CHAIR_COLORS = [
  { name: 'ブラック', hex: '#2a2b2d' },
  { name: 'ホワイト', hex: '#ecebe7' },
  { name: 'グレー', hex: '#8d9093' },
  { name: 'ブルー', hex: '#2c5d9c' },
  { name: 'レッド', hex: '#b3282d' },
  { name: 'グリーン', hex: '#3d7a4f' },
];

export const MOCK_COLORS = [
  { name: 'ホワイト', hex: '#f3f2ee' },
  { name: 'オフホワイト', hex: '#e4e5e3' },
  { name: 'ライトグレー', hex: '#c9cbcc' },
  { name: 'シルバー', hex: '#9fa4a9' },
  { name: 'ブラック', hex: '#2a2b2d' },
  { name: 'ネイビー', hex: '#24324f' },
  { name: 'ブルー', hex: '#2c5d9c' },
  { name: 'レッド', hex: '#b3282d' },
  { name: 'グリーン', hex: '#3d7a4f' },
  { name: 'イエロー', hex: '#d9a53a' },
];

export const CARPET_COLORS = [
  { name: 'グレー', hex: '#8a8c8e' },
  { name: 'ダークグレー', hex: '#4a4c4f' },
  { name: 'ブラック', hex: '#232427' },
  { name: 'ネイビー', hex: '#22304d' },
  { name: 'ブルー', hex: '#2e5a9a' },
  { name: 'ライトブルー', hex: '#6c9cc8' },
  { name: 'レッド', hex: '#a3262b' },
  { name: 'ワインレッド', hex: '#6a1f2b' },
  { name: 'グリーン', hex: '#3b6b45' },
  { name: 'オレンジ', hex: '#cf6a26' },
  { name: 'イエロー', hex: '#d4b02f' },
  { name: 'ベージュ', hex: '#c7b593' },
  { name: 'ブラウン', hex: '#6a4f3a' },
  { name: 'ホワイト', hex: '#e6e4de' },
];

export const WALL_COLORS = [
  { name: 'ホワイト', hex: '#f2f1ec' },
  { name: 'オフホワイト', hex: '#ebe5d8' },
  { name: 'ライトグレー', hex: '#c8cacb' },
  { name: 'チャコール', hex: '#4b4d50' },
  { name: 'ブラック', hex: '#222326' },
  { name: 'ネイビー', hex: '#22304d' },
  { name: 'ブルー', hex: '#2e5a9a' },
  { name: 'レッド', hex: '#a3262b' },
  { name: 'グリーン', hex: '#3b6b45' },
  { name: 'イエロー', hex: '#d9b331' },
  { name: '木目(ナチュラル)', hex: '#c89f6e' },
];

const ICON = {
  box: 'M4 9l8-4 8 4v8l-8 4-8-4z M4 9l8 4 8-4 M12 13v8',
  low: 'M3 13l9-4 9 4v3l-9 4-9-4z M3 13l9 4 9-4 M12 17v3',
  round: 'M6 7a6 2.5 0 1 0 12 0a6 2.5 0 1 0-12 0 M6 7v11a6 2.5 0 0 0 12 0V7',
  case: 'M5 4h14v16H5z M5 12h14 M8 4v8',
  counter: 'M3 9h18v3H3z M4 12v8h16v-8 M12 12v8',
  table: 'M4 8a8 3 0 1 0 16 0a8 3 0 1 0-16 0 M12 11v9 M8 20h8',
  rect: 'M3 8h18l-2 3H5z M6 11v8 M18 11v8',
  chair: 'M7 3h10v9H7z M6 12h12v2H6z M7 14v7 M17 14v7',
  stool: 'M7 6a5 2 0 1 0 10 0a5 2 0 1 0-10 0 M12 8v10 M8 21l4-3 4 3',
  stand: 'M7 3h10v14H7z M7 7h10 M7 11h10 M9 17l-2 4 M15 17l2 4',
  shelf: 'M3 6v12 M3 10h16l2 2H5z',
  plant: 'M8 15h8l-1 6H9z M12 15c-6-2-7-8-4-11 3 2 4 6 4 11zm0 0c6-2 7-8 4-11-3 2-4 6-4 11z',
  spot: 'M3 5h4 M5 5v4l6 3 M11 12l2-4 4 2-2 4z M14 15l-3 6 M17 14l3 6',
  floorspot: 'M10 3h4l1 4H9z M12 7v13 M8 21h8',
  bar: 'M3 10h18v3H3z M6 13l-2 6 M12 13v7 M18 13l2 6',
  pendant: 'M12 2v7 M7 15a5 5 0 0 1 10 0z M10 18h4',
  truss: 'M2 8h20v6H2z M2 14l4-6 4 6 4-6 4 6 4-6',
  trussspot: 'M2 4h20 M12 4v4 M9 8h6l2 5H7z M10 16l-3 5 M14 16l3 5',
  panel: 'M6 3h12v15H6z M8 18l-2 3 M16 18l2 3 M9 7h6 M9 10h6',
  wallpanel: 'M3 3v18 M7 6h12v10H7z M10 9h6',
  banner: 'M7 2h10v17H7z M5 19h14v3H5z M9 6h6 M9 9h4',
  hang: 'M8 2l-2 6 M16 2l2 6 M4 8h16v7H4z M4 15l2 2h12l2-2',
  hanground: 'M12 2v5 M5 8a7 2 0 1 0 14 0a7 2 0 1 0-14 0 M5 8v6a7 2 0 0 0 14 0V8',
  cutout: 'M4 7h4v10H4z M10 7h4l2 5-2 5h-4z M18 7v10',
  monitor: 'M3 4h18v11H3z M12 15v4 M7 21h10',
  bottle: 'M10 2h4v3h-4z M10 5l-2 4v12h8V9l-2-4 M8 12h8 M8 17h8',
  can: 'M7 5a5 2 0 1 0 10 0a5 2 0 1 0-10 0 M7 5v14a5 2 0 0 0 10 0V5 M7 9h10',
  device: 'M3 7h18v10H3z M5 9h8v6H5z M16 10h3 M16 13h3 M5 17v2 M19 17v2',
  ctrlbox: 'M5 3h14v18H5z M8 6h1 M11.5 6h1 M15 6h1 M8 9h8v6H8z M15 18h1',
  machine: 'M3 20h18 M4 20V7h16v13 M7 10h7v7H7z M16 10h2v3h-2z M18 7V3 M16 3h4',
  motor: 'M3 8h13v9H3z M6 8v9 M9 8v9 M12 8v9 M16 11h5v3h-5 M4 17l-1 3h13l-1-3',
  compressor: 'M5 13h14a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6z M8 13V8h8v5 M12 8V5 M7 19v2 M17 19v2',
  deskmonitor: 'M5 5h14v9H5z M12 14v3 M8 17h8 M2 20h20',
  tablet: 'M8 4h8v12H8z M11 14h2 M7 19l5-3 5 3',
  catalogdesk: 'M4 20h16 M5 20l2-6h4l-1 6 M10 20l2-9h4l-1 9 M15 20l2-12h4l-2 12',
  catalograck: 'M5 3v18 M19 3v18 M5 7h14 M5 12h14 M5 17h14 M9 7v-2h2v2 M13 12v-2h2v2 M9 17v-2h2v2',
  monitorwall: 'M3 3v18 M6 6h15v10H6z',
  outlet: 'M5 5h14v14H5z M9 10v2 M15 10v2 M10 15h4',
  rug: 'M3 9l9-4 9 4-9 4z M3 9v2l9 4 9-4V9',
  pillar: 'M8 3h8v18H8z M8 3l2-1h8l-2 1 M16 3v18l2-1V2',
  door: 'M5 3h14v18H5z M15 12h1',
  person: 'M12 2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M8 9h8l-1 7h-2l-1 6-1-6H9z',
  model: 'M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
};

export const CATALOG: CatalogDef[] = [
  // 展示台
  {
    kind: 'stage_box', cat: 'stage', name: '展示台', w: 900, d: 600, h: 700, color: '#f3f2ee', colors: FURNITURE_COLORS,
    sizes: [
      { label: 'W600×D600×H900', w: 600, d: 600, h: 900 },
      { label: 'W900×D600×H700', w: 900, d: 600, h: 700 },
      { label: 'W1200×D600×H700', w: 1200, d: 600, h: 700 },
      { label: 'W1800×D900×H700', w: 1800, d: 900, h: 700 },
      { label: 'W450×D450×H1000', w: 450, d: 450, h: 1000 },
    ],
    unit: '台', estimate: '展示台', resizable: ['w', 'd', 'h'], icon: ICON.box,
  },
  {
    kind: 'stage_low', cat: 'stage', name: '低床ステージ', w: 1800, d: 900, h: 100, color: '#f3f2ee', colors: FURNITURE_COLORS,
    sizes: [
      { label: 'W1800×D900×H100', w: 1800, d: 900, h: 100 },
      { label: 'W2700×D1800×H200', w: 2700, d: 1800, h: 200 },
      { label: 'W3600×D1800×H200', w: 3600, d: 1800, h: 200 },
    ],
    unit: '台', estimate: '展示台', resizable: ['w', 'd', 'h'], icon: ICON.low,
  },
  {
    kind: 'stage_round', cat: 'stage', name: '円形展示台', w: 600, d: 600, h: 900, round: true, color: '#f3f2ee', colors: FURNITURE_COLORS,
    sizes: [
      { label: 'φ450×H1000', w: 450, d: 450, h: 1000 },
      { label: 'φ600×H900', w: 600, d: 600, h: 900 },
      { label: 'φ900×H700', w: 900, d: 900, h: 700 },
      { label: 'φ1500×H300', w: 1500, d: 1500, h: 300 },
    ],
    unit: '台', estimate: '展示台', resizable: ['w', 'h'], icon: ICON.round,
  },
  {
    kind: 'stage_acrylic', cat: 'stage', name: 'アクリルカバー付展示台', w: 450, d: 450, h: 1200, color: '#f3f2ee', colors: FURNITURE_COLORS,
    unit: '台', estimate: '展示台', resizable: ['w', 'd', 'h'], icon: ICON.case,
  },

  // 展示モック
  {
    kind: 'mock_box', cat: 'mock', name: '直方体', w: 200, d: 200, h: 200, color: '#f3f2ee', colors: MOCK_COLORS, graphic: true, graphicTitle: '前面の画像', stack: true,
    sizes: [
      { label: '小箱 W100×D100×H150', w: 100, d: 100, h: 150 },
      { label: '製品箱 W300×D200×H150', w: 300, d: 200, h: 150 },
      { label: 'A4厚型 W297×D210×H50', w: 297, d: 210, h: 50 },
      { label: '中箱 W400×D300×H300', w: 400, d: 300, h: 300 },
      { label: '大箱 W600×D400×H400', w: 600, d: 400, h: 400 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'd', 'h'], icon: ICON.box,
  },
  {
    kind: 'mock_cylinder', cat: 'mock', name: '円柱', w: 150, d: 150, h: 300, round: true, color: '#c9cbcc', colors: MOCK_COLORS, stack: true,
    sizes: [
      { label: 'φ100×H200', w: 100, d: 100, h: 200 },
      { label: 'φ150×H300', w: 150, d: 150, h: 300 },
      { label: 'φ300×H150', w: 300, d: 300, h: 150 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'h'], icon: ICON.round,
  },
  {
    kind: 'mock_bottle', cat: 'mock', name: 'ボトル', w: 65, d: 65, h: 205, round: true, color: '#2c5d9c', colors: MOCK_COLORS, graphic: true, graphicTitle: 'ラベルの画像', stack: true,
    sizes: [
      { label: '250ml φ52×H150', w: 52, d: 52, h: 150 },
      { label: '500ml φ65×H205', w: 65, d: 65, h: 205 },
      { label: '1L φ85×H260', w: 85, d: 85, h: 260 },
      { label: '2L φ105×H310', w: 105, d: 105, h: 310 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'h'], icon: ICON.bottle,
  },
  {
    kind: 'mock_can', cat: 'mock', name: '缶', w: 66, d: 66, h: 122, round: true, color: '#b3282d', colors: MOCK_COLORS, graphic: true, graphicTitle: 'ラベルの画像', stack: true,
    sizes: [
      { label: '350ml φ66×H122', w: 66, d: 66, h: 122 },
      { label: '500ml φ66×H167', w: 66, d: 66, h: 167 },
      { label: '4L缶 φ170×H190', w: 170, d: 170, h: 190 },
      { label: '18L缶 φ290×H350', w: 290, d: 290, h: 350 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'h'], icon: ICON.can,
  },
  {
    kind: 'mock_device', cat: 'mock', name: '小型機器(卓上)', w: 300, d: 250, h: 180, color: '#c9cbcc', colors: MOCK_COLORS, graphic: true, graphicTitle: '画面に表示する画像', stack: true,
    sizes: [
      { label: '小 W200×D160×H110', w: 200, d: 160, h: 110 },
      { label: '中 W300×D250×H180', w: 300, d: 250, h: 180 },
      { label: '大 W450×D400×H300', w: 450, d: 400, h: 300 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'd', 'h'], icon: ICON.device,
  },
  {
    kind: 'mock_ctrlbox', cat: 'mock', name: '制御ボックス', w: 400, d: 200, h: 500, color: '#c9cbcc', colors: MOCK_COLORS, graphic: true, graphicTitle: '画面に表示する画像', stack: true,
    sizes: [
      { label: '小 W300×D150×H400', w: 300, d: 150, h: 400 },
      { label: '中 W400×D200×H500', w: 400, d: 200, h: 500 },
      { label: '大 W600×D250×H800', w: 600, d: 250, h: 800 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'd', 'h'], icon: ICON.ctrlbox,
  },
  {
    kind: 'mock_motor', cat: 'mock', name: 'モーター', w: 400, d: 220, h: 240, color: '#2c5d9c', colors: MOCK_COLORS, stack: true,
    sizes: [
      { label: '小 W250×D140×H150', w: 250, d: 140, h: 150 },
      { label: '中 W400×D220×H240', w: 400, d: 220, h: 240 },
      { label: '大 W700×D380×H420', w: 700, d: 380, h: 420 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'd', 'h'], icon: ICON.motor,
  },
  {
    kind: 'mock_compressor', cat: 'mock', name: 'コンプレッサー', w: 900, d: 380, h: 750, color: '#b3282d', colors: MOCK_COLORS, stack: true,
    sizes: [
      { label: '小型 W500×D220×H450', w: 500, d: 220, h: 450 },
      { label: '中型 W900×D380×H750', w: 900, d: 380, h: 750 },
      { label: '大型 W1500×D550×H1200', w: 1500, d: 550, h: 1200 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'd', 'h'], icon: ICON.compressor,
  },
  {
    kind: 'mock_machine', cat: 'mock', name: '産業機械', w: 1200, d: 800, h: 1600, color: '#e4e5e3', colors: MOCK_COLORS, graphic: true, graphicTitle: '操作画面に表示する画像', stack: true,
    sizes: [
      { label: '小型 W800×D600×H1200', w: 800, d: 600, h: 1200 },
      { label: '中型 W1200×D800×H1600', w: 1200, d: 800, h: 1600 },
      { label: '大型 W2000×D1200×H2000', w: 2000, d: 1200, h: 2000 },
    ],
    unit: '点', estimate: '展示モック', resizable: ['w', 'd', 'h'], icon: ICON.machine,
  },

  // ケース・カウンター
  {
    kind: 'case_low', cat: 'case', name: 'ガラスショーケース(平台)', w: 900, d: 450, h: 1000, color: '#f3f2ee', colors: FURNITURE_COLORS,
    sizes: [
      { label: 'W900×D450×H1000', w: 900, d: 450, h: 1000 },
      { label: 'W1200×D500×H1000', w: 1200, d: 500, h: 1000 },
      { label: 'W1800×D500×H1000', w: 1800, d: 500, h: 1000 },
    ],
    unit: '台', estimate: 'ケース・カウンター', resizable: ['w', 'd', 'h'], icon: ICON.case,
  },
  {
    kind: 'case_tower', cat: 'case', name: 'タワーショーケース', w: 450, d: 450, h: 1800, color: '#f3f2ee', colors: FURNITURE_COLORS,
    unit: '台', estimate: 'ケース・カウンター', resizable: ['w', 'd', 'h'], icon: ICON.case,
  },
  {
    kind: 'counter', cat: 'case', name: '受付カウンター', w: 1200, d: 450, h: 1000, color: '#f3f2ee', colors: FURNITURE_COLORS, graphic: true,
    sizes: [
      { label: 'W900×D450×H1000', w: 900, d: 450, h: 1000 },
      { label: 'W1200×D450×H1000', w: 1200, d: 450, h: 1000 },
      { label: 'W1800×D600×H1000', w: 1800, d: 600, h: 1000 },
    ],
    unit: '台', estimate: 'ケース・カウンター', resizable: ['w', 'd', 'h'], icon: ICON.counter,
  },
  {
    kind: 'counter_storage', cat: 'case', name: '収納付カウンター(扉付)', w: 900, d: 450, h: 900, color: '#f3f2ee', colors: FURNITURE_COLORS,
    unit: '台', estimate: 'ケース・カウンター', resizable: ['w', 'd', 'h'], icon: ICON.counter,
  },

  // 家具
  {
    kind: 'table_round', cat: 'furniture', name: '丸テーブル', w: 750, d: 750, h: 700, round: true, color: '#f3f2ee', colors: FURNITURE_COLORS,
    sizes: [
      { label: 'φ600×H700', w: 600, d: 600, h: 700 },
      { label: 'φ750×H700', w: 750, d: 750, h: 700 },
      { label: 'φ900×H700', w: 900, d: 900, h: 700 },
    ],
    unit: '台', estimate: '家具', resizable: ['w', 'h'], icon: ICON.table,
  },
  {
    kind: 'table_rect', cat: 'furniture', name: '商談テーブル', w: 1200, d: 750, h: 700, color: '#f3f2ee', colors: FURNITURE_COLORS,
    sizes: [
      { label: 'W900×D900×H700', w: 900, d: 900, h: 700 },
      { label: 'W1200×D750×H700', w: 1200, d: 750, h: 700 },
      { label: 'W1800×D900×H700', w: 1800, d: 900, h: 700 },
    ],
    unit: '台', estimate: '家具', resizable: ['w', 'd', 'h'], icon: ICON.rect,
  },
  {
    kind: 'chair', cat: 'furniture', name: '椅子(スタッキング)', w: 450, d: 500, h: 800, color: '#2a2b2d', colors: CHAIR_COLORS,
    unit: '脚', estimate: '家具', icon: ICON.chair,
  },
  {
    kind: 'table_high', cat: 'furniture', name: 'ハイテーブル', w: 600, d: 600, h: 1000, round: true, color: '#f3f2ee', colors: FURNITURE_COLORS,
    unit: '台', estimate: '家具', resizable: ['w', 'h'], icon: ICON.table,
  },
  {
    kind: 'stool', cat: 'furniture', name: 'ハイスツール', w: 380, d: 380, h: 750, round: true, color: '#2a2b2d', colors: CHAIR_COLORS,
    unit: '脚', estimate: '家具', icon: ICON.stool,
  },
  {
    kind: 'pamphlet', cat: 'furniture', name: 'パンフレットスタンド', w: 300, d: 350, h: 1400, color: '#c9cbcc', colors: FURNITURE_COLORS,
    unit: '台', estimate: '家具', icon: ICON.stand,
  },
  {
    kind: 'catalog_rack', cat: 'furniture', name: 'カタログラック(床置き)', w: 800, d: 350, h: 1500, color: '#c9cbcc', colors: FURNITURE_COLORS, graphic: true,
    sizes: [
      { label: 'A4 2列×4段 W560', w: 560, d: 350, h: 1500 },
      { label: 'A4 3列×4段 W800', w: 800, d: 350, h: 1500 },
      { label: 'A4 4列×5段 W1050', w: 1050, d: 380, h: 1750 },
    ],
    unit: '台', estimate: '家具', resizable: ['w', 'h'], icon: ICON.catalograck,
  },
  {
    kind: 'catalog_desk', cat: 'furniture', name: '卓上カタログスタンド', w: 240, d: 220, h: 340, graphic: true, stack: true,
    sizes: [
      { label: 'A4 1段', w: 240, d: 120, h: 300 },
      { label: 'A4 2段', w: 240, d: 170, h: 320 },
      { label: 'A4 3段', w: 240, d: 220, h: 340 },
      { label: 'A4 3列×1段', w: 700, d: 120, h: 300 },
    ],
    unit: '台', estimate: '家具', resizable: ['w', 'd'], icon: ICON.catalogdesk,
  },
  {
    kind: 'shelf', cat: 'furniture', name: '壁面棚板', w: 900, d: 300, h: 25, elev: 1200, mount: 'wall', color: '#f3f2ee', colors: FURNITURE_COLORS,
    unit: '枚', estimate: '家具', resizable: ['w', 'd'], icon: ICON.shelf,
  },
  {
    kind: 'plant', cat: 'furniture', name: '観葉植物', w: 500, d: 500, h: 1500, round: true,
    sizes: [
      { label: '小 H900', w: 400, d: 400, h: 900 },
      { label: '中 H1500', w: 500, d: 500, h: 1500 },
      { label: '大 H1800', w: 650, d: 650, h: 1800 },
    ],
    unit: '鉢', estimate: '家具', resizable: ['h'], icon: ICON.plant,
  },

  // 照明
  {
    kind: 'arm_spot', cat: 'light', name: 'アームスポット(LED)', w: 120, d: 450, h: 120, elev: 2580, mount: 'wall',
    light: { watt: 15, angle: 38, kelvin: 3500 }, unit: '灯', estimate: '照明', icon: ICON.spot,
  },
  {
    kind: 'stand_spot', cat: 'light', name: 'スタンドスポット', w: 400, d: 400, h: 1800, round: true,
    light: { watt: 20, angle: 30, kelvin: 3500 }, unit: '灯', estimate: '照明', icon: ICON.floorspot,
  },
  {
    kind: 'led_bar', cat: 'light', name: 'LEDライン照明', w: 900, d: 60, h: 40, elev: 1180, mount: 'wall',
    light: { watt: 12, angle: 110, kelvin: 4000 }, unit: '本', estimate: '照明', resizable: ['w'], icon: ICON.bar,
  },
  {
    kind: 'pendant', cat: 'light', name: 'ペンダントライト', w: 350, d: 350, h: 800, elev: 2000, round: true, mount: 'ceiling', color: '#2a2b2d', colors: CHAIR_COLORS,
    light: { watt: 10, angle: 100, kelvin: 2900 }, unit: '灯', estimate: '照明', icon: ICON.pendant,
  },
  {
    kind: 'truss_spot', cat: 'light', name: 'トラス用スポット', w: 150, d: 150, h: 250, elev: 3550, mount: 'ceiling',
    light: { watt: 30, angle: 30, kelvin: 3500 }, unit: '灯', estimate: '照明', icon: ICON.trussspot,
  },

  // グラフィック
  {
    kind: 'panel_free', cat: 'graphic', name: '自立パネル', w: 900, d: 40, h: 1800, color: '#f3f2ee', colors: FURNITURE_COLORS, graphic: true,
    sizes: [
      { label: 'W600×H1800', w: 600, d: 40, h: 1800 },
      { label: 'W900×H1800', w: 900, d: 40, h: 1800 },
      { label: 'W900×H2100', w: 900, d: 40, h: 2100 },
    ],
    unit: '枚', estimate: 'グラフィック', resizable: ['w', 'h'], icon: ICON.panel,
  },
  {
    kind: 'panel_wall', cat: 'graphic', name: '壁付パネル', w: 900, d: 5, h: 1200, elev: 900, mount: 'wall', graphic: true,
    sizes: [
      { label: 'A1縦 W594×H841', w: 594, d: 5, h: 841 },
      { label: 'A0縦 W841×H1189', w: 841, d: 5, h: 1189 },
      { label: 'B0縦 W1030×H1456', w: 1030, d: 5, h: 1456 },
      { label: 'W900×H1200', w: 900, d: 5, h: 1200 },
      { label: 'W1800×H900', w: 1800, d: 5, h: 900 },
    ],
    unit: '枚', estimate: 'グラフィック', resizable: ['w', 'h'], icon: ICON.wallpanel,
  },
  {
    kind: 'banner_stand', cat: 'graphic', name: 'ロールアップバナー', w: 850, d: 300, h: 2000, graphic: true,
    unit: '台', estimate: 'グラフィック', resizable: ['w', 'h'], icon: ICON.banner,
  },
  {
    kind: 'hang_square', cat: 'graphic', name: '吊りバナー(四角)', w: 2400, d: 2400, h: 900, elev: 3600, mount: 'ceiling', graphic: true,
    unit: '基', estimate: 'グラフィック', resizable: ['w', 'd', 'h'], icon: ICON.hang,
  },
  {
    kind: 'hang_round', cat: 'graphic', name: '吊りバナー(円形)', w: 2400, d: 2400, h: 900, elev: 3600, round: true, mount: 'ceiling', graphic: true,
    unit: '基', estimate: 'グラフィック', resizable: ['w', 'h'], icon: ICON.hanground,
  },
  {
    kind: 'cutout', cat: 'graphic', name: '切り文字ロゴ', w: 1500, d: 10, h: 300, elev: 1900, mount: 'wall', color: '#1f2a44', graphic: true, text: 'COMPANY',
    unit: '式', estimate: 'グラフィック', resizable: ['w', 'h'], icon: ICON.cutout,
  },

  // 映像・電気
  {
    kind: 'monitor_stand', cat: 'av', name: '液晶モニター(スタンド)', w: 1130, d: 500, h: 1750, graphic: true,
    sizes: [
      { label: '43型', w: 970, d: 450, h: 1650 },
      { label: '50型', w: 1130, d: 500, h: 1750 },
      { label: '65型', w: 1460, d: 550, h: 1900 },
    ],
    unit: '台', estimate: '映像・電気', icon: ICON.monitor,
  },
  {
    kind: 'monitor_wall', cat: 'av', name: '壁掛けモニター', w: 1240, d: 60, h: 720, elev: 1300, mount: 'wall', graphic: true,
    sizes: [
      { label: '43型', w: 970, d: 60, h: 570 },
      { label: '55型', w: 1240, d: 60, h: 720 },
      { label: '65型', w: 1460, d: 60, h: 840 },
    ],
    unit: '台', estimate: '映像・電気', icon: ICON.monitorwall,
  },
  {
    kind: 'monitor_desk', cat: 'av', name: '卓上モニター', w: 615, d: 200, h: 460, graphic: true, stack: true,
    sizes: [
      { label: '24型', w: 540, d: 180, h: 420 },
      { label: '27型', w: 615, d: 200, h: 460 },
      { label: '32型', w: 730, d: 220, h: 520 },
      { label: '43型', w: 970, d: 250, h: 660 },
    ],
    unit: '台', estimate: '映像・電気', icon: ICON.deskmonitor,
  },
  {
    kind: 'tablet', cat: 'av', name: 'タブレット(卓上スタンド)', w: 250, d: 180, h: 260, graphic: true, stack: true,
    unit: '台', estimate: '映像・電気', icon: ICON.tablet,
  },
  {
    kind: 'outlet', cat: 'av', name: 'コンセント(2口)', w: 120, d: 70, h: 60,
    unit: '個', estimate: '映像・電気', icon: ICON.outlet,
  },

  // 装飾・構造
  {
    kind: 'rug', cat: 'deco', name: 'エリアカーペット', w: 2000, d: 2000, h: 8, color: '#4a4c4f', colors: CARPET_COLORS,
    unit: '枚', estimate: '床', resizable: ['w', 'd'], icon: ICON.rug,
  },
  {
    kind: 'pillar', cat: 'deco', name: '化粧柱', w: 300, d: 300, h: 2700, color: '#f2f1ec', colors: WALL_COLORS,
    unit: '本', estimate: '造作', resizable: ['w', 'd', 'h'], icon: ICON.pillar,
  },
  {
    kind: 'door', cat: 'deco', name: '扉(倉庫用)', w: 800, d: 40, h: 2000, mount: 'wall', color: '#f2f1ec', colors: WALL_COLORS,
    unit: '枚', estimate: '造作', icon: ICON.door,
  },
  {
    kind: 'truss', cat: 'deco', name: 'アルミトラス(直線)', w: 3000, d: 300, h: 300, elev: 3700, mount: 'ceiling',
    unit: '本', estimate: '造作', resizable: ['w'], icon: ICON.truss,
  },
  {
    kind: 'person', cat: 'deco', name: '人物(スケール確認用)', w: 450, d: 280, h: 1700, color: '#9aa0a6',
    unit: '体', estimate: '', noEstimate: true, icon: ICON.person,
  },
];

/** 上に物を載せられる天板を持つもの */
export const SURFACE_KINDS = new Set(['stage_box', 'stage_low', 'stage_round', 'counter', 'counter_storage', 'table_round', 'table_rect', 'table_high', 'case_low', 'mock_box', 'mock_cylinder']);

export const MODEL_DEF: CatalogDef = {
  kind: 'model', cat: 'model', name: '持込品(3Dモデル)', w: 500, d: 500, h: 500, stack: true,
  unit: '点', estimate: '持込品', icon: ICON.model,
};

const BY_KIND = new Map(CATALOG.map((c) => [c.kind, c]));
BY_KIND.set('model', MODEL_DEF);

export function defOf(kind: string): CatalogDef {
  return BY_KIND.get(kind) ?? MODEL_DEF;
}

export function itemLabel(it: Item): string {
  return it.label || defOf(it.kind).name;
}
