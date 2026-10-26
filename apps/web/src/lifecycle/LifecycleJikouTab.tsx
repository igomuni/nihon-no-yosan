import { useEffect, useMemo, useRef, useState } from 'react';
import {
  JIKOU_MEASURES,
  formatSen,
  jikouAmount,
  jikouTable,
  jikouTotals,
  type JikouIndex,
  type JikouMeasure,
  type JikouRow,
  type JikouTable,
  type LifecycleChain,
  type LifecycleKou,
  type LifecycleValues,
} from '@nihon-no-yosan/core';
import { MultiSelectCombo, NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { AmountCell, JikouChart, JikouYearTable, MEASURE, YEAR_COLS, cell, exact } from './JikouViews.tsx';
import { kouTitle, num, td, th } from './shared.ts';

/** 項の額（円）のうち、事項の計と比べる値。事項の額は千円 */
const KOU_VALUE: Record<JikouMeasure, keyof LifecycleValues> = { request: 'request_amount', budget: 'budget_amount', revised: 'revised_amount', suppNet: 'supp_net', prev: 'budget_prev' };
/** 項の額と照合する値 */
const CHECKED: readonly JikouMeasure[] = ['request', 'budget', 'revised'];

const rowKey = (r: JikouRow): string => `${r.firstYear}|${r.name}`;
const span = (r: JikouRow): string => `FY${r.firstYear}${r.firstYear === r.lastYear ? '' : `〜FY${r.lastYear}`}`;
/**
 * 選択肢の表示名（事項名に、選んだ年度の額 = 政府案、無ければ補正後、概算要求 を添えて、大きさの見当がつくようにする。その年度に無ければ、事項のある年度の範囲）。
 * チェックボックス付きのコンボボックスは文字列で選択肢を持つので、同じ表示名があれば、行の番号を添えて区別する。
 */
function jikouLabels(rows: readonly JikouRow[], year: number, jikou: JikouIndex): string[] {
  const hint = (r: JikouRow): string => {
    const c = r.cells.get(year);
    if (!c) return span(r);
    for (const [m, label] of [['budget', '政府案'], ['revised', '補正後'], ['request', '概算要求']] as const) {
      const v = jikouAmount(jikou, c, m);
      if (v !== null) return `FY${year} ${label} ${formatSen(v)}`;
    }
    return span(r);
  };
  const base = rows.map(r => `${r.name}${r.renamed ? '（名称が変わった）' : ''} · ${hint(r)}`);
  const seen = new Map<string, number>();
  for (const l of base) seen.set(l, (seen.get(l) ?? 0) + 1);
  return base.map((l, i) => ((seen.get(l) ?? 0) > 1 ? `${l} [${i + 1}]` : l));
}

/** 選んだ事項（行）。選択の値は、チェックボックス付きコンボボックスと同じ約束: null = まだ選んでいない（一番上の事項）、空 = すべて、[NONE_SELECTED] = なし、それ以外 = 選んだ事項の行のキー */
function chosenRows(rows: readonly JikouRow[], picked: string[] | null): JikouRow[] {
  if (picked === null) return rows.slice(0, 1);
  if (picked.includes(NONE_SELECTED)) return [];
  if (picked.length === 0) return [...rows];
  const set = new Set(picked);
  const sel = rows.filter(r => set.has(rowKey(r)));
  return sel.length > 0 ? sel : rows.slice(0, 1); // 別の項に移って、選んだ事項が無いとき
}

/**
 * 項の下の事項。年度推移のタブと同じ見せ方: 事項をコンボボックス（チェックボックス付きの複数選択）で選び、選んだ事項の概算要求・政府案・補正後を、グラフと、年度を縦に並べた表で見る。
 * 2 つ以上選ぶと、選んだ事項の合計（値のある事項だけ足す）を出し、選んだ年度の事項ごとの値を別の表に出す。
 * 事項に決算は無い（決算は項と目の単位）。値の無い所は「—」（0 とは別）。事項の計は項の額と照合する（折りたたみ）。この項のすべての事項は、年度 × 値の表（折りたたみ）。
 */
export function LifecycleJikouTab({ kou, chain, kous, valuesOf, jikou, loading, failed, onNavigate, picked, onPick }: {
  kou: LifecycleKou;
  chain: LifecycleChain;
  kous: readonly LifecycleKou[];
  valuesOf: ReadonlyMap<number, LifecycleValues>;
  /** 事項のデータ（`lifecycle/jikou.json.gz`）の索引。読み込み中・失敗のときは null */
  jikou: JikouIndex | null;
  loading: boolean;
  failed: boolean;
  onNavigate: (id: string) => void;
  /** 選んだ事項（行のキー。値の約束は `chosenRows`）。タブを切り替えても残すので、持ち主は右ペイン（タブの外） */
  picked: string[] | null;
  onPick: (picked: string[] | null) => void;
}) {
  const members = useMemo(() => chain.members.map(i => ({ i, k: kous[i]! })), [chain, kous]);
  const table = useMemo(() => (jikou ? jikouTable(jikou, members.map(m => m.k.id)) : null), [jikou, members]);
  const [open, setOpen] = useState(false);
  const top = useRef<HTMLElement>(null);
  const rows = useMemo(() => table?.rows ?? [], [table]);
  const chosen = useMemo(() => chosenRows(rows, picked), [rows, picked]);
  const labels = useMemo(() => (jikou ? jikouLabels(rows, kou.year, jikou) : []), [rows, kou.year, jikou]);
  const memberYears = useMemo(() => members.map(m => m.k.year), [members]);
  const years = useMemo(() => table?.years ?? memberYears, [table, memberYears]);
  const chosenTable = useMemo<JikouTable>(() => ({ years, rows: chosen }), [years, chosen]);
  const one = chosen.length === 1 ? chosen[0]! : null;
  const select = (key: string): void => { onPick([key]); top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
      </div>

      {failed ? <p className="text-red-700">事項の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>
        : loading || !jikou || !table ? <p className="text-neutral-500">事項を読み込み中…</p>
        : rows.length === 0 ? <p className="text-neutral-500">この項の事項は、現行のデータにありません。</p>
        : (
          <>
            <section ref={top} className="flex flex-col gap-1.5" aria-label="事項の選択">
              <p className="font-semibold">事項（{rows.length}）</p>
              <MultiSelectCombo
                label="事項"
                options={labels}
                selected={picked === null ? [labels[0]!] : picked.includes(NONE_SELECTED) ? [NONE_SELECTED] : picked.length === 0 ? [] : chosen.map(r => labels[rows.indexOf(r)]!)}
                onChange={next => onPick(next.includes(NONE_SELECTED) ? [NONE_SELECTED] : next.length === 0 ? [] : next.map(l => rowKey(rows[labels.indexOf(l)]!)))}
                open={open}
                onOpenChange={setOpen}
              />
              <p className="text-[11px] text-neutral-500">
                {one ? `${span(one)}${one.renamed ? ' · 名称が変わった' : ''}` : chosen.length === 0 ? '事項を選んでください' : `選んだ ${chosen.length} 事項の合計`}
              </p>
            </section>

            {chosen.length > 0 && (
              <>
                <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
                  <h3 className="font-semibold">段階ごとの額{one ? '' : '（選んだ事項の合計）'}</h3>
                  <JikouChart table={chosenTable} jikou={jikou} current={kou.year} onSelect={y => { const m = members.find(x => x.k.year === y); if (m && m.k.id !== kou.id) onNavigate(m.k.id); }} />
                </section>

                <section className="flex flex-col gap-2" aria-label="年度の表">
                  <h3 className="font-semibold">年度ごとの額{one ? 'と対応' : '（選んだ事項の合計）'}</h3>
                  <JikouYearTable table={chosenTable} jikou={jikou} selectedYear={kou.year} onYear={y => { const m = members.find(x => x.k.year === y); if (m && m.k.id !== kou.id) onNavigate(m.k.id); }} />
                </section>

                {!one && <JikouBreakdown rows={chosen} jikou={jikou} year={kou.year} onSelect={select} />}
              </>
            )}

            <Reconcile table={table} jikou={jikou} years={years} members={members} valuesOf={valuesOf} current={kou.year} />
            <AllJikou table={table} jikou={jikou} years={years} members={members} kou={kou} onNavigate={onNavigate} onPick={select} picked={chosen.map(rowKey)} />
          </>
        )}
    </div>
  );
}

/** 選んだ年度の、選んだ事項ごとの値（2 つ以上選んだとき）。行を押すと、その事項だけにする */
function JikouBreakdown({ rows, jikou, year, onSelect }: { rows: readonly JikouRow[]; jikou: JikouIndex; year: number; onSelect: (key: string) => void }) {
  return (
    <section className="flex flex-col gap-2" aria-label="選んだ事項ごと">
      <h3 className="font-semibold">FY{year} の選んだ事項ごと</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left">
              <th className={`${th} min-w-[7rem]`}>事項</th>
              {YEAR_COLS.map(c => <th key={c.m} className={`${th} whitespace-nowrap text-right`} title={MEASURE(c.m).hint}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={rowKey(r)} onClick={() => onSelect(rowKey(r))} title="この事項だけにする" className="cursor-pointer border-t border-neutral-100 align-top hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60">
                <td className={td}>
                  <span className={r.renamed ? 'font-medium text-amber-700 dark:text-amber-400' : ''}>{r.name}</span>
                  {!r.cells.has(year) && <span className="block text-[10px] text-neutral-500">この年度に事項なし（{span(r)}）</span>}
                </td>
                {YEAR_COLS.map(col => <AmountCell key={col.m} jikou={jikou} row={r} year={year} measure={col.m} current={false} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 事項の計と、項の額（概算要求の総表・予算書の目の合計）の照合。違う年度があれば、見出しに出す */
function Reconcile({ table, jikou, years, members, valuesOf, current }: { table: JikouTable; jikou: JikouIndex; years: readonly number[]; members: readonly { i: number; k: LifecycleKou }[]; valuesOf: ReadonlyMap<number, LifecycleValues>; current: number }) {
  const checks = useMemo(() => CHECKED.map(m => ({
    m,
    totals: jikouTotals(jikou, table, m).map(t => {
      const mem = members.find(x => x.k.year === t.year)!;
      const yen = valuesOf.get(mem.i)?.[KOU_VALUE[m]];
      const v = yen === undefined ? null : yen / 1000;
      return { ...t, kou: v, differs: v !== null && t.sum !== null && t.withValue === t.rows && v !== t.sum };
    }),
  })), [jikou, table, members, valuesOf]);
  const nDiffer = checks.reduce((n, c) => n + c.totals.filter(t => t.differs).length, 0);
  return (
    <details className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
      <summary className="cursor-pointer font-semibold">
        項の額との照合
        {nDiffer > 0 && <span className="ml-2 font-normal text-amber-700 dark:text-amber-400">事項の計と違う年度・値が {nDiffer} 件</span>}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                {checks.map(c => <th key={c.m} className={`${th} text-right`}>{MEASURE(c.m).label}（事項の計 / 項の額）</th>)}
              </tr>
            </thead>
            <tbody>
              {years.map(y => (
                <tr key={y} className={`border-t border-neutral-100 dark:border-neutral-800 ${y === current ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                  <td className={`${td} whitespace-nowrap`}>FY{y}</td>
                  {checks.map(c => {
                    const t = c.totals.find(x => x.year === y)!;
                    return (
                      <td key={c.m} className={`${num} ${t.differs ? 'text-amber-700 dark:text-amber-400' : ''}`} title={t.sum === null ? undefined : `事項の計 ${exact(t.sum)}${t.kou === null ? '' : ` / 項の額 ${exact(t.kou)}`}`}>
                        {cell(t.sum)} / {cell(t.kou)}
                        {t.differs && <span className="block text-[10px]">違う</span>}
                        {t.sum !== null && t.withValue < t.rows && <span className="block text-[10px] text-amber-700 dark:text-amber-400">{t.withValue}/{t.rows} 事項</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

/** この項のすべての事項を、年度 × 値で並べた表。行を押すと、その事項に選び直す */
function AllJikou({ table, jikou, years, members, kou, onNavigate, onPick, picked }: { table: JikouTable; jikou: JikouIndex; years: readonly number[]; members: readonly { i: number; k: LifecycleKou }[]; kou: LifecycleKou; onNavigate: (id: string) => void; onPick: (key: string) => void; picked: readonly string[] }) {
  const [shown, setShown] = useState(false);
  // 予算書が基準データに無い年度（概算要求のみの項）は、概算要求から見る
  const [measure, setMeasure] = useState<JikouMeasure>(kou.requestOnly === 'noBudget' ? 'request' : 'budget');
  const scroller = useRef<HTMLDivElement>(null);
  // 年度の列が多いときは、選んだ年度の列が見える位置まで、表を横にずらす
  useEffect(() => {
    const box = scroller.current;
    const head = box?.querySelector<HTMLElement>('[data-selected="true"]');
    if (box && head) box.scrollLeft = Math.max(0, head.offsetLeft - box.clientWidth / 2);
  }, [shown, kou.id, table, measure]);
  return (
    <details className="rounded border border-neutral-200 p-2 dark:border-neutral-700" onToggle={e => setShown((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold">この項のすべての事項（{table.rows.length}）</summary>
      {shown && (
        <div className="mt-2 flex flex-col gap-2">
          <div role="tablist" aria-label="事項の値" className="flex flex-wrap gap-1">
            {JIKOU_MEASURES.map(m => (
              <button key={m.key} type="button" role="tab" aria-selected={measure === m.key} title={m.hint} onClick={() => setMeasure(m.key)} className={`rounded-full border px-2.5 py-0.5 ${measure === m.key ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}>{m.label}</button>
            ))}
          </div>
          <div ref={scroller} className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left">
                  <th className={`${th} sticky left-0 min-w-[11rem] bg-white dark:bg-neutral-900`}>事項</th>
                  {years.map(y => {
                    const m = members.find(x => x.k.year === y)!;
                    const selected = m.k.id === kou.id;
                    return (
                      <th key={y} data-selected={selected} className={`${th} whitespace-nowrap text-right ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}>
                        <button type="button" disabled={selected} title={selected ? undefined : `FY${y} の項を開く`} onClick={() => onNavigate(m.k.id)} className={selected ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'underline decoration-dotted underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100'}>FY{y}</button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.rows.map(r => (
                  <tr key={rowKey(r)} onClick={() => onPick(rowKey(r))} title="この事項だけにする" className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60 ${picked.includes(rowKey(r)) ? 'bg-neutral-50 dark:bg-neutral-800/60' : ''}`}>
                    <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>
                      <span className={r.renamed ? 'font-medium text-amber-700 dark:text-amber-400' : ''}>{r.name}</span>
                      {r.renamed && <span className="ml-1 text-[10px] text-neutral-500">（名称が変わった）</span>}
                      {(r.firstYear > years[0]! || r.lastYear < years[years.length - 1]!) && <span className="block text-[10px] text-neutral-500">{span(r)}</span>}
                    </td>
                    {years.map(y => <AmountCell key={y} jikou={jikou} row={r} year={y} measure={measure} current={y === kou.year} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </details>
  );
}
