import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildEstimate, estimateCsv } from '../lib/estimate';
import { downloadBlob } from '../lib/assets';
import PlanContent from './plan/PlanContent';
import { fmtMm } from '../lib/geom';

/** 印刷する。PDF保存時の既定のファイル名はページのタイトルになるので、印刷の間だけ差し替える */
function printSheet(name: string) {
  const prev = document.title;
  document.title = name.replace(/[\\/:*?"<>|]/g, '_');
  const restore = () => {
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

export default function EstimateModal() {
  const project = useStore((s) => s.project);
  const assets = useStore((s) => s.assets);
  const set = useStore((s) => s.set);
  const mutate = useStore((s) => s.mutate);
  const [shot, setShot] = useState<string | null>(null);
  useEffect(() => {
    useStore
      .getState()
      .capture?.(1.5)
      .then((u) => setShot(u));
  }, []);
  const rows = useMemo(() => buildEstimate(project, assets), [project, assets]);
  const m = project.meta;
  const b = project.booth;
  const today = new Date().toLocaleDateString('ja-JP');

  const groups: { name: string; rows: typeof rows }[] = [];
  rows.forEach((r) => {
    const g = groups.find((x) => x.name === r.group);
    if (g) g.rows.push(r);
    else groups.push({ name: r.group, rows: [r] });
  });

  const pad = 700;
  const vb = `${-pad} ${-pad} ${b.w + pad * 2} ${b.d + pad * 2}`;
  const k = (b.w + pad * 2) / 640;

  return (
    <div className="modal-back" onClick={() => set({ showEstimate: false })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-bar no-print">
          <h2>見積依頼 備品リスト</h2>
          <div className="row">
            <button className="btn" onClick={() => downloadBlob(new Blob([estimateCsv(project, rows)], { type: 'text/csv' }), `${m.title || 'booth'}_備品リスト.csv`)}>
              CSV(Excel)出力
            </button>
            <button className="btn primary" onClick={() => printSheet(`${m.title || 'ブース'}_見積依頼書`)} title="送信先で「PDFに保存」を選ぶとPDFになります">
              印刷 / PDF保存
            </button>
            <button className="btn ghost" onClick={() => set({ showEstimate: false })}>
              閉じる
            </button>
          </div>
        </div>

        <div className="sheet print-area">
          {/* 印刷時は用紙の余白を0にしてブラウザのヘッダー・フッターを出さず、各ページの余白はこの表の上下の行で確保する */}
          <table className="pf-table">
            <thead>
              <tr>
                <td className="pf-gap" />
              </tr>
            </thead>
            <tfoot>
              <tr>
                <td className="pf-gap" />
              </tr>
            </tfoot>
            <tbody>
              <tr>
                <td className="pf-cell">
                  <header className="sheet-head">
                    <div>
                      <h1>展示会ブース 見積依頼書</h1>
                      <p className="sheet-sub">{m.title}</p>
                    </div>
                    <div className="sheet-date">作成日 {today}</div>
                  </header>
                  <table className="meta-table">
                    <tbody>
                      <tr>
                        <th>展示会名</th>
                        <td>{m.exhibition || '—'}</td>
                        <th>会期</th>
                        <td>{m.period || '—'}</td>
                      </tr>
                      <tr>
                        <th>会場</th>
                        <td>{m.venue || '—'}</td>
                        <th>小間番号</th>
                        <td>{m.boothNo || '—'}</td>
                      </tr>
                      <tr>
                        <th>出展社名</th>
                        <td>{m.company || '—'}</td>
                        <th>担当者</th>
                        <td>{m.contact || '—'}</td>
                      </tr>
                      <tr>
                        <th>ブース仕様</th>
                        <td colSpan={3}>
                          {b.style === 'wood' ? '木工ブース' : 'システムブース(オクタノルム)'} / 小間 {fmtMm(b.w)}×{fmtMm(b.d)}mm / 壁高 {fmtMm(b.wallHeight)}mm
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="sheet-figs">
                    {shot && (
                      <figure>
                        <img src={shot} alt="3Dイメージ" />
                        <figcaption>3Dイメージ</figcaption>
                      </figure>
                    )}
                    <figure>
                      <svg viewBox={vb} className="sheet-plan">
                        <rect x={-pad} y={-pad} width={b.w + pad * 2} height={b.d + pad * 2} fill="#fff" />
                        <PlanContent project={project} k={k} showGrid />
                      </svg>
                      <figcaption>平面図(単位 mm)</figcaption>
                    </figure>
                  </div>

                  <table className="est-table">
                    <thead>
                      <tr>
                        <th style={{ width: '4%' }}>No</th>
                        <th style={{ width: '22%' }}>品名</th>
                        <th>仕様・サイズ</th>
                        <th style={{ width: '8%' }}>数量</th>
                        <th style={{ width: '6%' }}>単位</th>
                        <th style={{ width: '22%' }}>備考</th>
                      </tr>
                    </thead>
                    {(() => {
                      let n = 0;
                      return groups.map((g) => (
                        <tbody key={g.name}>
                          <tr className="grp">
                            <td colSpan={6}>{g.name}</td>
                          </tr>
                          {g.rows.map((r, i) => (
                            <tr key={i}>
                              <td className="c">{++n}</td>
                              <td>{r.name}</td>
                              <td>{r.spec}</td>
                              <td className="r">{r.qty}</td>
                              <td className="c">{r.unit}</td>
                              <td className="note">{r.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      ));
                    })()}
                  </table>

                  <div className="memo">
                    <h3>備考・ご依頼事項</h3>
                    <textarea
                      className="no-print"
                      value={m.memo}
                      placeholder="例: 搬入日時、電気容量、予算感、デザイン要望など"
                      onChange={(e) => mutate((p) => void (p.meta.memo = e.target.value), false)}
                    />
                    <p className="print-only memo-print">{m.memo || '—'}</p>
                  </div>
                  <p className="sheet-foot">※ 数量は図面からの自動集計です。施工方法・規格により変わるため、施工会社様にてご確認ください。</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
