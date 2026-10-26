import { useEffect, useMemo, useRef, useState } from 'react';
import {
  JIKOU_AMOUNT,
  JIKOU_EVIDENCE_LABEL,
  JIKOU_MEASURES,
  formatSen,
  jikouAmount,
  jikouEvidenceOf,
  jikouRequestOnly,
  jikouSuppOnly,
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
import { Icon } from '../components/Icon.tsx';
import { TrendChart, type TrendPoint, type TrendSeriesKey } from './charts.tsx';
import { kouTitle, num, td, th } from './shared.ts';

const AMOUNT_LABEL: Record<(typeof JIKOU_AMOUNT)[number], string> = {
  eq_revised: '次の年度の前年度予算額が、前の年度の改予算額と一致',
  eq_budget: '次の年度の前年度予算額が、前の年度の政府案の額と一致',
  ne: '次の年度の前年度予算額が、前の年度の改予算額・政府案の額のどちらとも違う',
  zero: '次の年度の前年度予算額が 0（比べない）',
  'n/a': '比べられない（どちらかに値が無い）',
};

/** 項の額（円）のうち、事項の計と比べる値。事項の額は千円 */
const KOU_VALUE: Record<JikouMeasure, keyof LifecycleValues> = { request: 'request_amount', budget: 'budget_amount', revised: 'revised_amount', suppNet: 'supp_net', prev: 'budget_prev' };
/** 事項に決算は無い。グラフ・表に出す段階（決算を除く） */
const CHART_SERIES: readonly TrendSeriesKey[] = ['request', 'budget', 'revised'];
/** 項の額と照合する値 */
const CHECKED: readonly JikouMeasure[] = ['request', 'budget', 'revised'];

const cell = (v: number | null): string => (v === null ? '—' : v === 0 ? '0円' : formatSen(v));
const exact = (v: number): string => `${v.toLocaleString('ja-JP')} 千円`;
const rowKey = (r: JikouRow): string => `${r.firstYear}|${r.name}`;
const span = (r: JikouRow): string => `FY${r.firstYear}${r.firstYear === r.lastYear ? '' : `〜FY${r.lastYear}`}`;
const MEASURE = (k: JikouMeasure) => JIKOU_MEASURES.find(m => m.key === k)!;

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
function AmountCell({ jikou, row, year, measure, current }: { jikou: JikouIndex; row: JikouRow; year: number; measure: JikouMeasure; current: boolean }) {
  const c = row.cells.get(year);
  const v = jikouAmount(jikou, c, measure);
  const gap = v === null && c ? absent(jikou, c.node, measure) : null;
  return (
    <td className={`${num} ${current ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`} title={v === null ? (gap ? gap.hint : c ? '現行データに値なし' : 'この年度に事項なし') : exact(v)}>
      {gap?.label ? <span className="text-[10px] text-neutral-500">{gap.label}</span> : cell(v)}
    </td>
  );
}

/** 選んだ事項を選ぶコンボボックス（選択式）。見た目は年度の選択に揃える */
function JikouSelect({ rows, value, onChange, year, jikou }: { rows: readonly JikouRow[]; value: string; onChange: (key: string) => void; year: number; jikou: JikouIndex }) {
  // 選んだ年度に値があれば、その額（政府案、無ければ補正後、概算要求）を添えて、大きさの見当がつくようにする
  const hint = (r: JikouRow): string => {
    const c = r.cells.get(year);
    if (!c) return span(r);
    for (const [m, label] of [['budget', '政府案'], ['revised', '補正後'], ['request', '概算要求']] as const) {
      const v = jikouAmount(jikou, c, m);
      if (v !== null) return `FY${year} ${label} ${formatSen(v)}`;
    }
    return span(r);
  };
  return (
    <div className="relative">
      <select
        id="jikou-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-black/10 bg-white/90 pl-2.5 pr-7 text-xs text-neutral-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-200"
      >
        {rows.map(r => <option key={rowKey(r)} value={rowKey(r)}>{r.name}{r.renamed ? '（名称が変わった）' : ''} · {hint(r)}</option>)}
      </select>
      <Icon name="arrow_drop_down" size={20} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

/**
 * 項の下の事項。年度推移のタブと同じ見せ方: 事項をコンボボックスで選び、選んだ事項の概算要求・政府案・補正後を、グラフと、年度を縦に並べた表で見る。
 * 事項に決算は無い（決算は項と目の単位）。値の無い所は「—」（0 とは別）。事項の計は項の額と照合する（折りたたみ）。この項のすべての事項は、年度 × 値の表（折りたたみ）。
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
  const members = useMemo(() => chain.members.map(i => ({ i, k: kous[i]! })), [chain, kous]);
  const table = useMemo(() => (jikou ? jikouTable(jikou, members.map(m => m.k.id)) : null), [jikou, members]);
  const [pick, setPick] = useState<string | null>(null);
  // 選んだ事項（選び直していない・別の項に移って無くなったときは、一番上の事項）
  const row = table ? table.rows.find(r => rowKey(r) === pick) ?? table.rows[0] : undefined;
  const memberYears = members.map(m => m.k.year);
  const years = table?.years ?? memberYears;
  const noData = memberYears.filter(y => !years.includes(y));
  const top = useRef<HTMLElement>(null);

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">項の下の事項（概算要求・予算書の当初予算・補正）。年度は、項の年度推移で確認できた範囲（FY{memberYears[0]}{memberYears.length > 1 ? `〜FY${memberYears[memberYears.length - 1]}` : ''}）のうち、事項のある年度。</p>
      </div>

      {failed ? <p className="text-red-700">事項の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>
        : loading || !jikou || !table ? <p className="text-neutral-500">事項を読み込み中…</p>
        : !row ? <p className="text-neutral-500">この項の事項は、現行のデータにありません。{years.length === 0 ? '予算書の事項は FY2026 まで、概算要求書の事項は FY2023 以降です。' : ''}</p>
        : (
          <>
            <section ref={top} className="flex flex-col gap-1.5" aria-label="事項の選択">
              <label className="font-semibold" htmlFor="jikou-select">事項（{table.rows.length}）</label>
              <JikouSelect rows={table.rows} value={rowKey(row)} onChange={setPick} year={kou.year} jikou={jikou} />
              <p className="text-[11px] text-neutral-500">{span(row)}{row.renamed ? ' · 名称が変わっています（下の表に年度ごとの名前）' : ''}</p>
            </section>

            <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
              <h3 className="font-semibold">段階ごとの額</h3>
              <JikouChart row={row} years={years} jikou={jikou} current={kou.year} onSelect={y => { const m = members.find(x => x.k.year === y); if (m && m.k.id !== kou.id) onNavigate(m.k.id); }} />
              <p className="text-[11px] text-neutral-500">
                年度の列（または横軸の年）を押すと、その年度の項に移ります。縦軸は 0 から。値が無い年度・段階は、線をつながず、印も置いていません（0 ではありません）。決算は事項の単位が無いので、描いていません（項の決算は、項の「年度推移」で見られます）。
              </p>
            </section>

            <section className="flex flex-col gap-2" aria-label="年度の表">
              <h3 className="font-semibold">年度ごとの額と対応</h3>
              <JikouYearTable row={row} years={years} jikou={jikou} kouId={kou.id} members={members} onNavigate={onNavigate} />
              <p className="text-[11px] text-neutral-500">
                行を押すと、その年度の項に移ります。「—」は現行のデータに値が無いこと（0 とは別）。「対応」は、前の年度の事項との対応の根拠（確定したものだけ）で、値の上に重ねたマウスで詳細が出ます。補正の差引額は、補正が複数回の年度は、その事項が載る最後の回の値です。
              </p>
            </section>

            <Reconcile table={table} jikou={jikou} years={years} members={members} valuesOf={valuesOf} current={kou.year} />
            <AllJikou table={table} jikou={jikou} years={years} members={members} kou={kou} onNavigate={onNavigate} onPick={key => { setPick(key); top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }} picked={rowKey(row)} />
          </>
        )}

      <section className="flex flex-col gap-1 rounded border border-neutral-200 p-2 text-[11px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-300" aria-label="この表にないもの">
        <p className="font-semibold">この表にないもの</p>
        <ul className="list-disc pl-4">
          <li>事項の単位の決算。決算は項と目の単位で（事項の列が無い）、目は事項の下に結べないので、項の「1年の推移」と「年度推移」で見る。</li>
          <li>概算要求の事項は、概算要求書（総表）の要求額。予算書の事項と、同じ項の中で名前でつないでいる（つながらない事項は「要求のみ」「予算のみ」）。要求書の前年度予算額は、事項の単位では出していない。名前が変わった事項は、つながらない。</li>
          <li>補正後・補正の差引額は、補正の事項の記録がある年度（FY2024 まで）の事項だけ。FY2025 以降は、現行のデータに補正の事項が無い。補正が複数回の年度は、その事項が載る最後の回の値で、年度の合計ではない。項の差引額は、項が載る最後の回（事項の無い「項のみ」の行を含む）の値なので、補正の差引額の事項の計が項の額と合わないことがある。</li>
          {noData.length > 0 && table && table.rows.length > 0 && <li>{noData.map(y => `FY${y}`).join('・')}: 事項のデータが無い年度（その年度に、予算書にも概算要求書にも、この項の事項が無い）。</li>}
          <li>年度の間の対応は、確定したもの（同じ鍵、または名前と額の根拠がそろった 1 対 1）だけでたどっている。対応が確定しない事項は、別の行になる。事業が同じとは限らない。</li>
        </ul>
      </section>
    </div>
  );
}

/** 選んだ事項の年度推移（折れ線）。値は千円を円にして、項の年度推移のグラフと同じ軸にする */
function JikouChart({ row, years, jikou, current, onSelect }: { row: JikouRow; years: readonly number[]; jikou: JikouIndex; current: number; onSelect: (year: number) => void }) {
  const points = useMemo<TrendPoint[]>(() => years.map(year => {
    const c = row.cells.get(year);
    const yen = (m: JikouMeasure): number | undefined => { const v = jikouAmount(jikou, c, m); return v === null ? undefined : v * 1000; };
    return { year, request: yen('request'), budget: yen('budget'), revised: yen('revised'), spent: undefined };
  }), [row, years, jikou]);
  return <TrendChart points={points} current={current} onSelect={onSelect} series={CHART_SERIES} />;
}

/** 選んだ事項の、年度を縦にした表（項の年度推移の表と同じ）。年度の行を押すと、その年度の項に移る */
function JikouYearTable({ row, years, jikou, kouId, members, onNavigate }: { row: JikouRow; years: readonly number[]; jikou: JikouIndex; kouId: string; members: readonly { i: number; k: LifecycleKou }[]; onNavigate: (id: string) => void }) {
  const cols: { m: JikouMeasure; label: string }[] = [{ m: 'request', label: '要求' }, { m: 'budget', label: '政府案' }, { m: 'revised', label: '補正後' }, { m: 'suppNet', label: '補正の差引' }];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th className={th}>年度</th>
            <th className={`${th} min-w-[7rem]`}>事項名（対応）</th>
            {cols.map(c => <th key={c.m} className={`${th} whitespace-nowrap text-right`} title={MEASURE(c.m).hint}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map((y, n) => {
            const m = members.find(x => x.k.year === y)!;
            const selected = m.k.id === kouId;
            const c = row.cells.get(y);
            const node = c ? jikou.data.nodes[c.node] : undefined;
            const prevCell = n > 0 ? row.cells.get(years[n - 1]!) : undefined;
            const prevNode = prevCell ? jikou.data.nodes[prevCell.node] : undefined;
            const renamed = !!node && !!prevNode && node[2] !== prevNode[2];
            const link = c?.link === undefined ? undefined : jikou.data.links[c.link];
            return (
              <tr
                key={y}
                tabIndex={0}
                aria-selected={selected}
                title={selected ? undefined : `FY${y} の項を開く`}
                onClick={() => { if (!selected) onNavigate(m.k.id); }}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onNavigate(m.k.id); } }}
                className={`border-t border-neutral-100 align-top dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
              >
                <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{y}</td>
                <td className={td}>
                  {node ? (
                    <>
                      <span className={renamed ? 'font-medium text-amber-700 dark:text-amber-400' : ''} title={renamed ? `前の年度の事項名: ${prevNode![2]}` : undefined}>{node[2]}</span>
                      {renamed && <span className="ml-1 text-[10px] text-neutral-500">（名称が変わった）</span>}
                      {link && <span className="block text-[10px] text-neutral-500" title={`${jikouEvidenceOf(link[2]).map(e => JIKOU_EVIDENCE_LABEL[e]).join(' / ')}。${AMOUNT_LABEL[JIKOU_AMOUNT[link[3]]!]}`}>対応: {jikouEvidenceOf(link[2]).map(e => (e === 'same_key' ? '同じ鍵' : JIKOU_EVIDENCE_LABEL[e])).join('・')}</span>}
                    </>
                  ) : <span className="text-neutral-400">この年度に事項なし</span>}
                </td>
                {cols.map(col => <AmountCell key={col.m} jikou={jikou} row={row} year={y} measure={col.m} current={false} />)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
        <p className="text-[11px] text-neutral-500">事項の計は、値のある事項だけの合計で、一部の事項にしか値が無い年度は、その数を添えます。項の額は、概算要求が総表、政府案・補正後が予算書の目の合計（導出）で、事項の計と合うはずです。値が無い年度は「—」。</p>
      </div>
    </details>
  );
}

/** この項のすべての事項を、年度 × 値で並べた表。行を押すと、その事項に選び直す */
function AllJikou({ table, jikou, years, members, kou, onNavigate, onPick, picked }: { table: JikouTable; jikou: JikouIndex; years: readonly number[]; members: readonly { i: number; k: LifecycleKou }[]; kou: LifecycleKou; onNavigate: (id: string) => void; onPick: (key: string) => void; picked: string }) {
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
                  <tr key={rowKey(r)} onClick={() => onPick(rowKey(r))} title="この事項を選ぶ" className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60 ${rowKey(r) === picked ? 'bg-neutral-50 dark:bg-neutral-800/60' : ''}`}>
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
          <p className="text-[11px] text-neutral-500">{MEASURE(measure).hint}。行を押すと、その事項を選びます。</p>
        </div>
      )}
    </details>
  );
}
