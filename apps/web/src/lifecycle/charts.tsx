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

/** 段階ごとの額（柱）。ゼロを基準に、値を柱の上に直接書く */
export function LevelsChart({ levels, caption }: { levels: readonly LifecycleLevel[]; caption?: string }) {
  const W = 560, H = 190, top = 26, bottom = 44, left = 10, right = 10;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...levels.map(l => l.yen));
  const slot = (W - left - right) / Math.max(1, levels.length);
  const bar = Math.min(44, slot * 0.6);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`段階ごとの額: ${levels.map(l => `${l.label} ${sen(l.yen)}`).join('、')}`} className="block h-auto w-full max-w-[560px]">
        <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} className="stroke-neutral-300 dark:stroke-neutral-600" />
        {levels.map((l, i) => {
          const h = l.yen > 0 ? Math.max(2, (l.yen / max) * plotH) : 0;
          const x = left + slot * i + (slot - bar) / 2;
          return (
            <g key={l.key}>
              <title>{`${l.label}: ${l.yen.toLocaleString('ja-JP')} 円`}</title>
              <rect x={x} y={H - bottom - h} width={bar} height={h} rx={4} className={BLUE} />
              <rect x={x} y={H - bottom - Math.min(h, 4)} width={bar} height={Math.min(h, 4)} className={BLUE} />
              <text x={x + bar / 2} y={H - bottom - h - 6} textAnchor="middle" className={`${ink} text-[11px] font-semibold tabular-nums`}>{sen(l.yen)}</text>
              {lines(l.label).map((t, k) => (
                <text key={k} x={x + bar / 2} y={H - bottom + 14 + k * 12} textAnchor="middle" className={`${muted} text-[10px]`}>{t}</text>
              ))}
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
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`段階ごとの増減: ${changes.map(c => `${c.label} ${senSigned(c.yen)}`).join('、')}`} className="block h-auto w-full max-w-[560px]">
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
    <figure className="m-0 flex max-w-[560px] flex-col gap-1.5">
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
