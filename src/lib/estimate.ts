import type { Asset, Item, Project } from '../types';
import { CARPET_COLORS, WALL_COLORS, FURNITURE_COLORS, CHAIR_COLORS, defOf, itemLabel } from '../catalog';
import { fmtMm, octaCount, wallLen } from './geom';

export interface EstRow {
  group: string;
  name: string;
  spec: string;
  qty: number;
  unit: string;
  note: string;
}

const GROUP_ORDER = ['基礎', '壁面・造作', '床', 'グラフィック', '展示台', 'ケース・カウンター', '家具', '照明', '映像・電気', '造作', '持込品'];

function colorName(hex: string | undefined) {
  if (!hex) return '';
  const all = [...WALL_COLORS, ...CARPET_COLORS, ...FURNITURE_COLORS, ...CHAIR_COLORS];
  return all.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

const m2 = (w: number, h: number) => Math.round(((w / 1000) * (h / 1000)) * 100) / 100;
const FLOOR_NAME = { punch: 'パンチカーペット', tile: 'タイルカーペット', flooring: 'フローリング調シート', none: '' } as const;
const FIT_NAME = { cover: 'トリミング', contain: '全体表示', stretch: '伸縮' } as const;

export function buildEstimate(p: Project, assets: Record<string, Asset>): EstRow[] {
  const rows: EstRow[] = [];
  const b = p.booth;
  const style = b.style === 'wood' ? '木工ブース' : 'システムブース(オクタノルム)';
  const assetName = (id?: string) => (id ? assets[id]?.name ?? '画像' : '');

  rows.push({ group: '基礎', name: 'ブース施工', spec: `${style} 小間 W${fmtMm(b.w)}×D${fmtMm(b.d)}(${m2(b.w, b.d)}㎡)`, qty: 1, unit: '式', note: '' });

  // 壁
  if (p.walls.length) {
    if (b.style === 'octanorm') {
      const c = octaCount(p.walls);
      for (const [h, n] of [...c.posts].sort((a, z) => a[0] - z[0])) rows.push({ group: '壁面・造作', name: 'オクタノルム支柱', spec: `H${fmtMm(h)}`, qty: n, unit: '本', note: '' });
      for (const [k, n] of c.panels) rows.push({ group: '壁面・造作', name: 'システムパネル', spec: k, qty: n, unit: '枚', note: k.startsWith('W950') ? '' : '特寸' });
      if (c.beams) rows.push({ group: '壁面・造作', name: 'ビーム(パネル中段)', spec: 'L950', qty: c.beams, unit: '本', note: '' });
      for (const [k, n] of c.upper) rows.push({ group: '壁面・造作', name: '上部パネル', spec: k, qty: n, unit: '枚', note: '' });
      const colors = new Set(p.walls.map((w) => w.color));
      rows.push({ group: '壁面・造作', name: 'パネル色', spec: [...colors].map(colorName).join(' / '), qty: 1, unit: '式', note: '' });
    } else {
      const g = new Map<string, { len: number; n: number }>();
      for (const w of p.walls) {
        const L = wallLen(w);
        const key = `H${fmtMm(w.height)} t${w.thickness} ${w.finish === 'woodgrain' ? '木目シート貼り' : `塗装/クロス ${colorName(w.color)}`}`;
        const v = g.get(key) ?? { len: 0, n: 0 };
        v.len += L;
        v.n++;
        g.set(key, v);
      }
      for (const [k, v] of g) rows.push({ group: '壁面・造作', name: '木工壁', spec: `${k} 計L${fmtMm(v.len)}`, qty: Math.round((v.len / 1000) * 100) / 100, unit: 'm', note: `${v.n}面` });
    }
  }
  if (b.fascia.enabled) {
    rows.push({
      group: '壁面・造作',
      name: '社名板',
      spec: `W${fmtMm(b.w)}×H${fmtMm(b.fascia.height)} 「${b.fascia.text}」${b.fascia.logo ? ' ロゴ入り' : ''}`,
      qty: 1,
      unit: '式',
      note: b.style === 'octanorm' ? 'フロントビーム含む' : '',
    });
  }

  // 床
  if (b.floor.type !== 'none') {
    rows.push({ group: '床', name: FLOOR_NAME[b.floor.type], spec: `${b.floor.type === 'flooring' ? '' : colorName(b.floor.color) + ' '}${m2(b.w, b.d)}㎡`, qty: m2(b.w, b.d), unit: '㎡', note: '' });
  }
  if (b.floor.raised) rows.push({ group: '床', name: '床上げ(システム床)', spec: `H50 ${m2(b.w, b.d)}㎡`, qty: m2(b.w, b.d), unit: '㎡', note: '見切り材含む' });

  // 壁面出力
  p.walls.forEach((w, i) => {
    const L = wallLen(w);
    for (const [side, g] of [
      ['A面', w.graphicA],
      ['B面', w.graphicB],
    ] as const) {
      if (!g) continue;
      rows.push({
        group: 'グラフィック',
        name: '壁面全面出力',
        spec: `壁${i + 1} ${side} W${fmtMm(L)}×H${fmtMm(w.height)}(${m2(L, w.height)}㎡)`,
        qty: 1,
        unit: '面',
        note: `${assetName(g.assetId)} / ${FIT_NAME[g.fit]}`,
      });
    }
  });

  // アイテム(同種・同寸・同色でまとめる)
  const groups = new Map<string, { row: EstRow; files: Set<string> }>();
  for (const it of p.items) {
    const def = defOf(it.kind);
    if (def.noEstimate) continue;
    const group = it.kind === 'model' ? '持込品' : def.estimate;
    const name = itemLabel(it);
    const spec = specOf(it);
    const key = [group, name, spec].join('|');
    const file = it.graphic ? assetName(it.graphic.assetId) : '';
    const g = groups.get(key);
    if (g) {
      g.row.qty++;
      if (file) g.files.add(file);
    } else {
      groups.set(key, { row: { group, name, spec, qty: 1, unit: def.unit, note: it.note ?? '' }, files: new Set(file ? [file] : []) });
    }
  }
  for (const { row, files } of groups.values()) {
    if (files.size) row.note = [row.note, `データ: ${[...files].join(', ')}`].filter(Boolean).join(' / ');
    rows.push(row);
  }

  // 電気容量の目安
  const watts = p.items.reduce((s, it) => s + (defOf(it.kind).light && it.light?.on !== false ? defOf(it.kind).light!.watt : 0), 0);
  const avW = p.items.filter((it) => it.kind.startsWith('monitor')).length * 200;
  if (watts + avW > 0) {
    rows.push({ group: '映像・電気', name: '電気幹線工事(目安)', spec: `照明 ${watts}W + 映像機器 ${avW}W = ${((watts + avW) / 1000).toFixed(2)}kW`, qty: 1, unit: '式', note: '一次側容量は要確認' });
  }

  rows.sort((a, z) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(z.group));
  return rows;
}

function specOf(it: Item) {
  const def = defOf(it.kind);
  const parts: string[] = [];
  if (def.round) parts.push(`φ${fmtMm(it.w)}×H${fmtMm(it.h)}`);
  else if (it.kind === 'panel_wall' || it.kind === 'cutout') parts.push(`W${fmtMm(it.w)}×H${fmtMm(it.h)}`);
  else parts.push(`W${fmtMm(it.w)}×D${fmtMm(it.d)}×H${fmtMm(it.h)}`);
  if (it.color && def.colors) parts.push(colorName(it.color));
  if (def.light && it.light) parts.push(`${def.light.watt}W ${it.light.kelvin}K`);
  if (it.text) parts.push(`「${it.text}」`);
  if (def.mount === 'wall' && it.elev) parts.push(`取付H${fmtMm(it.elev)}`);
  if (it.graphic) parts.push('出力貼り');
  return parts.join(' ');
}

export function estimateCsv(p: Project, rows: EstRow[]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const m = p.meta;
  const head = [
    ['案件名', m.title],
    ['展示会名', m.exhibition],
    ['会期', m.period],
    ['会場', m.venue],
    ['小間番号', m.boothNo],
    ['出展社名', m.company],
    ['担当者', m.contact],
    [],
  ];
  const lines = [...head, ['区分', '品名', '仕様・サイズ', '数量', '単位', '備考'], ...rows.map((r) => [r.group, r.name, r.spec, r.qty, r.unit, r.note])];
  if (m.memo) lines.push([], ['備考', m.memo]);
  return '﻿' + lines.map((l) => l.map(esc).join(',')).join('\r\n');
}
