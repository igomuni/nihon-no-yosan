import { formatSen } from '@nihon-no-yosan/core';

/**
 * 年度推移のグラフ（SVG）。項・事項・目・RS の詳細で使う。値は直接ラベルで示し、同じ値は詳細の表にある。
 */
const sen = (yen: number): string => formatSen(yen / 1000);
const ink = 'fill-neutral-800 dark:fill-neutral-100';
const muted = 'fill-neutral-500';

/** 年度推移の系列。色は段階ごとに固定（概算要求 = 青、政府案 = 橙、補正後 = 水色、決算 = 黄。パレットの検証済みの 1〜4 番）。色だけに頼らず、印の形も変える（円・四角・ひし形・三角） */
export const TREND_SERIES = [
  { key: 'request', label: '概算要求', stroke: 'stroke-[#2a78d6] dark:stroke-[#3987e5]', fill: 'fill-[#2a78d6] dark:fill-[#3987e5]', shape: 'circle' },
  { key: 'budget', label: '政府案', stroke: 'stroke-[#eb6834] dark:stroke-[#d95926]', fill: 'fill-[#eb6834] dark:fill-[#d95926]', shape: 'square' },
  { key: 'revised', label: '補正後', stroke: 'stroke-[#1baf7a] dark:stroke-[#199e70]', fill: 'fill-[#1baf7a] dark:fill-[#199e70]', shape: 'diamond' },
  { key: 'spent', label: '決算（支出済）', stroke: 'stroke-[#eda100] dark:stroke-[#c98500]', fill: 'fill-[#eda100] dark:fill-[#c98500]', shape: 'triangle' },
] as const;
export type TrendSeriesKey = (typeof TREND_SERIES)[number]['key'];
/** 繰越額の棒（右の目盛り）。折れ線の 4 色とは別の色（紫 = 翌年度繰越、灰 = 前年度繰越） */
export const CARRY_BARS = [
  { key: 'carriedIn', label: '前年度繰越', fill: 'fill-[#9aa3b2] dark:fill-[#6b7385]', swatch: 'bg-[#9aa3b2] dark:bg-[#6b7385]' },
  { key: 'carried', label: '翌年度繰越', fill: 'fill-[#8f6fe0] dark:fill-[#7d5fd0]', swatch: 'bg-[#8f6fe0] dark:bg-[#7d5fd0]' },
] as const;
export type CarryKey = (typeof CARRY_BARS)[number]['key'];
export type TrendPoint = { year: number } & Record<TrendSeriesKey, number | undefined> & Partial<Record<CarryKey, number | undefined>>;

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
 * 繰越額（前年度繰越・翌年度繰越）の値がある年度があれば、年度ごとの棒（0 から）を線の後ろに描き、右に棒の目盛りを置く（左は線の目盛り。繰越額は現額よりずっと小さいので、軸を分ける）。
 * このとき年度は、棒がはみ出さないよう、列の中央に置く。
 */
export function TrendChart({ points, current, onSelect, series, labels }: { points: readonly TrendPoint[]; current: number; onSelect?: (year: number) => void; /** 描く系列。省略すると 4 つすべて（事項は決算が無いので、決算を除く） */ series?: readonly TrendSeriesKey[]; /** 系列の名前を変える（RS は、政府案 = 当初予算、補正後 = 歳出予算現額、決算 = 執行額）。繰越額の棒は、同じ名前 */ labels?: Partial<Record<TrendSeriesKey, string>> }) {
  const shown = TREND_SERIES.filter(s => !series || series.includes(s.key)).map(s => ({ ...s, label: labels?.[s.key] ?? s.label }));
  const bars = CARRY_BARS.filter(b => points.some(p => p[b.key] !== undefined));
  const W = 560, H = 230, top = 12, bottom = 30, left = 74, right = bars.length > 0 ? 66 : 14;
  const plotW = W - left - right, plotH = H - top - bottom;
  const max = Math.max(1, ...points.flatMap(p => shown.map(s => p[s.key] ?? 0)));
  const barMax = Math.max(0, ...points.flatMap(p => bars.map(b => p[b.key] ?? 0)));
  const barScale = barMax > 0 ? barMax : 1;
  const colW = bars.length > 0 ? plotW / points.length : points.length === 1 ? plotW : plotW / (points.length - 1);
  const x = (i: number): number => (bars.length > 0 ? left + colW * (i + 0.5) : points.length === 1 ? left + plotW / 2 : left + (plotW * i) / (points.length - 1));
  const barW = Math.min(16, colW * 0.3);
  const barH = (v: number): number => (v > 0 ? Math.max(2, (v / barScale) * plotH) : 0);
  const y = (v: number): number => top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const curIdx = points.findIndex(p => p.year === current);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`年度推移: ${[...shown.map(s => `${s.label} ${points.map(p => `${p.year}年度 ${p[s.key] === undefined ? '値なし' : sen(p[s.key]!)}`).join('、')}`), ...bars.map(b => `${b.label}（棒） ${points.map(p => `${p.year}年度 ${p[b.key] === undefined ? '値なし' : sen(p[b.key]!)}`).join('、')}`)].join('。')}`} className="block h-auto w-full">
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} className="stroke-neutral-200 dark:stroke-neutral-700" />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" className={`${muted} text-[10px] tabular-nums`}>{t === 0 ? '0' : sen(t)}</text>
          </g>
        ))}
        {bars.length > 0 && (barMax > 0 ? [0, barMax / 2, barMax] : [0]).map(t => (
          <text key={`r-${t}`} x={W - right + 6} y={y(t * (max / barScale)) + 3.5} className={`${muted} text-[10px] tabular-nums`}>{t === 0 ? '0' : sen(t)}</text>
        ))}
        {points.map((p, i) => bars.map((b, k) => {
          const v = p[b.key];
          if (v === undefined) return null;
          const h = barH(v), bx = x(i) + (k - bars.length / 2) * (barW + 1);
          return (
            <g key={`bar-${p.year}-${b.key}`}>
              <title>{`${p.year}年度 ${b.label}: ${v.toLocaleString('ja-JP')} 円`}</title>
              {h > 0 && <rect x={bx} y={top + plotH - h} width={barW} height={h} rx={3} className={`${b.fill} opacity-80`} />}
              {h > 0 && <rect x={bx} y={top + plotH - Math.min(h, 3)} width={barW} height={Math.min(h, 3)} className={`${b.fill} opacity-80`} />}
            </g>
          );
        }))}
        {curIdx >= 0 && <line x1={x(curIdx)} x2={x(curIdx)} y1={top} y2={H - bottom} strokeDasharray="4 3" className="stroke-neutral-400" />}
        {onSelect && points.map((p, i) => {
          return (
            <g key={`pick-${p.year}`} role="button" tabIndex={0} aria-label={`${p.year}年度を開く`} className="cursor-pointer outline-none [&:focus-visible>rect]:fill-emerald-500/20 [&:hover>rect]:fill-neutral-500/10" onClick={() => onSelect(p.year)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.year); } }}>
              <title>{`${p.year}年度を開く${bars.length > 0 ? `（${bars.map(b => `${b.label} ${p[b.key] === undefined ? '値なし' : sen(p[b.key]!)}`).join('、')}）` : ''}`}</title>
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
        {bars.map(b => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-3 rounded-sm opacity-80 ${b.swatch}`} aria-hidden="true" />
            <span>{b.label}（右目盛り）</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
