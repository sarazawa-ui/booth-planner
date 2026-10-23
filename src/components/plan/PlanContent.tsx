import type { Item, Project, Selection, Wall } from '../../types';
import { defOf, itemLabel } from '../../catalog';
import { fmtMm, octaPostPositions, wallAngle, wallLen, wallNormal } from '../../lib/geom';

interface Props {
  project: Project;
  /** 1px あたりの mm(文字や線幅を画面上で一定に保つため) */
  k: number;
  selection?: Selection;
  showGrid?: boolean;
}

const LAYER: Record<string, number> = { rug: 0, stage_low: 1 };
function layerOf(it: Item) {
  const m = defOf(it.kind).mount;
  if (m === 'ceiling') return 9;
  if (m === 'wall') return 5;
  if (defOf(it.kind).stack && it.elev > 0) return 6;
  return LAYER[it.kind] ?? 3;
}

export function sortedItems(items: Item[]) {
  return [...items].sort((a, b) => layerOf(a) - layerOf(b));
}

export default function PlanContent({ project, k, selection, showGrid = true }: Props) {
  const { booth, walls, items } = project;
  const W = booth.w;
  const D = booth.d;
  const isOcta = booth.style === 'octanorm';
  const fs = 11 * k;

  const grid: React.ReactNode[] = [];
  if (showGrid) {
    const minor = 100 / k > 9 ? 100 : 500;
    for (let x = 0; x <= W; x += minor) {
      const major = x % 1000 === 0;
      grid.push(<line key={'gx' + x} x1={x} y1={0} x2={x} y2={D} stroke={major ? '#b9bec6' : '#dde0e4'} strokeWidth={major ? 1 : 0.6} vectorEffect="non-scaling-stroke" />);
    }
    for (let y = 0; y <= D; y += minor) {
      const major = y % 1000 === 0;
      grid.push(<line key={'gy' + y} x1={0} y1={y} x2={W} y2={y} stroke={major ? '#b9bec6' : '#dde0e4'} strokeWidth={major ? 1 : 0.6} vectorEffect="non-scaling-stroke" />);
    }
  }

  const aisles: { x: number; y: number; r: number }[] = [];
  const hasWallNear = (test: (w: Wall) => boolean) => walls.some(test);
  if (!hasWallNear((w) => Math.abs(w.y1 - D) < 200 && Math.abs(w.y2 - D) < 200)) aisles.push({ x: W / 2, y: D + 380 * Math.max(1, k * 1.2), r: 0 });
  if (!hasWallNear((w) => w.y1 < 200 && w.y2 < 200)) aisles.push({ x: W / 2, y: -380 * Math.max(1, k * 1.2), r: 0 });
  if (!hasWallNear((w) => w.x1 < 200 && w.x2 < 200)) aisles.push({ x: -380 * Math.max(1, k * 1.2), y: D / 2, r: -90 });
  if (!hasWallNear((w) => Math.abs(w.x1 - W) < 200 && Math.abs(w.x2 - W) < 200)) aisles.push({ x: W + 380 * Math.max(1, k * 1.2), y: D / 2, r: 90 });

  const floorFill = booth.floor.type === 'none' ? '#e6e3dc' : booth.floor.color;
  const dimOff = 260 * Math.max(1, k * 1.5);

  return (
    <g>
      {/* 小間 */}
      <rect x={0} y={0} width={W} height={D} fill="#fff" />
      <rect x={0} y={0} width={W} height={D} fill={floorFill} opacity={0.22} />
      {grid}
      <rect x={0} y={0} width={W} height={D} fill="none" stroke="#2b2f36" strokeWidth={1.2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />

      {aisles.map((a, i) => (
        <text key={i} x={a.x} y={a.y} fontSize={fs * 1.1} fill="#8a9099" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${a.r} ${a.x} ${a.y})`} letterSpacing={fs * 0.6}>
          通路
        </text>
      ))}

      {/* 寸法 */}
      <DimLine x1={0} y1={-dimOff} x2={W} y2={-dimOff} k={k} label={`${fmtMm(W)}`} />
      <DimLine x1={-dimOff} y1={0} x2={-dimOff} y2={D} k={k} label={`${fmtMm(D)}`} vertical />

      {sortedItems(items)
        .filter((it) => layerOf(it) < 2)
        .map((it) => (
          <PlanItem key={it.id} it={it} k={k} selected={selection?.type === 'item' && selection.id === it.id} />
        ))}

      {/* 壁 */}
      {walls.map((w) => (
        <PlanWall key={w.id} w={w} k={k} octa={isOcta} selected={selection?.type === 'wall' && selection.id === w.id} />
      ))}
      {isOcta &&
        octaPostPositions(walls).map((p, i) => (
          <rect key={i} x={p.x - 25} y={p.y - 25} width={50} height={50} fill="#9aa1a9" stroke="#4a5059" strokeWidth={0.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}

      {booth.fascia.enabled && (
        <g pointerEvents="none">
          <line x1={0} y1={D - 75} x2={W} y2={D - 75} stroke="#6a7280" strokeWidth={1} strokeDasharray="10 5" vectorEffect="non-scaling-stroke" />
          <text x={W / 2} y={D - 75 - fs * 0.6} fontSize={fs * 0.9} fill="#6a7280" textAnchor="middle">
            社名板(上部) {booth.fascia.text}
          </text>
        </g>
      )}

      {sortedItems(items)
        .filter((it) => layerOf(it) >= 2)
        .map((it) => (
          <PlanItem key={it.id} it={it} k={k} selected={selection?.type === 'item' && selection.id === it.id} />
        ))}
    </g>
  );
}

function DimLine({ x1, y1, x2, y2, k, label, vertical }: { x1: number; y1: number; x2: number; y2: number; k: number; label: string; vertical?: boolean }) {
  const t = 6 * k;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g pointerEvents="none" stroke="#6a7280" strokeWidth={1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />
      {vertical ? (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} vectorEffect="non-scaling-stroke" />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} vectorEffect="non-scaling-stroke" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} vectorEffect="non-scaling-stroke" />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} vectorEffect="non-scaling-stroke" />
        </>
      )}
      <text
        x={mx}
        y={my}
        fontSize={11 * k}
        fill="#4a5059"
        stroke="#f4f5f7"
        strokeWidth={4 * k}
        paintOrder="stroke"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}
      >
        {label}
      </text>
    </g>
  );
}

function PlanWall({ w, k, octa, selected }: { w: Wall; k: number; octa: boolean; selected: boolean }) {
  const L = wallLen(w);
  const a = (wallAngle(w) * 180) / Math.PI;
  const t = w.thickness;
  const n = wallNormal(w);
  const fill = octa ? '#e4e6e9' : w.color === '#f2f1ec' ? '#d9d6cf' : w.color;
  const mx = (w.x1 + w.x2) / 2;
  const my = (w.y1 + w.y2) / 2;
  const showLen = selected || L / k > 70;
  const la = ((a % 180) + 180) % 180;
  const textRot = la > 90 ? la - 180 : la;
  return (
    <g data-hit="wall" data-id={w.id} style={{ cursor: 'move' }}>
      <g transform={`translate(${w.x1} ${w.y1}) rotate(${a})`}>
        <rect x={0} y={-t / 2} width={L} height={t} fill={fill} stroke={selected ? '#d6581f' : '#2b2f36'} strokeWidth={selected ? 2 : 1} vectorEffect="non-scaling-stroke" />
        {/* 壁面出力の印 */}
        {w.graphicA && <rect x={0} y={t / 2} width={L} height={Math.max(30, 4 * k)} fill="#2f7dd1" opacity={0.85} />}
        {w.graphicB && <rect x={0} y={-t / 2 - Math.max(30, 4 * k)} width={L} height={Math.max(30, 4 * k)} fill="#2f7dd1" opacity={0.85} />}
        {/* 当たり判定を太めに */}
        <rect x={0} y={-Math.max(t, 14 * k) / 2} width={L} height={Math.max(t, 14 * k)} fill="transparent" />
      </g>
      {showLen && (
        <text
          x={mx + n.x * (t / 2 + 14 * k)}
          y={my + n.y * (t / 2 + 14 * k)}
          fontSize={10 * k}
          fill={selected ? '#d6581f' : '#5a616b'}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${textRot} ${mx + n.x * (t / 2 + 14 * k)} ${my + n.y * (t / 2 + 14 * k)})`}
          pointerEvents="none"
        >
          {fmtMm(L)}
        </text>
      )}
    </g>
  );
}

function PlanItem({ it, k, selected }: { it: Item; k: number; selected: boolean }) {
  const def = defOf(it.kind);
  const ceiling = def.mount === 'ceiling';
  const isLight = !!def.light;
  const stroke = selected ? '#d6581f' : ceiling ? '#5f6b7a' : '#3a3f47';
  const base = it.kind === 'model' ? '#bcd3ea' : it.color ?? '#e8e8e6';
  const fill = ceiling ? 'transparent' : isLight ? '#ffe7a3' : base;
  const sw = selected ? 2 : 1;
  const label = itemLabel(it);
  const fs = Math.min(10.5 * k, Math.max(it.w, it.d) / Math.max(4, label.length * 0.75));
  const showLabel = fs / k > 6.5;
  const lum = luminance(fill);
  return (
    <g data-hit="item" data-id={it.id} style={{ cursor: 'move' }} pointerEvents={ceiling ? 'visibleStroke' : undefined}>
      <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`}>
        {def.round ? (
          <ellipse rx={it.w / 2} ry={it.d / 2} fill={fill} fillOpacity={it.kind === 'rug' ? 0.85 : 1} stroke={stroke} strokeWidth={ceiling ? Math.max(sw, 1.5) : sw} strokeDasharray={ceiling ? '8 5' : undefined} vectorEffect="non-scaling-stroke" />
        ) : (
          <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} fill={fill} fillOpacity={it.kind === 'rug' ? 0.85 : 1} stroke={stroke} strokeWidth={ceiling ? Math.max(sw, 1.5) : sw} strokeDasharray={ceiling ? '8 5' : undefined} vectorEffect="non-scaling-stroke" />
        )}
        {ceiling && (
          // 天井物は輪郭のみで選択できるよう、太い透明線を重ねる
          <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} fill="none" stroke="transparent" strokeWidth={10} vectorEffect="non-scaling-stroke" />
        )}
        {/* 正面の向き */}
        {!def.round && it.kind !== 'rug' && it.d > 30 && (
          <line x1={-it.w / 2 + it.w * 0.2} y1={it.d / 2 - Math.min(it.d * 0.12, 6 * k)} x2={it.w / 2 - it.w * 0.2} y2={it.d / 2 - Math.min(it.d * 0.12, 6 * k)} stroke={stroke} strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
        )}
        {it.kind === 'chair' && <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d * 0.18} fill={stroke} opacity={0.4} />}
        {isLight && it.kind === 'arm_spot' && <circle cx={0} cy={it.d / 2 - 40} r={50} fill="#f2b100" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </g>
      {showLabel && !ceiling && (
        <text x={it.x} y={it.y} fontSize={fs} fill={lum < 0.45 ? '#ffffff' : '#262a30'} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
          {label}
        </text>
      )}
      {ceiling && (
        <text x={it.x} y={it.y} fontSize={Math.min(10 * k, it.w / 6)} fill="#5f6b7a" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
          {label}(吊)
        </text>
      )}
    </g>
  );
}

function luminance(hex: string) {
  if (!hex.startsWith('#') || hex.length < 7) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
