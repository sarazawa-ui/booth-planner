import { useEffect, useRef, useState } from 'react';
import type { Fit, Graphic } from '../types';
import { useStore } from '../store';
import { importImageAsset } from '../lib/importer';

export function NumField({
  label,
  value,
  onChange,
  onLive,
  onStart,
  min,
  max,
  step = 10,
  unit = 'mm',
  disabled,
  slider,
}: {
  label: string;
  value: number;
  /** 確定(履歴に残る変更) */
  onChange: (v: number) => void;
  /** ドラッグ・長押し中の連続変更(履歴に残さない)。未指定なら onChange を使う */
  onLive?: (v: number) => void;
  /** 連続変更の開始時(Undo用の区切り) */
  onStart?: () => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  /** スライダーを表示する(min/max 必須) */
  slider?: boolean;
}) {
  const [txt, setTxt] = useState(fmt(value));
  const focused = useRef(false);
  const valRef = useRef(value);
  valRef.current = value;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!focused.current) setTxt(fmt(value));
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const clamp = (v: number) => {
    let c = v;
    if (min !== undefined) c = Math.max(min, c);
    if (max !== undefined) c = Math.min(max, c);
    return Math.round(c * 100) / 100;
  };
  const live = (v: number) => (onLive ?? onChange)(clamp(v));
  const commit = () => {
    const v = Number(txt.replace(/,/g, ''));
    if (!Number.isFinite(v)) {
      setTxt(fmt(value));
      return;
    }
    const c = clamp(v);
    if (c !== value) onChange(c);
    setTxt(fmt(c));
  };

  // ▲▼ 長押しで連続変化(だんだん速く)
  const press = (dir: 1 | -1, e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s = step * (e.shiftKey ? 10 : 1) * dir;
    onStart?.();
    const snapTo = (v: number) => Math.round(v / Math.abs(s)) * Math.abs(s);
    live(snapTo(valRef.current + s));
    let n = 0;
    const tick = () => {
      n++;
      const mul = n > 25 ? 5 : n > 10 ? 2 : 1;
      live(snapTo(valRef.current + s * mul));
      timer.current = window.setTimeout(tick, 60);
    };
    timer.current = window.setTimeout(tick, 380);
  };
  const release = () => clearTimeout(timer.current);

  const box = (
    <div className={'num-box' + (disabled ? ' disabled' : '')}>
      <input
        type="number"
        value={txt}
        step={step}
        disabled={disabled}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => {
          setTxt(e.target.value);
          // キーボードの↑↓は即時反映
          const ne = e.nativeEvent as InputEvent;
          if (!ne.inputType) {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(clamp(v));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <em>{unit}</em>
      <span className="stepper">
        <button type="button" tabIndex={-1} title={`+${step}(Shiftで×10)`} onPointerDown={(e) => press(1, e)} onPointerUp={release} onPointerCancel={release} disabled={disabled}>
          <svg width="8" height="5" viewBox="0 0 8 5"><path d="M0 5L4 0L8 5z" fill="currentColor" /></svg>
        </button>
        <button type="button" tabIndex={-1} title={`-${step}(Shiftで×10)`} onPointerDown={(e) => press(-1, e)} onPointerUp={release} onPointerCancel={release} disabled={disabled}>
          <svg width="8" height="5" viewBox="0 0 8 5"><path d="M0 0L4 5L8 0z" fill="currentColor" /></svg>
        </button>
      </span>
    </div>
  );

  if (slider && min !== undefined && max !== undefined) {
    return (
      <div className={'num wide' + (disabled ? ' disabled' : '')}>
        <span>{label}</span>
        <input
          type="range"
          className="num-range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          disabled={disabled}
          onPointerDown={() => onStart?.()}
          onKeyDown={() => onStart?.()}
          onChange={(e) => live(Number(e.target.value))}
        />
        {box}
      </div>
    );
  }
  return (
    <div className="num">
      <span>{label}</span>
      {box}
    </div>
  );
}

function fmt(v: number) {
  return String(Math.round(v * 100) / 100);
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [txt, setTxt] = useState(value);
  useEffect(() => setTxt(value), [value]);
  return (
    <label className="txt">
      <span>{label}</span>
      <input
        value={txt}
        placeholder={placeholder}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => txt !== value && onChange(txt)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export function Swatches({ colors, value, onChange }: { colors: { name: string; hex: string }[]; value?: string; onChange: (hex: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c.hex}
          title={c.name}
          className={value?.toLowerCase() === c.hex.toLowerCase() ? 'on' : ''}
          style={{ background: c.hex }}
          onClick={() => onChange(c.hex)}
        />
      ))}
      <label className="swatch-custom" title="任意の色">
        <input type="color" value={value ?? '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, small }: { value: T; options: { id: T; name: string }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={'seg' + (small ? ' small' : '')}>
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

const FITS: { id: Fit; name: string }[] = [
  { id: 'cover', name: '全面(切抜)' },
  { id: 'contain', name: '全体表示' },
  { id: 'stretch', name: '伸縮' },
];

/** 画像の貼付・差替・解除 */
export function ImagePicker({ label, value, onChange, sizeHint }: { label: string; value: Graphic | null | undefined; onChange: (g: Graphic | null) => void; sizeHint?: string }) {
  const asset = useStore((s) => (value ? s.assets[value.assetId] : undefined));
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { asset } = await importImageAsset(f);
      onChange({ assetId: asset.id, fit: value?.fit ?? 'cover' });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div
      className="imgpick"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        pick(e.dataTransfer.files[0]);
      }}
    >
      <div className="imgpick-head">
        <span>{label}</span>
        {sizeHint && <em>{sizeHint}</em>}
      </div>
      {asset ? (
        <div className="imgpick-body">
          <img src={asset.url} alt="" />
          <div className="imgpick-actions">
            <div className="imgpick-name" title={asset.name}>
              {asset.name}
            </div>
            <Seg small value={value!.fit} options={FITS} onChange={(fit) => onChange({ ...value!, fit })} />
            <div className="row">
              <button className="btn sm" onClick={() => ref.current?.click()}>
                差し替え
              </button>
              <button className="btn sm ghost" onClick={() => onChange(null)}>
                外す
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button className="imgpick-empty" onClick={() => ref.current?.click()}>
          画像を選択、またはここへドロップ
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="sec">
      <h3>
        {title}
        {right}
      </h3>
      {children}
    </section>
  );
}

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}
