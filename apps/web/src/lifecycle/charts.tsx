import { formatSen, formatSenSigned, type LifecycleChange, type LifecycleLevel, type LifecycleUse } from '@nihon-no-yosan/core';

/**
 * 予算の一生のグラフ（SVG）。色は、段階の額 = 青（1 系列）、増減 = 増は橙・減は青（一覧の増減の色と同じ）、現額の使われ方 = 3 色（水色・黄・桃）。
 * 原因が分かっていない差は、灰色の破線の枠。値は直接ラベルで示し、同じ値は詳細の表（幅広の形・長い形）にある。
 */
const BLUE = 'fill-[#2a78d6] dark:fill-[#3987e5]';
const ORANGE = 'fill-[#eb6834] dark:fill-[#d95926]';
const USE_FILL = { spent: 'bg-[#1baf7a] dark:bg-[#199e70]', carryover_out: 'bg-[#eda100] dark:bg-[#c98500]', unused: 'bg-[#e87ba4] dark:bg-[#d55181]' } as const;
const sen = (yen: number): string => formatSen(yen / 1000);
const senSigned = (yen: number): string => formatSenSigned(yen / 1000);
const ink = 'fill-neutral-800 dark:fill-neutral-100';
const muted = 'fill-neutral-500';

/** 長い名前を 2 行に分ける（5 文字ごと） */
const lines = (s: string): string[] => (s.length <= 6 ? [s] : [s.slice(0, Math.ceil(s.length / 2)), s.slice(Math.ceil(s.length / 2))]);

/**
 * 段階ごとの額（柱）。ゼロを基準に、値を柱の上に直接書く。観測した値だけを柱にする。
 * 値の無い段階（`yen` = null）は、柱の代わりに「—」を置く（0 ではない。補完しない）。段階の間を結ぶ線は引かない（対応関係を線で表さない）。
 */
export function LevelsChart({ levels, caption }: { levels: readonly LifecycleLevel[]; caption?: string }) {
  const W = 560, H = 190, top = 26, bottom = 44, left = 10, right = 10;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...levels.map(l => l.yen ?? 0));
  const slot = (W - left - right) / Math.max(1, levels.length);
  const bar = Math.min(44, slot * 0.6);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`段階ごとの額: ${levels.map(l => `${l.label} ${l.yen === null ? '値なし' : sen(l.yen)}`).join('、')}`} className="block h-auto w-full">
        <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} className="stroke-neutral-300 dark:stroke-neutral-600" />
        {levels.map((l, i) => {
          const x = left + slot * i + (slot - bar) / 2;
          const names = lines(l.label).map((t, k) => (
            <text key={k} x={x + bar / 2} y={H - bottom + 14 + k * 12} textAnchor="middle" className={`${muted} text-[10px]`}>{t}</text>
          ));
          if (l.yen === null) {
            return (
              <g key={`${l.stage}-${l.key}`}>
                <title>{`${l.label}: 値なし（0 ではない）`}</title>
                <text x={x + bar / 2} y={H - bottom - 8} textAnchor="middle" className={`${muted} text-[13px]`}>—</text>
                {names}
              </g>
            );
          }
          const h = l.yen > 0 ? Math.max(2, (l.yen / max) * plotH) : 0;
          return (
            <g key={`${l.stage}-${l.key}`}>
              <title>{`${l.label}: ${l.yen.toLocaleString('ja-JP')} 円`}</title>
              <rect x={x} y={H - bottom - h} width={bar} height={h} rx={4} className={BLUE} />
              <rect x={x} y={H - bottom - Math.min(h, 4)} width={bar} height={Math.min(h, 4)} className={BLUE} />
              <text x={x + bar / 2} y={H - bottom - h - 6} textAnchor="middle" className={`${ink} text-[11px] font-semibold tabular-nums`}>{sen(l.yen)}</text>
              {names}
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="text-[11px] text-neutral-500">{caption}</figcaption>}
    </figure>
  );
}

/** 段階ごとの増減（横の棒。0 を中心に、増は右・減は左）。値と、基準の額に対する割合を書く */
export function ChangesChart({ changes, zero, base, baseLabel }: { changes: readonly LifecycleChange[]; zero: readonly string[]; base: number | null; baseLabel: string }) {
  const W = 560, rowH = 34, top = 6, labelW = 170, valueW = 130;
  const plotW = W - labelW - valueW;
  const mid = labelW + plotW / 2;
  const max = Math.max(1, ...changes.map(c => Math.abs(c.yen)));
  const H = top + rowH * Math.max(1, changes.length) + 6;
  return (
    <figure className="m-0">
      {changes.length === 0 ? (
        <p className="text-[11px] text-neutral-500">増減はありません{zero.length > 0 ? `（${zero.join('・')}は 0）` : ''}。</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`段階ごとの増減: ${changes.map(c => `${c.label} ${senSigned(c.yen)}`).join('、')}`} className="block h-auto w-full">
          <line x1={mid} x2={mid} y1={top} y2={H - 6} className="stroke-neutral-300 dark:stroke-neutral-600" />
          {changes.map((c, i) => {
            const y = top + rowH * i;
            const w = Math.max(2, (Math.abs(c.yen) / max) * (plotW / 2 - 4));
            const x = c.yen >= 0 ? mid : mid - w;
            return (
              <g key={c.key}>
                <title>{`${c.label}: ${c.yen.toLocaleString('ja-JP')} 円。${c.note}`}</title>
                {lines(c.label).map((t, k, all) => (
                  <text key={k} x={labelW - 8} y={y + rowH / 2 + 4 + (k - (all.length - 1) / 2) * 12} textAnchor="end" className={`${ink} text-[11px]`}>{t}</text>
                ))}
                {c.unexplained ? (
                  <rect x={x} y={y + 7} width={w} height={rowH - 14} rx={4} className="fill-neutral-200 stroke-neutral-500 dark:fill-neutral-700" strokeDasharray="4 3" strokeWidth={1.5} />
                ) : (
                  <rect x={x} y={y + 7} width={w} height={rowH - 14} rx={4} className={c.yen >= 0 ? ORANGE : BLUE} />
                )}
                <text x={W - 4} y={y + rowH / 2 - 1} textAnchor="end" className={`${ink} text-[11px] font-semibold tabular-nums`}>{senSigned(c.yen)}</text>
                {base ? <text x={W - 4} y={y + rowH / 2 + 12} textAnchor="end" className={`${muted} text-[10px] tabular-nums`}>{`${baseLabel}比 ${c.yen >= 0 ? '+' : ''}${((c.yen / base) * 100).toFixed(2)}%`}</text> : null}
              </g>
            );
          })}
        </svg>
      )}
      {changes.length > 0 && zero.length > 0 && <figcaption className="text-[11px] text-neutral-500">0 のため省略: {zero.join('・')}</figcaption>}
    </figure>
  );
}

/** 現額の使われ方（支出済・翌年度繰越・不用）。1 本の帯を、2px の間を空けて分ける。凡例に値と割合 */
export function UseChart({ parts, total }: { parts: readonly LifecycleUse[]; total: number }) {
  const sum = Math.max(1, total);
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div role="img" aria-label={`現額の使われ方: ${parts.map(p => `${p.label} ${sen(p.yen)}`).join('、')}`} className="flex h-5 w-full gap-0.5 overflow-hidden rounded">
        {parts.filter(p => p.yen > 0).map(p => (
          <div key={p.key} title={`${p.label}: ${p.yen.toLocaleString('ja-JP')} 円`} className={`${USE_FILL[p.key]} min-w-[2px] rounded-sm`} style={{ flexGrow: p.yen }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {parts.map(p => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${USE_FILL[p.key]}`} />
            <span>{p.label}</span>
            <span className="tabular-nums text-neutral-500">{sen(p.yen)}（{((p.yen / sum) * 100).toFixed(1)}%）</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** 年度推移の系列。色は段階ごとに固定（概算要求 = 青、政府案 = 橙、補正後 = 水色、決算 = 黄。パレットの検証済みの 1〜4 番）。色だけに頼らず、印の形も変える（円・四角・ひし形・三角） */
export const TREND_SERIES = [
  { key: 'request', label: '概算要求', stroke: 'stroke-[#2a78d6] dark:stroke-[#3987e5]', fill: 'fill-[#2a78d6] dark:fill-[#3987e5]', shape: 'circle' },
  { key: 'budget', label: '政府案', stroke: 'stroke-[#eb6834] dark:stroke-[#d95926]', fill: 'fill-[#eb6834] dark:fill-[#d95926]', shape: 'square' },
  { key: 'revised', label: '補正後', stroke: 'stroke-[#1baf7a] dark:stroke-[#199e70]', fill: 'fill-[#1baf7a] dark:fill-[#199e70]', shape: 'diamond' },
  { key: 'spent', label: '決算（支出済）', stroke: 'stroke-[#eda100] dark:stroke-[#c98500]', fill: 'fill-[#eda100] dark:fill-[#c98500]', shape: 'triangle' },
] as const;
export type TrendSeriesKey = (typeof TREND_SERIES)[number]['key'];
export type TrendPoint = { year: number } & Record<TrendSeriesKey, number | undefined>;

function Mark({ shape, x, y, className }: { shape: (typeof TREND_SERIES)[number]['shape']; x: number; y: number; className: string }) {
  const r = 4.5;
  const common = { className: `${className} stroke-white dark:stroke-neutral-900`, strokeWidth: 1.5 };
  if (shape === 'circle') return <circle cx={x} cy={y} r={r} {...common} />;
  if (shape === 'square') return <rect x={x - r + 0.5} y={y - r + 0.5} width={2 * r - 1} height={2 * r - 1} rx={1} {...common} />;
  if (shape === 'diamond') return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} {...common} />;
  return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} {...common} />;
}

/**
 * 項の年度推移（折れ線）。横軸は、確定した対応でたどれた年度（連続）、縦軸は円（0 から。1 本の軸）。値が無い年度は、線をつながず（補間しない）、印も置かない。
 * 印は 1 つずつ、値をツールチップ（title）に持つ。線の太さは 2px。選んだ年度は、縦の破線。年度の列（横軸の年と、その上の帯）を押すと、その年度に移る（`onSelect`）。
 */
export function TrendChart({ points, current, onSelect, series }: { points: readonly TrendPoint[]; current: number; onSelect?: (year: number) => void; /** 描く系列。省略すると 4 つすべて（事項は決算が無いので、決算を除く） */ series?: readonly TrendSeriesKey[] }) {
  const shown = TREND_SERIES.filter(s => !series || series.includes(s.key));
  const W = 560, H = 230, top = 12, bottom = 30, left = 74, right = 14;
  const plotW = W - left - right, plotH = H - top - bottom;
  const max = Math.max(1, ...points.flatMap(p => shown.map(s => p[s.key] ?? 0)));
  const x = (i: number): number => (points.length === 1 ? left + plotW / 2 : left + (plotW * i) / (points.length - 1));
  const y = (v: number): number => top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const curIdx = points.findIndex(p => p.year === current);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`年度推移: ${shown.map(s => `${s.label} ${points.map(p => `${p.year}年度 ${p[s.key] === undefined ? '値なし' : sen(p[s.key]!)}`).join('、')}`).join('。')}`} className="block h-auto w-full">
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} className="stroke-neutral-200 dark:stroke-neutral-700" />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" className={`${muted} text-[10px] tabular-nums`}>{t === 0 ? '0' : sen(t)}</text>
          </g>
        ))}
        {curIdx >= 0 && <line x1={x(curIdx)} x2={x(curIdx)} y1={top} y2={H - bottom} strokeDasharray="4 3" className="stroke-neutral-400" />}
        {onSelect && points.map((p, i) => {
          const colW = points.length === 1 ? plotW : plotW / (points.length - 1);
          return (
            <g key={`pick-${p.year}`} role="button" tabIndex={0} aria-label={`${p.year}年度を開く`} className="cursor-pointer outline-none [&:focus-visible>rect]:fill-emerald-500/20 [&:hover>rect]:fill-neutral-500/10" onClick={() => onSelect(p.year)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.year); } }}>
              <title>{`${p.year}年度を開く`}</title>
              <rect x={x(i) - colW / 2} y={top} width={colW} height={H - top} fill="transparent" />
            </g>
          );
        })}
        {points.map((p, i) => (
          <text key={p.year} x={x(i)} y={H - bottom + 16} textAnchor="middle" className={`pointer-events-none ${p.year === current ? ink : muted} text-[10px] ${p.year === current ? 'font-semibold' : ''}`}>{points.length > 7 ? `'${String(p.year).slice(2)}` : p.year}</text>
        ))}
        {shown.map(s => {
          // 値のある年度が続く区間ごとに線を引く（値の無い年度をまたいで結ばない）
          const runs: number[][] = [];
          points.forEach((p, i) => { if (p[s.key] === undefined) return; const last = runs[runs.length - 1]; if (last && last[last.length - 1] === i - 1) last.push(i); else runs.push([i]); });
          return (
            <g key={s.key}>
              {runs.filter(r => r.length > 1).map(r => <polyline key={r[0]} points={r.map(i => `${x(i)},${y(points[i]![s.key]!)}`).join(' ')} fill="none" strokeWidth={2} strokeLinejoin="round" className={s.stroke} />)}
              {points.map((p, i) => (p[s.key] === undefined ? null : (
                <g key={p.year}>
                  <title>{`${p.year}年度 ${s.label}: ${p[s.key]!.toLocaleString('ja-JP')} 円`}</title>
                  <circle cx={x(i)} cy={y(p[s.key]!)} r={10} fill="transparent" />
                  <Mark shape={s.shape} x={x(i)} y={y(p[s.key]!)} className={s.fill} />
                </g>
              )))}
            </g>
          );
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {shown.map(s => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="16" height="12" aria-hidden="true"><line x1="0" x2="16" y1="6" y2="6" strokeWidth={2} className={s.stroke} /><Mark shape={s.shape} x={8} y={6} className={s.fill} /></svg>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
