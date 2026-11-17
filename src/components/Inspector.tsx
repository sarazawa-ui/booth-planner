import { useRef, useState } from 'react';
import { useStore, useSelectedItem, useSelectedWall } from '../store';
import { CARPET_COLORS, WALL_COLORS, defOf, itemLabel } from '../catalog';
import type { Booth, FloorType, Item, OpenType, Wall } from '../types';
import { ImagePicker, NumField, Section, Seg, Swatches, TextField } from './ui';
import { OPEN_TYPES, fmtMm, normDeg, wallAngle, wallLen } from '../lib/geom';

export default function Inspector() {
  const item = useSelectedItem();
  const wall = useSelectedWall();
  return <aside className="inspector">{item ? <ItemPanel it={item} /> : wall ? <WallPanel w={wall} /> : <BoothPanel />}</aside>;
}

// ---- アイテム ----

function ItemPanel({ it }: { it: Item }) {
  const def = defOf(it.kind);
  const st = useStore();
  const up = (patch: Partial<Item>) => st.updateItem(it.id, patch);
  const isModel = it.kind === 'model';

  const live = (patch: Partial<Item>) => st.updateItem(it.id, patch, false);
  const start = () => st.checkpoint();
  const wallH = useStore((s) => s.project.booth.wallHeight);

  /** 3Dモデルは縦横比を保ったまま拡縮 */
  const sizePatch = (key: 'w' | 'd' | 'h', v: number): Partial<Item> => {
    if (v <= 0) return {};
    if (isModel) {
      const f = v / it[key];
      return { w: Math.round(it.w * f), d: Math.round(it.d * f), h: Math.round(it.h * f) };
    }
    if (def.round && key === 'w') return { w: v, d: v };
    return { [key]: v };
  };
  const can = (k: 'w' | 'd' | 'h') => isModel || !!def.resizable?.includes(k);
  const sizeMax = (k: 'w' | 'd' | 'h') => (isModel ? 6000 : Math.max(1500, Math.ceil((def[k] * 3) / 100) * 100));
  const sizeField = (k: 'w' | 'd' | 'h', label: string, minV: number) => (
    <NumField
      label={label}
      value={it[k]}
      slider
      min={minV}
      max={Math.max(sizeMax(k), it[k])}
      step={10}
      disabled={!can(k)}
      onStart={start}
      onChange={(v) => up(sizePatch(k, v))}
      onLive={(v) => live(sizePatch(k, v))}
    />
  );
  const elevMax = def.mount === 'ceiling' ? Math.max(6000, wallH + 3000) : def.mount === 'wall' ? wallH : Math.max(2000, wallH);

  return (
    <>
      <div className="insp-head">
        <div>
          <small>{isModel ? '持込品(3Dモデル)' : def.name}</small>
          <h2>{itemLabel(it)}</h2>
        </div>
        <div className="row">
          <button className="btn sm" onClick={st.duplicateSelected} title="Ctrl+D">
            複製
          </button>
          <button className="btn sm danger" onClick={st.deleteSelected} title="Delete">
            削除
          </button>
        </div>
      </div>

      <Section title="名称">
        <TextField label="表示名" value={it.label ?? ''} placeholder={def.name} onChange={(v) => up({ label: v || undefined })} />
      </Section>

      <Section title="サイズ">
        {def.sizes && (
          <select
            className="sel"
            value={def.sizes.find((s) => s.w === it.w && s.d === it.d && s.h === it.h)?.label ?? ''}
            onChange={(e) => {
              const s = def.sizes!.find((x) => x.label === e.target.value);
              if (s) up({ w: s.w, d: s.d, h: s.h });
            }}
          >
            <option value="">規格サイズから選ぶ…</option>
            {def.sizes.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <div className="stack">
          {sizeField('w', def.round ? '直径' : '幅 W', 10)}
          {!def.round && sizeField('d', '奥行 D', 1)}
          {sizeField('h', '高さ H', 1)}
        </div>
        {!isModel && !def.resizable?.length && <p className="hint">この品目は規格サイズから選んでください。</p>}
      </Section>

      <Section title="位置・向き">
        <div className="stack">
          <NumField
            label={def.mount === 'wall' || def.mount === 'ceiling' ? '取付高' : def.stack ? '設置高' : '床から'}
            value={it.elev}
            slider
            min={0}
            max={Math.max(elevMax, it.elev)}
            step={10}
            onStart={start}
            onChange={(v) => up({ elev: v })}
            onLive={(v) => live({ elev: v })}
          />
          <NumField label="回転" value={it.rot} unit="°" slider min={0} max={359} step={5} onStart={start} onChange={(v) => up({ rot: normDeg(v) })} onLive={(v) => live({ rot: normDeg(v) })} />
        </div>
        <div className="grid2">
          <NumField label="X(左から)" value={it.x} onStart={start} onChange={(v) => up({ x: v })} onLive={(v) => live({ x: v })} />
          <NumField label="Y(奥から)" value={it.y} onStart={start} onChange={(v) => up({ y: v })} onLive={(v) => live({ y: v })} />
        </div>
        <div className="row rot-row">
          <button className="btn sm" onClick={() => up({ rot: normDeg(it.rot - 90) })}>
            左90°
          </button>
          <button className="btn sm" onClick={() => up({ rot: normDeg(it.rot + 90) })}>
            右90°
          </button>
        </div>
        {def.mount === 'wall' && <p className="hint">壁の近くへドラッグすると壁面に吸着します(Altキーで解除)。</p>}
        {def.stack && <p className="hint">展示台・テーブル・カウンターの上へドラッグすると天板の高さに自動で載ります(Altキーで解除)。台を選んだ状態で一覧から追加すると、その上に置かれます。</p>}
        <p className="hint">▲▼は長押しで連続変化、Shift+クリックで10倍刻み。</p>
      </Section>

      {def.colors && (
        <Section title="色">
          <Swatches colors={def.colors} value={it.color} onChange={(c) => up({ color: c })} />
        </Section>
      )}

      {def.text !== undefined && (
        <Section title="文字">
          <TextField label="表示文字" value={it.text ?? ''} onChange={(v) => up({ text: v })} />
          <div className="field-row">
            <span>文字色</span>
            <input type="color" value={it.textColor ?? '#1f2a44'} onChange={(e) => up({ textColor: e.target.value })} />
          </div>
        </Section>
      )}

      {def.graphic && (
        <Section title={def.graphicTitle ?? (it.kind === 'cutout' ? 'ロゴ画像(透過PNG推奨)' : it.kind.startsWith('monitor') ? '画面に表示する画像' : '貼付グラフィック')}>
          <ImagePicker label="画像" value={it.graphic} onChange={(g) => up({ graphic: g })} sizeHint={`仕上り ${fmtMm(it.w)}×${fmtMm(it.h)}`} />
        </Section>
      )}

      {def.light && it.light && (
        <Section title="照明">
          <label className="check">
            <input type="checkbox" checked={it.light.on} onChange={(e) => up({ light: { ...it.light!, on: e.target.checked } })} />
            点灯
          </label>
          <label className="slider">
            <span>明るさ</span>
            <input type="range" min={0.1} max={2.5} step={0.05} value={it.light.intensity} onChange={(e) => st.updateItem(it.id, { light: { ...it.light!, intensity: Number(e.target.value) } }, false)} onPointerDown={() => st.checkpoint()} />
          </label>
          {it.kind !== 'led_bar' && (
            <label className="slider">
              <span>照射角 {it.light.angle}°</span>
              <input type="range" min={10} max={120} step={1} value={it.light.angle} onChange={(e) => st.updateItem(it.id, { light: { ...it.light!, angle: Number(e.target.value) } }, false)} onPointerDown={() => st.checkpoint()} />
            </label>
          )}
          <Seg
            small
            value={String(it.light.kelvin)}
            options={[
              { id: '2700', name: '電球色' },
              { id: '3500', name: '温白色' },
              { id: '4000', name: '白色' },
              { id: '5000', name: '昼白色' },
              { id: '6500', name: '昼光色' },
            ]}
            onChange={(k) => up({ light: { ...it.light!, kelvin: Number(k) } })}
          />
          <p className="hint">消費電力 {def.light.watt}W(見積の電気容量に反映)</p>
        </Section>
      )}

      {isModel && it.model && (
        <Section title="3Dデータ">
          <div className="field-row">
            <span>データの単位</span>
            <select
              className="sel"
              value={String(it.model.unit)}
              onChange={(e) => {
                const unit = Number(e.target.value);
                const f = unit / it.model!.unit;
                up({ model: { ...it.model!, unit }, w: Math.round(it.w * f), d: Math.round(it.d * f), h: Math.round(it.h * f) });
              }}
            >
              <option value="1">mm</option>
              <option value="10">cm</option>
              <option value="1000">m</option>
              <option value="25.4">inch</option>
            </select>
          </div>
          <div className="field-row">
            <span>上方向</span>
            <Seg
              small
              value={it.model.upAxis}
              options={[
                { id: 'y', name: 'Y-up' },
                { id: 'z', name: 'Z-up' },
              ]}
              onChange={(upAxis) => {
                // 軸を入れ替えたら高さと奥行を入れ替える
                up({ model: { ...it.model!, upAxis }, h: it.d, d: it.h });
              }}
            />
          </div>
          <p className="hint">寸法を変えると縦横比を保って拡縮します。向きが寝ている場合は「上方向」を切り替えてください。</p>
        </Section>
      )}

      <Section title="見積備考">
        <TextField label="備考" value={it.note ?? ''} placeholder="例: 天板のみ木目" onChange={(v) => up({ note: v || undefined })} />
      </Section>
    </>
  );
}

// ---- 壁 ----

function WallPanel({ w }: { w: Wall }) {
  const st = useStore();
  const style = useStore((s) => s.project.booth.style);
  const up = (patch: Partial<Wall>) => st.updateWall(w.id, patch);
  const L = wallLen(w);
  const setLen = (v: number, history = true) => {
    const a = wallAngle(w);
    st.updateWall(w.id, { x2: Math.round(w.x1 + Math.cos(a) * v), y2: Math.round(w.y1 + Math.sin(a) * v) }, history);
  };
  const idx = useStore((s) => s.project.walls.findIndex((x) => x.id === w.id));
  return (
    <>
      <div className="insp-head">
        <div>
          <small>{style === 'wood' ? '木工壁' : 'システムパネル壁'}</small>
          <h2>壁 {idx + 1}</h2>
        </div>
        <div className="row">
          <button className="btn sm" onClick={st.duplicateSelected}>
            複製
          </button>
          <button className="btn sm danger" onClick={st.deleteSelected}>
            削除
          </button>
        </div>
      </div>
      <Section title="寸法">
        <div className="stack">
          <NumField label="長さ" value={Math.round(L)} slider min={100} max={Math.max(12000, Math.round(L))} step={10} onStart={st.checkpoint} onChange={setLen} onLive={(v) => setLen(v, false)} />
          <NumField label="高さ" value={w.height} slider min={300} max={6000} step={10} onStart={st.checkpoint} onChange={(v) => up({ height: v })} onLive={(v) => st.updateWall(w.id, { height: v }, false)} />
          <NumField label="厚み" value={w.thickness} slider min={20} max={600} step={5} disabled={style === 'octanorm'} onStart={st.checkpoint} onChange={(v) => up({ thickness: v })} onLive={(v) => st.updateWall(w.id, { thickness: v }, false)} />
        </div>
        {style === 'octanorm' && <p className="hint">支柱は1,000mmピッチで自動配置。端数は特寸パネルとして見積に計上します。</p>}
      </Section>
      <Section title={style === 'wood' ? '仕上げ' : 'パネル色'}>
        {style === 'wood' && (
          <Seg
            small
            value={w.finish}
            options={[
              { id: 'paint', name: '塗装・クロス' },
              { id: 'woodgrain', name: '木目シート' },
            ]}
            onChange={(finish) => up({ finish })}
          />
        )}
        {(style === 'octanorm' || w.finish === 'paint') && <Swatches colors={WALL_COLORS} value={w.color} onChange={(c) => up({ color: c })} />}
        <button className="btn sm ghost" onClick={() => st.mutate((p) => p.walls.forEach((x) => ((x.color = w.color), (x.finish = w.finish))))}>
          全ての壁に適用
        </button>
      </Section>
      <Section title="壁面全面出力">
        <ImagePicker label="A面(矢印側・プリセットでは小間の内側)" value={w.graphicA} onChange={(g) => up({ graphicA: g })} sizeHint={`${fmtMm(L)}×${fmtMm(w.height)}`} />
        <ImagePicker label="B面(裏側)" value={w.graphicB} onChange={(g) => up({ graphicB: g })} sizeHint={`${fmtMm(L)}×${fmtMm(w.height)}`} />
        <button
          className="btn sm ghost"
          onClick={() => up({ x1: w.x2, y1: w.y2, x2: w.x1, y2: w.y1, graphicA: w.graphicB, graphicB: w.graphicA })}
        >
          表裏を入れ替える
        </button>
      </Section>
    </>
  );
}

// ---- 小間 ----

const BOOTH_PRESETS = [
  { name: '1小間 3×3m', w: 2970, d: 2970 },
  { name: '2小間 6×3m', w: 5940, d: 2970 },
  { name: '3小間 9×3m', w: 8910, d: 2970 },
  { name: '4小間 6×6m', w: 5940, d: 5940 },
  { name: '6小間 9×6m', w: 8910, d: 5940 },
  { name: '9小間 9×9m', w: 8910, d: 8910 },
];

const CUSTOM_SIZE = 'custom';
/** 小間の間口・奥行の入力上限 */
const BOOTH_MAX = 60000;

function BoothPanel() {
  const st = useStore();
  const p = useStore((s) => s.project);
  const b = p.booth;
  const setB = (patch: Partial<Booth>, regen = false) => st.setBooth(patch, regen);
  const meta = (k: keyof typeof p.meta) => (v: string) => st.mutate((pp) => void (pp.meta[k] = v));
  // 規格と同じ寸法でも「カスタム」を選んだ間は表示を保つ
  const [customPicked, setCustomPicked] = useState(false);
  const sizeBox = useRef<HTMLDivElement>(null);
  const preset = customPicked ? undefined : BOOTH_PRESETS.find((x) => x.w === b.w && x.d === b.d);
  const pickSize = (name: string) => {
    if (name === CUSTOM_SIZE) {
      setCustomPicked(true);
      sizeBox.current?.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
      return;
    }
    const pr = BOOTH_PRESETS.find((x) => x.name === name);
    if (pr && confirm('小間サイズを変更し、壁を作り直します。よろしいですか?')) {
      setCustomPicked(false);
      setB({ w: pr.w, d: pr.d }, true);
    }
  };
  return (
    <>
      <div className="insp-head">
        <div>
          <small>何も選択していません</small>
          <h2>ブース設定</h2>
        </div>
      </div>

      <Section title="小間">
        <select className="sel" aria-label="小間サイズ" value={preset?.name ?? CUSTOM_SIZE} onChange={(e) => pickSize(e.target.value)}>
          {BOOTH_PRESETS.map((x) => (
            <option key={x.name}>{x.name}</option>
          ))}
          <option value={CUSTOM_SIZE}>カスタムサイズ(寸法を入力)</option>
        </select>
        <div className="stack" ref={sizeBox}>
          <NumField label="間口" value={b.w} slider min={1000} max={BOOTH_MAX} sliderMax={Math.max(18000, b.w)} step={10} onStart={st.checkpoint} onChange={(v) => setB({ w: v })} onLive={(v) => st.setBooth({ w: v }, false, false)} />
          <NumField label="奥行" value={b.d} slider min={1000} max={BOOTH_MAX} sliderMax={Math.max(18000, b.d)} step={10} onStart={st.checkpoint} onChange={(v) => setB({ d: v })} onLive={(v) => st.setBooth({ d: v }, false, false)} />
          <p className="hint">
            {(b.w / 1000).toFixed(2)}m × {(b.d / 1000).toFixed(2)}m({((b.w * b.d) / 1e6).toFixed(2)}㎡)。間口・奥行は1〜60mで入力でき、壁も追従します。
          </p>
          <NumField label="壁高" value={b.wallHeight} slider min={900} max={6000} step={10} onStart={st.checkpoint} onChange={(v) => setB({ wallHeight: v })} onLive={(v) => st.setBooth({ wallHeight: v }, false, false)} />
        </div>
        <div className="open-types">
          {OPEN_TYPES.map((o) => (
            <button
              key={o.id}
              className={'open-type' + (o.id === b.open ? ' on' : '')}
              onClick={() => {
                if (p.walls.length && !confirm(`「${o.name}」に合わせて壁を作り直します。手で描いた壁や壁面出力は消えます。よろしいですか?`)) return;
                setB({ open: o.id as OpenType }, true);
              }}
            >
              <OpenTypeIcon t={o.id} />
              <b>{o.name}</b>
              <small>{o.desc}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section title="床">
        <Seg<FloorType>
          small
          value={b.floor.type}
          options={[
            { id: 'punch', name: 'パンチ' },
            { id: 'tile', name: 'タイル' },
            { id: 'flooring', name: 'フローリング調' },
            { id: 'none', name: 'なし' },
          ]}
          onChange={(type) => setB({ floor: { ...b.floor, type } })}
        />
        {(b.floor.type === 'punch' || b.floor.type === 'tile') && <Swatches colors={CARPET_COLORS} value={b.floor.color} onChange={(c) => setB({ floor: { ...b.floor, color: c } })} />}
        <label className="check">
          <input type="checkbox" checked={b.floor.raised} onChange={(e) => setB({ floor: { ...b.floor, raised: e.target.checked } })} />
          床上げ(システム床 H50)
        </label>
      </Section>

      <Section title="社名板">
        <label className="check">
          <input type="checkbox" checked={b.fascia.enabled} onChange={(e) => setB({ fascia: { ...b.fascia, enabled: e.target.checked } })} />
          前面上部に社名板を付ける
        </label>
        {b.fascia.enabled && (
          <>
            <TextField label="表示文字" value={b.fascia.text} onChange={(v) => setB({ fascia: { ...b.fascia, text: v } })} />
            <div className="grid3">
              <NumField label="高さ" value={b.fascia.height} step={10} onStart={st.checkpoint} onChange={(v) => setB({ fascia: { ...b.fascia, height: v } })} onLive={(v) => st.setBooth({ fascia: { ...b.fascia, height: v } }, false, false)} min={150} max={1200} />
              <div className="field-row">
                <span>地色</span>
                <input type="color" value={b.fascia.bg} onChange={(e) => setB({ fascia: { ...b.fascia, bg: e.target.value } })} />
              </div>
              <div className="field-row">
                <span>文字</span>
                <input type="color" value={b.fascia.fg} onChange={(e) => setB({ fascia: { ...b.fascia, fg: e.target.value } })} />
              </div>
            </div>
            <ImagePicker label="ロゴ(文字の左に表示)" value={b.fascia.logo} onChange={(g) => setB({ fascia: { ...b.fascia, logo: g } })} />
          </>
        )}
      </Section>

      <Section title="案件情報(見積依頼書に記載)">
        <TextField label="案件名" value={p.meta.title} onChange={meta('title')} />
        <TextField label="展示会名" value={p.meta.exhibition} onChange={meta('exhibition')} />
        <TextField label="会期" value={p.meta.period} placeholder="2027/2/10〜2/12" onChange={meta('period')} />
        <TextField label="会場" value={p.meta.venue} onChange={meta('venue')} />
        <TextField label="小間番号" value={p.meta.boothNo} onChange={meta('boothNo')} />
        <TextField label="出展社名" value={p.meta.company} onChange={meta('company')} />
        <TextField label="担当者" value={p.meta.contact} onChange={meta('contact')} />
      </Section>

      <p className="hint pad">
        床をクリックすると選択解除。図面上でアイテム/壁をクリックすると詳細を編集できます。
        <br />
        ショートカット: Delete 削除 / R 回転 / Ctrl+D 複製 / Ctrl+Z 元に戻す / 矢印キー 移動(Shiftで100mm)
      </p>
      <p className="hint pad">壁 {p.walls.length} 面 ・ 配置物 {p.items.length} 点 ・ 小間 {fmtMm(b.w)}×{fmtMm(b.d)}</p>
    </>
  );
}

function OpenTypeIcon({ t }: { t: OpenType }) {
  const walls: Record<OpenType, string> = {
    one: 'M4 18V4h16v14',
    corner: 'M4 18V4h16',
    three: 'M4 4h16',
    island: '',
  };
  return (
    <svg width="40" height="28" viewBox="0 0 24 22">
      <rect x="4" y="4" width="16" height="14" fill="none" stroke="#b5bac2" strokeDasharray="2 1.5" />
      {walls[t] && <path d={walls[t]} fill="none" stroke="#2b2f36" strokeWidth="2.2" />}
    </svg>
  );
}
