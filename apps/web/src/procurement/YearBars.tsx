/**
 * 年度ごとの棒グラフ（SVG）。縦軸は 0 から。値のラベルは、選んだ年度と最大の年度の棒の上だけに置く（右ペインの幅では、全部に置くと重なる。全年度の値は、詳細の表とツールチップにある）。選んだ年度は縦の破線で示す。
 * 値が無い年度（まだ読み込んでいない）は、棒を描かず、印も置かない（0 とは別）。年度の列を押すと、その年度に移る。
 * 調達の画面の、落札価格の合計で使う。
 */
export interface YearBarPoint {
  year: number;
  /** 値。null = まだ読み込んでいない */
  value: number | null;
  /** ツールチップに出す、正確な値の文字 */
  title: string;
}

export function YearBars({ points, current, onSelect, label, format }: {
  points: readonly YearBarPoint[];
  current: number;
  onSelect: (year: number) => void;
  /** 図の名前（読み上げ用） */
  label: string;
  /** 軸と棒の上のラベルの書き方 */
  format: (v: number) => string;
}) {
  const W = 560, H = 190, top = 20, bottom = 26, left = 66, right = 12;
  const plotW = W - left - right, plotH = H - top - bottom;
  const colW = plotW / Math.max(1, points.length);
  const max = Math.max(1, ...points.map(p => p.value ?? 0));
  const barW = Math.min(26, colW * 0.62);
  const x = (i: number): number => left + colW * (i + 0.5);
  const h = (v: number): number => (v > 0 ? Math.max(2, (v / max) * plotH) : 0);
  const cur = points.findIndex(p => p.year === current);
  const top1 = points.reduce((best, p, i) => ((p.value ?? -1) > (points[best]?.value ?? -1) ? i : best), 0);
  const ticks = [0, max / 2, max];
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.map(p => `${p.year}年度 ${p.value === null ? '未読み込み' : format(p.value)}`).join('、')}`} className="block h-auto w-full">
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={top + plotH - (t / max) * plotH} y2={top + plotH - (t / max) * plotH} className="stroke-neutral-200 dark:stroke-neutral-700" />
            <text x={left - 6} y={top + plotH - (t / max) * plotH + 3.5} textAnchor="end" className="fill-neutral-500 text-[10px] tabular-nums">{t === 0 ? '0' : format(t)}</text>
          </g>
        ))}
        {cur >= 0 && <line x1={x(cur)} x2={x(cur)} y1={top} y2={H - bottom} strokeDasharray="4 3" className="stroke-neutral-400" />}
        {points.map((p, i) => {
          const bh = p.value === null ? 0 : h(p.value);
          return (
            <g key={p.year} role="button" tabIndex={0} aria-label={`${p.year}年度を開く`} className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:fill-emerald-500/20 [&:hover>rect:first-child]:fill-neutral-500/10" onClick={() => onSelect(p.year)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.year); } }}>
              <rect x={x(i) - colW / 2} y={top - 14} width={colW} height={H - top + 14} fill="transparent" />
              <title>{`${p.year}年度 ${p.title}`}</title>
              {bh > 0 && <rect x={x(i) - barW / 2} y={top + plotH - bh} width={barW} height={bh} rx={2} className="fill-[#2a78d6] opacity-85 dark:fill-[#3987e5]" />}
              {p.value !== null && (i === cur || i === top1) && <text x={x(i)} y={top + plotH - bh - 4} textAnchor="middle" className="pointer-events-none fill-neutral-600 text-[9px] tabular-nums dark:fill-neutral-300">{format(p.value)}</text>}
              <text x={x(i)} y={H - bottom + 15} textAnchor="middle" className={`pointer-events-none text-[10px] ${p.year === current ? 'fill-neutral-800 font-semibold dark:fill-neutral-100' : 'fill-neutral-500'}`}>{`'${String(p.year).slice(2)}`}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
