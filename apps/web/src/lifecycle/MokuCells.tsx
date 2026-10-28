import {
  MOKU_FLAG,
  formatSen,
  isSettleMeasure,
  mokuSettleNote,
  mokuSuppNote,
  mokuValue,
  type LifecycleMokuData,
  type LifecycleMokuNode,
  type MokuMeasure,
} from '@nihon-no-yosan/core';
import { num } from './shared.ts';

/** 目の値のセルと印（中ペインが「目」のときの右ペイン（目の詳細）の表で使う） */

const exact = (v: number): string => `${v.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} 千円`;
export const amount = (v: number): string => (v === 0 ? '0円' : formatSen(v));

/** 目の値が無い理由（表示用） */
function why(data: LifecycleMokuData, n: LifecycleMokuNode, key: MokuMeasure): string {
  if (key === 'revised') return mokuSuppNote(data, n) ?? '値なし';
  if (isSettleMeasure(key)) return mokuSettleNote(data, n) ?? '値なし';
  if (n[13] & MOKU_FLAG.settlePart) return `決算の共管別の行（${key === 'request' ? '概算要求' : '政府案'}は、共管別に分かれていない）`;
  if (key === 'request') {
    if (!data.requestYears.includes(n[1])) return 'この年度の概算要求の目は、データに無い';
    return '概算要求書に、同じ名前の目が無い（概算要求の目の取れ方を見る）';
  }
  if (n[13] & MOKU_FLAG.requestOnly) return '概算要求書にだけある目';
  return '当初予算に無い目（補正か決算で出る目）';
}

export function Cell({ data, node, measure, current }: { data: LifecycleMokuData; node: number | undefined; measure: MokuMeasure; current?: boolean }) {
  const hl = current ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : '';
  if (node === undefined) return <td className={`${num} ${hl} text-neutral-300 dark:text-neutral-600`} title="この年度に、この目は無い">·</td>;
  const n = data.nodes[node]!;
  const v = mokuValue(n, measure);
  return v === null
    ? <td className={`${num} ${hl} text-neutral-300 dark:text-neutral-600`} title={why(data, n, measure)}>—</td>
    : <td className={`${num} ${hl}`} title={exact(v)}>{amount(v)}</td>;
}

/** 共管別の行の共管（所管 / 組織） */
const partLabel = (part: string): string => part.replace(/#\d+$/, '').split('|').filter(Boolean).join(' / ');

export function Marks({ n }: { n: LifecycleMokuNode }) {
  const part = partLabel(n[4]);
  return (
    <>
      {n[13] & MOKU_FLAG.settlePart ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="決算の共管別の行">共管: {part}</span> : null}
      {n[13] & MOKU_FLAG.settleSplit ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="決算は共管の組織ごとの行に分かれている">決算は共管別</span> : null}
      {n[13] & MOKU_FLAG.requestOnly ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="概算要求書にだけある目（予算書に、同じ名前の目が無い。項が予算書に無い場合を含む）">要求のみ</span> : null}
      {n[13] & MOKU_FLAG.nameOnly ? <span className="ml-1 text-[10px] text-neutral-400" title="段階の間で分類コードが違い、目名だけで結んだ">名前</span> : null}
    </>
  );
}

/** 年度を縦にした表と、選んだ年度の内訳に出す値（決算の値と繰越額を含む） */
export const YEAR_COLS: { key: MokuMeasure; label: string }[] = [
  { key: 'request', label: '要求' },
  { key: 'budget', label: '政府案' },
  { key: 'revised', label: '補正後' },
  { key: 'carriedIn', label: '前年度繰越' },
  { key: 'current', label: '歳出予算現額' },
  { key: 'spent', label: '支出済' },
  { key: 'carried', label: '翌年度繰越' },
  { key: 'unused', label: '不用額' },
];
