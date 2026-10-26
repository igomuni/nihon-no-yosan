/**
 * 事項の表示の部品（項の事項タブと、事項の詳細が使う）。仕様: docs/guides/lifecycle-jikou.md
 * 値は千円。事項に決算は無い。値の無い所は「—」（0 とは別）。理由が分かるときは、小さな印（`要求のみ` `予算のみ` `補正のみ`）。
 */
import { useMemo } from 'react';
import {
  JIKOU_AMOUNT,
  JIKOU_EVIDENCE_LABEL,
  JIKOU_MEASURES,
  formatSen,
  jikouAmount,
  jikouEvidenceOf,
  jikouRequestOnly,
  jikouSuppOnly,
  jikouTotals,
  type JikouIndex,
  type JikouMeasure,
  type JikouRow,
  type JikouTable,
  type JikouYearTotal,
} from '@nihon-no-yosan/core';
import { TrendChart, type TrendPoint, type TrendSeriesKey } from './charts.tsx';
import { num, td, th } from './shared.ts';

const AMOUNT_LABEL: Record<(typeof JIKOU_AMOUNT)[number], string> = {
  eq_revised: '次の年度の前年度予算額が、前の年度の改予算額と一致',
  eq_budget: '次の年度の前年度予算額が、前の年度の政府案の額と一致',
  ne: '次の年度の前年度予算額が、前の年度の改予算額・政府案の額のどちらとも違う',
  zero: '次の年度の前年度予算額が 0（比べない）',
  'n/a': '比べられない（どちらかに値が無い）',
};

export const cell = (v: number | null): string => (v === null ? '—' : v === 0 ? '0円' : formatSen(v));
export const exact = (v: number): string => `${v.toLocaleString('ja-JP')} 千円`;
export const MEASURE = (k: JikouMeasure) => JIKOU_MEASURES.find(m => m.key === k)!;
/** 事項に決算は無い。グラフ・表に出す段階（決算を除く） */
export const CHART_SERIES: readonly TrendSeriesKey[] = ['request', 'budget', 'revised'];

/** 値が無い理由が分かるときの、小さな印と説明。分からないときは null（`—` と「現行データに値なし」） */
function absent(jikou: JikouIndex, nodeIndex: number, measure: JikouMeasure): { label: string; hint: string } | null {
  const n = jikou.data.nodes[nodeIndex]!;
  if (measure === 'request') {
    if (n[3] === null) return null;
    return jikou.requestRead.has(n[0])
      ? { label: '予算のみ', hint: '概算要求書の同じ項に、同名の事項が無い' }
      : { label: '', hint: '概算要求の事項を読めていない項（要求書に明細が無い、または明細の項につながらない）' };
  }
  if (jikouRequestOnly(n)) return { label: '要求のみ', hint: '予算書（当初予算・補正）に無い事項（概算要求書にだけある）' };
  if (jikouSuppOnly(n) && (measure === 'budget' || measure === 'prev')) return { label: '補正のみ', hint: '当初予算に無い事項（補正で新しくできた）' };
  return null;
}

/** 年度の表・年度ごとの表の 1 つの値（千円）。値が無いときは、理由が分かれば印、無ければ `—` */
export function AmountCell({ jikou, row, year, measure, current }: { jikou: JikouIndex; row: JikouRow; year: number; measure: JikouMeasure; current: boolean }) {
  const c = row.cells.get(year);
  const v = jikouAmount(jikou, c, measure);
  const gap = v === null && c ? absent(jikou, c.node, measure) : null;
  return (
    <td className={`${num} ${current ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`} title={v === null ? (gap ? gap.hint : c ? '現行データに値なし' : 'この年度に事項なし') : exact(v)}>
      {gap?.label ? <span className="text-[10px] text-neutral-500">{gap.label}</span> : cell(v)}
    </td>
  );
}

/** 選んだ事項（2 つ以上なら合計）の年度推移（折れ線）。値は千円を円にして、項の年度推移のグラフと同じ軸にする */
export function JikouChart({ table, jikou, current, onSelect }: { table: JikouTable; jikou: JikouIndex; current: number; onSelect: (year: number) => void }) {
  const points = useMemo<TrendPoint[]>(() => {
    const t = { request: jikouTotals(jikou, table, 'request'), budget: jikouTotals(jikou, table, 'budget'), revised: jikouTotals(jikou, table, 'revised') };
    const yen = (v: number | null): number | undefined => (v === null ? undefined : v * 1000);
    return table.years.map((year, i) => ({ year, request: yen(t.request[i]!.sum), budget: yen(t.budget[i]!.sum), revised: yen(t.revised[i]!.sum), spent: undefined }));
  }, [table, jikou]);
  return <TrendChart points={points} current={current} onSelect={onSelect} series={CHART_SERIES} />;
}

export const YEAR_COLS: { m: JikouMeasure; label: string }[] = [{ m: 'request', label: '要求' }, { m: 'budget', label: '政府案' }, { m: 'revised', label: '補正後' }, { m: 'suppNet', label: '補正の差引' }];

/** 選んだ事項の、年度を縦にした表（項の年度推移の表と同じ）。事項が 1 つなら、その事項の値と対応。2 つ以上なら、合計。年度の行を押すと、その年度に移る（`onYear`。選んでいる年度 `selectedYear` の行は色付き） */
export function JikouYearTable({ table, jikou, selectedYear, onYear }: { table: JikouTable; jikou: JikouIndex; selectedYear: number; onYear: (year: number) => void }) {
  const years = table.years;
  const row = table.rows.length === 1 ? table.rows[0]! : null;
  const totals = useMemo(() => YEAR_COLS.map(c => jikouTotals(jikou, table, c.m)), [jikou, table]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th className={th}>年度</th>
            <th className={`${th} min-w-[7rem]`}>{row ? '事項名（対応）' : '合計'}</th>
            {YEAR_COLS.map(c => <th key={c.m} className={`${th} whitespace-nowrap text-right`} title={MEASURE(c.m).hint}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map((y, n) => {
            const selected = y === selectedYear;
            const c = row?.cells.get(y);
            const node = c ? jikou.data.nodes[c.node] : undefined;
            const prevCell = row && n > 0 ? row.cells.get(years[n - 1]!) : undefined;
            const prevNode = prevCell ? jikou.data.nodes[prevCell.node] : undefined;
            const renamed = !!node && !!prevNode && node[2] !== prevNode[2];
            const link = c?.link === undefined ? undefined : jikou.data.links[c.link];
            const count = totals[0]!.find(t => t.year === y);
            return (
              <tr
                key={y}
                tabIndex={0}
                aria-selected={selected}
                title={selected ? undefined : `FY${y} を開く`}
                onClick={() => { if (!selected) onYear(y); }}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onYear(y); } }}
                className={`border-t border-neutral-100 align-top dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
              >
                <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{y}</td>
                <td className={td}>
                  {row ? (node ? (
                    <>
                      <span className={renamed ? 'font-medium text-amber-700 dark:text-amber-400' : ''} title={renamed ? `前の年度の事項名: ${prevNode![2]}` : undefined}>{node[2]}</span>
                      {renamed && <span className="ml-1 text-[10px] text-neutral-500">（名称が変わった）</span>}
                      {link && <span className="block text-[10px] text-neutral-500" title={`${jikouEvidenceOf(link[2]).map(e => JIKOU_EVIDENCE_LABEL[e]).join(' / ')}。${AMOUNT_LABEL[JIKOU_AMOUNT[link[3]]!]}`}>対応: {jikouEvidenceOf(link[2]).map(e => (e === 'same_key' ? '同じ鍵' : JIKOU_EVIDENCE_LABEL[e])).join('・')}</span>}
                    </>
                  ) : <span className="text-neutral-400">この年度に事項なし</span>)
                    : <span className="text-neutral-500">{table.rows.filter(r => r.cells.has(y)).length}/{table.rows.length} 事項</span>}
                </td>
                {YEAR_COLS.map((col, k) => (row
                  ? <AmountCell key={col.m} jikou={jikou} row={row} year={y} measure={col.m} current={false} />
                  : <SumCell key={col.m} total={totals[k]!.find(t => t.year === y)!} all={count?.rows ?? 0} />))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 合計のセル。値のある事項が無ければ「—」。一部の事項にしか値が無いときは、その数を添える */
function SumCell({ total, all }: { total: JikouYearTotal; all: number }) {
  return (
    <td className={num} title={total.sum === null ? '値のある事項が無い' : `${exact(total.sum)}（値のある ${total.withValue} 事項の合計）`}>
      {cell(total.sum)}
      {total.sum !== null && total.withValue < Math.max(total.rows, all) && <span className="block text-[10px] text-amber-700 dark:text-amber-400">{total.withValue}/{Math.max(total.rows, all)} 事項</span>}
    </td>
  );
}
