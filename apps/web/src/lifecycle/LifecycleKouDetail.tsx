import { useMemo, useState } from 'react';
import {
  formatSen,
  jikouTable,
  jikouTotals,
  lifecycleRowAmounts,
  mokuChartSum,
  mokuKouTable,
  type JikouIndex,
  type JikouMeasure,
  type LifecycleChain,
  type LifecycleKou,
  type LifecycleLink,
  type LifecycleLinkEvidence,
  type LifecycleValues,
  type MokuIndex,
  type MokuMeasure,
} from '@nihon-no-yosan/core';
import { MultiSelectCombo } from '../components/MultiSelectCombo.tsx';
import { useYearKeys } from '../components/useListKeys.ts';
import { TrendChart, type TrendPoint } from './charts.tsx';
import { chosenOf, jikouLabels, jikouRowKey, mokuLabels, mokuRowKey, pickedFromLabels, selectedLabels, sortMokuRows } from './kouBreakdown.ts';
import { kouTitle, num, td, th } from './shared.ts';

const SHORT_EVIDENCE: Record<LifecycleLinkEvidence, string> = {
  same_key: '同じ鍵',
  same_key_succession: '同じ鍵（所属を引き継ぎ先に読み替え）',
  same_name_other_code: '同じ名前（項コードが違う）',
  same_name_other_org: '同じ名前（所管・組織が違う）',
  prev_amount_eq_revised: '前年度予算額 = 前年の改予算額',
  prev_amount_eq_budget: '前年度予算額 = 前年の政府案',
  same_code_other_name: '同じ項コード（項名が違う）',
  similar_name: '近い名前',
};

/** 表の列（概算要求 → 政府案 → 補正後 → 前年度繰越 → 決算 → 翌年度繰越）。`key` は、`Amounts` のキー */
type ColKey = 'request' | 'budget' | 'revised' | 'carriedIn' | 'spent' | 'carried';
const COLS: { key: ColKey; label: string; title: string }[] = [
  { key: 'request', label: '要求', title: '概算要求' },
  { key: 'budget', label: '政府案', title: '政府案' },
  { key: 'revised', label: '補正後', title: '補正後' },
  { key: 'carriedIn', label: '前年度繰越', title: '前年度繰越額（決算）' },
  { key: 'spent', label: '決算', title: '決算（支出済）' },
  { key: 'carried', label: '翌年度繰越', title: '翌年度繰越額（決算）' },
];
/** 1 年度の額（円）。値が無いときは undefined（0 とは別） */
type Amounts = Record<ColKey, number | undefined>;
const NO_AMOUNTS: Amounts = { request: undefined, budget: undefined, revised: undefined, carriedIn: undefined, spent: undefined, carried: undefined };
const MOKU_KEY: Record<ColKey, MokuMeasure> = { request: 'request', budget: 'budget', revised: 'revised', carriedIn: 'carriedIn', spent: 'spent', carried: 'carried' };
const JIKOU_KEY: Partial<Record<ColKey, JikouMeasure>> = { request: 'request', budget: 'budget', revised: 'revised' };

const cellAmount = (yen: number | undefined): string => (yen === undefined ? '—' : yen === 0 ? '0円' : formatSen(yen / 1000));
const NONE: readonly never[] = [];

/**
 * 項の詳細（右ペイン。中ペインが「項」のとき）。事項の詳細・目の詳細と同じ構成: ヘッダー、事項・目の選択、段階ごとの額の年度推移のグラフ、年度を縦に並べた表。
 * 事項と目は、同じ項の別の区分けで、「事項 × 目」の額は無い。そのため、選択は同時には絞れない（片方を絞ると、もう片方はすべてに戻る）。
 * - 事項・目ともすべて（既定。項を選ぶたび）: 項の額（概算要求・政府案・補正後と、決算の支出済・繰越額）。
 * - 事項を絞る: 選んだ事項の合計（概算要求・政府案・補正後。事項に決算は無いので、決算・繰越額は値なし）。
 * - 目を絞る: 選んだ目の合計（概算要求・政府案・補正後・支出済・繰越額）。
 * 値の無い段階は「—」（0 とは別）。年度の間の対応は、行ごとに根拠を書く。J / K（右ペインにフォーカスがあるとき）で、前後の年度に移る。
 */
export function LifecycleKouDetail({ kou, chain, kous, valuesOf, links, jikou, jikouFailed, moku, mokuFailed, onNavigate }: {
  kou: LifecycleKou | null;
  chain: LifecycleChain | null;
  kous: readonly LifecycleKou[];
  valuesOf: ReadonlyMap<number, LifecycleValues>;
  links: readonly LifecycleLink[];
  /** 事項・目のデータの索引。読み込み中は null（失敗は `*Failed`） */
  jikou: JikouIndex | null;
  jikouFailed: boolean;
  moku: MokuIndex | null;
  mokuFailed: boolean;
  onNavigate: (id: string) => void;
}) {
  const rows = useMemo(() => (chain ? chain.members.map(i => ({ i, k: kous[i]!, v: valuesOf.get(i), a: lifecycleRowAmounts(valuesOf.get(i) ?? {}) })) : []), [chain, kous, valuesOf]);
  // 前の年度との対応（確定した 1 組）の根拠
  const evidenceTo = useMemo(() => {
    const m = new Map<number, LifecycleLinkEvidence[]>();
    for (const l of links) if (l.status === 'RESOLVED' && l.from >= 0 && l.to >= 0) m.set(l.to, l.evidence);
    return m;
  }, [links]);

  // 事項・目の行（項の確定した対応でたどった年度をまたぐ）と、選択肢の名前
  const year = kou?.year ?? 0;
  const jTable = useMemo(() => (jikou ? jikouTable(jikou, rows.map(r => r.k.id)) : null), [jikou, rows]);
  const jRows = jTable?.rows ?? NONE;
  const jLabels = useMemo(() => (jikou ? jikouLabels(jRows, year, jikou) : []), [jikou, jRows, year]);
  const mRows = useMemo(() => (moku ? sortMokuRows(mokuKouTable(moku, rows.map(r => ({ id: r.k.id, year: r.k.year }))), moku.data, year) : []), [moku, rows, year]);
  const mLabels = useMemo(() => (moku ? mokuLabels(mRows, year, moku.data) : []), [moku, mRows, year]);

  // 選択（空 = すべて）。項（年度をまたぐ同じ項の流れ）を変えたら、すべてに戻す。同じ流れの別の年度に移っても、選んだままにする
  const chainId = chain ? kous[chain.members[0]!]!.id : '';
  const [sel, setSel] = useState<{ chain: string; jikou: string[]; moku: string[] }>({ chain: '', jikou: [], moku: [] });
  const picked = sel.chain === chainId ? sel : { chain: chainId, jikou: [], moku: [] };
  const [openJ, setOpenJ] = useState(false);
  const [openM, setOpenM] = useState(false);
  const jChosen = useMemo(() => chosenOf(jRows, picked.jikou, jikouRowKey), [jRows, picked.jikou]);
  const mChosen = useMemo(() => chosenOf(mRows, picked.moku, mokuRowKey), [mRows, picked.moku]);
  const mode: 'kou' | 'jikou' | 'moku' = picked.jikou.length > 0 ? 'jikou' : picked.moku.length > 0 ? 'moku' : 'kou';

  // 年度ごとの額（選択に連動する）
  const amounts = useMemo<Amounts[]>(() => {
    if (mode === 'jikou' && jikou && jTable) {
      const chosenTable = { years: jTable.years, rows: jChosen };
      const totals = new Map<JikouMeasure, Map<number, number | null>>();
      for (const m of Object.values(JIKOU_KEY)) totals.set(m, new Map(jikouTotals(jikou, chosenTable, m).map(t => [t.year, t.sum])));
      return rows.map(({ k }) => {
        const out: Amounts = { ...NO_AMOUNTS };
        for (const [col, m] of Object.entries(JIKOU_KEY) as [ColKey, JikouMeasure][]) { const s = totals.get(m)!.get(k.year); if (s !== null && s !== undefined) out[col] = s * 1000; }
        return out;
      });
    }
    if (mode === 'moku' && moku) {
      return rows.map(({ k }) => {
        const nodes = mChosen.flatMap(r => (r.cells.has(k.year) ? [r.cells.get(k.year)!] : []));
        const all = mRows.every(r => !r.cells.has(k.year) || mChosen.includes(r)); // その年度の目を全部選んだ（概算要求・決算は、値のある目を全部足す）
        const out: Amounts = { ...NO_AMOUNTS };
        for (const col of COLS) { const s = mokuChartSum(moku.data, nodes, MOKU_KEY[col.key], all); if (s !== null) out[col.key] = s * 1000; }
        return out;
      });
    }
    return rows.map(({ a, v }) => ({ request: a.request, budget: a.budget, revised: a.revised, carriedIn: v?.carryover_in, spent: a.spent, carried: v?.carryover_out }));
  }, [mode, jikou, jTable, jChosen, moku, mRows, mChosen, rows]);
  const points = useMemo<TrendPoint[]>(() => rows.map(({ k }, n) => ({ year: k.year, ...amounts[n]! })), [rows, amounts]);

  // J / K で移る年度: 項の確定した対応でたどった年度
  const years = useMemo(() => rows.map(r => r.k.year), [rows]);
  useYearKeys(years, kou?.year ?? null, y => { const t = rows.find(r => r.k.year === y); if (t && t.k.id !== kou?.id) onNavigate(t.k.id); });
  if (!kou || !chain) return <p className="p-4 text-xs text-neutral-500">一覧から項を選んでください。</p>;

  const goYear = (y: number): void => { const t = rows.find(r => r.k.year === y); if (t && t.k.id !== kou.id) onNavigate(t.k.id); };
  const setJikou = (next: string[]): void => setSel({ chain: chainId, jikou: next, moku: next.length > 0 ? [] : picked.moku });
  const setMoku = (next: string[]): void => setSel({ chain: chainId, jikou: next.length > 0 ? [] : picked.jikou, moku: next });
  const caption = mode === 'jikou' ? (jChosen.length === 0 ? '事項を選んでください' : `選んだ ${jChosen.length} 事項の合計（決算は事項の単位が無いので、値なし）`)
    : mode === 'moku' ? (mChosen.length === 0 ? '目を選んでください' : `選んだ ${mChosen.length} 目の合計`) : null;
  const sum = mode === 'kou' ? '' : mode === 'jikou' ? '（選んだ事項の合計）' : '（選んだ目の合計）';
  const noValue = (col: ColKey): string => (mode === 'jikou' && !(col in JIKOU_KEY) ? '事項に決算は無い（決算は項と目の単位）' : '値なし');

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
      </div>

      <section className="flex flex-col gap-1.5" aria-label="事項・目の選択">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1" title="事項と目は、同じ項の別の区分けで、事項 × 目の額は無い。片方を絞ると、もう片方はすべてに戻る">
            <p className="font-semibold">事項{jikou ? `（${jRows.length}）` : ''}</p>
            <MultiSelectCombo
              label="事項"
              options={jLabels}
              selected={selectedLabels(jRows, jLabels, picked.jikou, jChosen)}
              onChange={next => setJikou(pickedFromLabels(next, jRows, jLabels, jikouRowKey))}
              disabled={jRows.length === 0}
              open={openJ}
              onOpenChange={setOpenJ}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1" title="事項と目は、同じ項の別の区分けで、事項 × 目の額は無い。片方を絞ると、もう片方はすべてに戻る">
            <p className="font-semibold">目{moku ? `（${mRows.length}）` : ''}</p>
            <MultiSelectCombo
              label="目"
              options={mLabels}
              selected={selectedLabels(mRows, mLabels, picked.moku, mChosen)}
              onChange={next => setMoku(pickedFromLabels(next, mRows, mLabels, mokuRowKey))}
              disabled={mRows.length === 0}
              open={openM}
              onOpenChange={setOpenM}
            />
          </div>
        </div>
        {(jikouFailed || mokuFailed) && <p className="text-[11px] text-red-700">{jikouFailed ? '事項' : '目'}の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>}
        {!jikouFailed && !mokuFailed && (!jikou || !moku) && <p className="text-[11px] text-neutral-500">{!jikou ? '事項' : '目'}を読み込み中…</p>}
        {caption && <p className="text-[11px] text-neutral-500">{caption}</p>}
      </section>

      <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
        <h3 className="font-semibold">段階ごとの額{sum}</h3>
        <TrendChart points={points} current={kou.year} onSelect={goYear} />
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの額と対応{sum}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                <th className={`${th} min-w-[7rem]`}>項名（所属・対応）</th>
                {COLS.map(c => <th key={c.key} className={`${th} whitespace-nowrap text-right`} title={c.title}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ i, k }, n) => {
                const prev = n > 0 ? rows[n - 1]!.k : null;
                const selected = k.id === kou.id;
                const ev = evidenceTo.get(i);
                return (
                  <tr
                    key={k.id}
                    tabIndex={0}
                    aria-selected={selected}
                    title={selected ? undefined : `FY${k.year} を開く`}
                    onClick={() => { if (!selected) onNavigate(k.id); }}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onNavigate(k.id); } }}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                  >
                    <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{k.year}</td>
                    <td className={td}>
                      <span className={prev && prev.name !== k.name ? 'font-medium text-amber-700 dark:text-amber-400' : ''} title={prev && prev.name !== k.name ? `前の年度の項名: ${prev.name}` : undefined}>{k.name}</span>
                      {prev && prev.name !== k.name && <span className="ml-1 text-[10px] text-neutral-500">（名称が変わった）</span>}
                      {(!prev || kouTitle(prev) !== kouTitle(k)) && <span className="block text-[10px] text-neutral-500">{kouTitle(k)}</span>}
                      {n > 0 && <span className="block text-[10px] text-neutral-500">対応: {ev ? ev.map(e => SHORT_EVIDENCE[e]).join('・') : ''}</span>}
                    </td>
                    {COLS.map(c => {
                      const v = amounts[n]![c.key];
                      return <td key={c.key} className={`${num} ${v === undefined ? 'text-neutral-300 dark:text-neutral-600' : ''}`} title={v === undefined ? noValue(c.key) : `${v.toLocaleString('ja-JP')} 円`}>{cellAmount(v)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
