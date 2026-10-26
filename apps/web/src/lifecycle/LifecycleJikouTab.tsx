import { useMemo, useState } from 'react';
import {
  JIKOU_AMOUNT,
  JIKOU_EVIDENCE_LABEL,
  JIKOU_MEASURES,
  formatSen,
  jikouAmount,
  jikouEvidenceOf,
  jikouSuppOnly,
  jikouTable,
  jikouTotals,
  type JikouIndex,
  type JikouMeasure,
  type JikouRow,
  type LifecycleChain,
  type LifecycleKou,
  type LifecycleValues,
} from '@nihon-no-yosan/core';
import { kouTitle, num, td, th } from './shared.ts';

const AMOUNT_LABEL: Record<(typeof JIKOU_AMOUNT)[number], string> = {
  eq_revised: '次の年度の前年度予算額が、前の年度の改予算額と一致',
  eq_budget: '次の年度の前年度予算額が、前の年度の政府案の額と一致',
  ne: '次の年度の前年度予算額が、前の年度の改予算額・政府案の額のどちらとも違う',
  zero: '次の年度の前年度予算額が 0（比べない）',
  'n/a': '比べられない（どちらかに値が無い）',
};

/** 項の額（円）のうち、事項の計と比べる値。事項の額は千円 */
const KOU_VALUE: Record<JikouMeasure, keyof LifecycleValues> = { budget: 'budget_amount', revised: 'revised_amount', suppNet: 'supp_net', prev: 'budget_prev' };

const cell = (v: number | null): string => (v === null ? '—' : v === 0 ? '0円' : formatSen(v));
const exact = (v: number): string => `${v.toLocaleString('ja-JP')} 千円`;

/**
 * 項の下の事項を、確定した年度をまたぐ対応でそろえて、年度の列に並べる。行 = 事項、列 = 年度、値は政府案・補正後・補正の差引額・前年度予算額から選ぶ。
 * 値の無い事項は「—」（0 とは別）。事項の計は項の額と並べ、合わなければ色を付ける。概算要求の事項と、事項の単位の決算は無い。
 */
export function LifecycleJikouTab({ kou, chain, kous, valuesOf, jikou, loading, failed, onNavigate }: {
  kou: LifecycleKou;
  chain: LifecycleChain;
  kous: readonly LifecycleKou[];
  valuesOf: ReadonlyMap<number, LifecycleValues>;
  /** 事項のデータ（`lifecycle/jikou.json.gz`）の索引。読み込み中・失敗のときは null */
  jikou: JikouIndex | null;
  loading: boolean;
  failed: boolean;
  onNavigate: (id: string) => void;
}) {
  const [measure, setMeasure] = useState<JikouMeasure>('budget');
  const [open, setOpen] = useState<number | null>(null);
  const members = useMemo(() => chain.members.map(i => ({ i, k: kous[i]! })), [chain, kous]);
  const table = useMemo(() => (jikou ? jikouTable(jikou, members.map(m => m.k.id)) : null), [jikou, members]);
  const totals = useMemo(() => (jikou && table ? jikouTotals(jikou, table, measure) : []), [jikou, table, measure]);
  // 列にするのは、事項のある年度だけ。無い年度（予算書が基準データに無い年度など）は、注に書く
  const memberYears = members.map(m => m.k.year);
  const years = table?.years ?? memberYears;
  const noData = memberYears.filter(y => !years.includes(y));
  const current = MEASURE(measure);
  const row = table && open !== null ? table.rows[open] : undefined;

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">項の下の事項（予算書の当初予算・補正）。年度は、項の年度推移で確認できた範囲（FY{memberYears[0]}{memberYears.length > 1 ? `〜FY${memberYears[memberYears.length - 1]}` : ''}）のうち、事項のある年度。</p>
      </div>

      {failed ? <p className="text-red-700">事項の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>
        : loading || !jikou || !table ? <p className="text-neutral-500">事項を読み込み中…</p>
        : table.rows.length === 0 ? (
          <p className="text-neutral-500">この項の事項は、現行のデータにありません。{kou.requestOnly ? '概算要求書にだけある項で、予算書の事項と結べていません。' : years.length === 0 ? '予算書の事項は FY2026 までで、この年度の予算書は基準データにありません。' : ''}</p>
        ) : (
          <>
            <div role="tablist" aria-label="事項の値" className="flex flex-wrap gap-1">
              {JIKOU_MEASURES.map(m => (
                <button key={m.key} type="button" role="tab" aria-selected={measure === m.key} title={m.hint} onClick={() => setMeasure(m.key)} className={`rounded-full border px-2.5 py-0.5 ${measure === m.key ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}>{m.label}</button>
              ))}
            </div>
            <p className="-mt-3 text-[11px] text-neutral-500">{current.hint}。</p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className={`${th} sticky left-0 min-w-[11rem] bg-white dark:bg-neutral-900`}>事項（{table.rows.length}）</th>
                    {years.map(y => {
                      const m = members.find(x => x.k.year === y)!;
                      const selected = m.k.id === kou.id;
                      return (
                        <th key={y} className={`${th} whitespace-nowrap text-right ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}>
                          <button type="button" disabled={selected} title={selected ? undefined : `FY${y} の項を開く`} onClick={() => onNavigate(m.k.id)} className={selected ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'underline decoration-dotted underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100'}>FY{y}</button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r, n) => (
                    <tr key={n} onClick={() => setOpen(open === n ? null : n)} className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60 ${open === n ? 'bg-neutral-50 dark:bg-neutral-800/60' : ''}`}>
                      <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>
                        <button type="button" aria-expanded={open === n} className="text-left">
                          <span className={r.renamed ? 'font-medium text-amber-700 dark:text-amber-400' : ''}>{r.name}</span>
                        </button>
                        {r.renamed && <span className="ml-1 text-[10px] text-neutral-500">（名称が変わった）</span>}
                        {(r.firstYear > years[0]! || r.lastYear < years[years.length - 1]!) && (
                          <span className="block text-[10px] text-neutral-500">FY{r.firstYear}{r.firstYear === r.lastYear ? '' : `〜FY${r.lastYear}`}</span>
                        )}
                      </td>
                      {years.map(y => {
                        const c = r.cells.get(y);
                        const v = jikou ? jikouAmount(jikou, c, measure) : null;
                        return <td key={y} className={`${num} ${y === kou.year ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`} title={v === null ? (c ? (jikou && jikouSuppOnly(jikou.data.nodes[c.node]!) ? '当初予算に無い事項（補正で新しくできた）' : '現行データに値なし') : 'この年度に事項なし') : exact(v)}>{cell(v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 font-semibold dark:border-neutral-700">
                    <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>事項の計</td>
                    {totals.map(t => (
                      <td key={t.year} className={num} title={t.sum === null ? undefined : exact(t.sum)}>
                        {cell(t.sum)}
                        {t.sum !== null && t.withValue < t.rows && <span className="block text-[10px] font-normal text-amber-700 dark:text-amber-400">{t.withValue}/{t.rows} 事項</span>}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-neutral-600 dark:text-neutral-300">
                    <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>項の額</td>
                    {totals.map(t => {
                      const m = members.find(x => x.k.year === t.year)!;
                      const yen = valuesOf.get(m.i)?.[KOU_VALUE[measure]];
                      const v = yen === undefined ? null : yen / 1000;
                      const differs = v !== null && t.sum !== null && t.withValue === t.rows && v !== t.sum;
                      return (
                        <td key={t.year} className={`${num} ${differs ? 'text-amber-700 dark:text-amber-400' : ''}`} title={v === null ? undefined : exact(v)}>
                          {cell(v)}
                          {differs && <span className="block text-[10px]">事項の計と違う</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="-mt-3 text-[11px] text-neutral-500">
              行を押すと、その事項の年度ごとの値と対応の根拠が出ます。「—」は現行のデータに値が無いこと（0 とは別）。事項の計は値のある事項だけの合計で、一部の事項にしか値が無い年度は、その数を添えます。項の額は予算書の目の合計（導出）で、事項の計と合うはずです。
            </p>

            {row && <RowDetail row={row} jikou={jikou} />}
          </>
        )}

      <section className="flex flex-col gap-1 rounded border border-neutral-200 p-2 text-[11px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-300" aria-label="この表にないもの">
        <p className="font-semibold">この表にないもの</p>
        <ul className="list-disc pl-4">
          <li>概算要求の事項と、事項の単位の決算。決算は項と目の単位で（事項の列が無い）、目は事項の下に結べないので、項の「1年の推移」と「年度推移」で見る。</li>
          <li>補正後・補正の差引額は、補正の事項の記録がある年度（FY2024 まで）の事項だけ。FY2025 以降は、現行のデータに補正の事項が無い。補正が複数回の年度は、その事項が載る最後の回の値で、年度の合計ではない。項の差引額は、項が載る最後の回（事項の無い「項のみ」の行を含む）の値なので、補正の差引額の事項の計が項の額と合わないことがある。</li>
          {noData.length > 0 && table && table.rows.length > 0 && <li>{noData.map(y => `FY${y}`).join('・')}: 事項のデータが無い年度（予算書が基準データに無い年度、または項が予算書にない）。</li>}
          <li>年度の間の対応は、確定したもの（同じ鍵、または名前と額の根拠がそろった 1 対 1）だけでたどっている。対応が確定しない事項は、別の行になる。事業が同じとは限らない。</li>
        </ul>
      </section>
    </div>
  );
}

const MEASURE = (k: JikouMeasure) => JIKOU_MEASURES.find(m => m.key === k)!;

/** 選んだ事項の年度ごとの値と、前の年度との対応の根拠 */
function RowDetail({ row, jikou }: { row: JikouRow; jikou: JikouIndex | null }) {
  if (!jikou) return null;
  const ys = [...row.cells.keys()].sort((a, b) => a - b);
  return (
    <section className="flex flex-col gap-2" aria-label="選んだ事項">
      <h3 className="font-semibold">{row.name}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left">
              <th className={th}>年度</th>
              {JIKOU_MEASURES.map(m => <th key={m.key} className={`${th} whitespace-nowrap text-right`} title={m.hint}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {ys.map((y, n) => {
              const c = row.cells.get(y)!;
              const node = jikou.data.nodes[c.node]!;
              const prev = n > 0 ? jikou.data.nodes[row.cells.get(ys[n - 1]!)!.node]! : null;
              const link = c.link === undefined ? undefined : jikou.data.links[c.link];
              return (
                <tr key={y} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                  <td className={`${td} whitespace-nowrap`}>
                    FY{y}
                    {prev && prev[2] !== node[2] && <span className="block max-w-[10rem] text-[10px] font-medium text-amber-700 dark:text-amber-400">{node[2]}</span>}
                    {link && <span className="block text-[10px] text-neutral-500" title={`${jikouEvidenceOf(link[2]).map(e => JIKOU_EVIDENCE_LABEL[e]).join(' / ')}。${AMOUNT_LABEL[JIKOU_AMOUNT[link[3]]!]}`}>対応: {jikouEvidenceOf(link[2]).map(e => (e === 'same_key' ? '同じ鍵' : JIKOU_EVIDENCE_LABEL[e])).join('・')}</span>}
                  </td>
                  {JIKOU_MEASURES.map(m => {
                    const v = jikouAmount(jikou, c, m.key);
                    return <td key={m.key} className={num} title={v === null ? undefined : exact(v)}>{cell(v)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-500">「対応」は、前の年度の事項との対応の根拠（確定したものだけ）。名称が変わった年度は、事項名を添えます。</p>
    </section>
  );
}
