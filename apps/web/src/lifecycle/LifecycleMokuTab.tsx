import { useMemo, useState } from 'react';
import {
  MOKU_FLAG,
  MOKU_MEASURES,
  MOKU_REQUEST_COVERAGE_LABEL,
  formatSen,
  mokuKouTable,
  mokuMeasure,
  mokuSettleNote,
  mokuSum,
  mokuSuppNote,
  mokuValue,
  type LifecycleChain,
  type LifecycleKou,
  type LifecycleMokuData,
  type LifecycleMokuNode,
  type LifecycleValues,
  type MokuIndex,
  type MokuKouRow,
  type MokuMeasure,
} from '@nihon-no-yosan/core';
import { MultiSelectCombo, NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { TrendChart, type TrendPoint } from './charts.tsx';
import { kouTitle, num, td, th } from './shared.ts';

const exact = (v: number): string => `${v.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} 千円`;
const amount = (v: number): string => (v === 0 ? '0円' : formatSen(v));

/** 目の値が無い理由（表示用） */
function why(data: LifecycleMokuData, n: LifecycleMokuNode, key: MokuMeasure): string {
  if (key === 'revised') return mokuSuppNote(data, n) ?? '値なし';
  if (key === 'current' || key === 'spent' || key === 'unused') return mokuSettleNote(data, n) ?? '値なし';
  if (n[13] & MOKU_FLAG.settlePart) return `決算の共管別の行（${key === 'request' ? '概算要求' : '政府案'}は、共管別に分かれていない）`;
  if (key === 'request') {
    if (!data.requestYears.includes(n[1])) return 'この年度の概算要求の目は、データに無い';
    return '概算要求書に、同じ名前の目が無い（概算要求の目の取れ方を見る）';
  }
  if (n[13] & MOKU_FLAG.requestOnly) return '概算要求書にだけある目';
  return '当初予算に無い目（補正か決算で出る目）';
}

function Cell({ data, node, measure, current }: { data: LifecycleMokuData; node: number | undefined; measure: MokuMeasure; current?: boolean }) {
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

function Marks({ n }: { n: LifecycleMokuNode }) {
  const part = partLabel(n[4]);
  return (
    <>
      {n[13] & MOKU_FLAG.settlePart ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="決算の共管別の行">共管: {part}</span> : null}
      {n[13] & MOKU_FLAG.settleSplit ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="決算は共管の組織ごとの行に分かれている">決算は共管別</span> : null}
      {n[13] & MOKU_FLAG.requestOnly ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="概算要求書にだけある目">要求のみ</span> : null}
      {n[13] & MOKU_FLAG.nameOnly ? <span className="ml-1 text-[10px] text-neutral-400" title="段階の間で分類コードが違い、目名だけで結んだ">名前</span> : null}
    </>
  );
}

/** 目の行のキー（同じ項の流れの中で一意。目名・共管・最初の年度） */
const rowKey = (r: MokuKouRow): string => `${r.name}|${r.part}|${Math.min(...r.cells.keys())}`;

/** 選択肢の表示名（目名に、選んだ年度の額 = 政府案、無ければ補正後・歳出予算現額・概算要求 を添える。その年度に無ければ、目のある年度の範囲）。同じ表示名には、行の番号を添える */
function mokuLabels(rows: readonly MokuKouRow[], year: number, data: LifecycleMokuData): string[] {
  const hint = (r: MokuKouRow): string => {
    const i = r.cells.get(year);
    if (i !== undefined) {
      for (const key of ['budget', 'revised', 'current', 'request'] as const) {
        const v = mokuValue(data.nodes[i]!, key);
        if (v !== null) return `FY${year} ${mokuMeasure(key).label} ${amount(v)}`;
      }
    }
    const ys = [...r.cells.keys()];
    const from = Math.min(...ys), to = Math.max(...ys);
    return `FY${from}${from === to ? '' : `〜FY${to}`}`;
  };
  const base = rows.map(r => `${r.name}${r.part ? `（共管: ${partLabel(r.part)}）` : ''} · ${hint(r)}`);
  const seen = new Map<string, number>();
  for (const l of base) seen.set(l, (seen.get(l) ?? 0) + 1);
  return base.map((l, i) => ((seen.get(l) ?? 0) > 1 ? `${l} [${i + 1}]` : l));
}

/**
 * グラフに描く値（千円）。値の無い目が、その値を別の行で持つ（決算の共管別の行・その元の目）か、その段階に無い目（概算要求書にだけある目・当初予算に無い目）なら、足さずに進める。
 * それ以外で値の無い目（外N目にまとめられた目の補正後、決算に無い目など）があれば、額が分からないので null（点を描かない）。
 * ただし、その年度の目を全部選んだとき（`all`）の概算要求・決算は、値のある目を全部足す。概算要求書・決算書の目の行は、どれも目の行のどれか 1 つに置いている（名前の違う目は「要求のみ」の目に、共管別は共管別の行に）ので、足せば項の額になる。
 * 補正後は、外N目にまとめられた目の行が無いので、全部選んでも足せない。
 */
function chartSum(data: LifecycleMokuData, nodes: readonly number[], key: MokuMeasure, all: boolean): number | null {
  if (all && key !== 'revised') return nodes.reduce<number | null>((sum, i) => { const v = mokuValue(data.nodes[i]!, key); return v === null ? sum : (sum ?? 0) + v; }, null);
  let sum: number | null = null;
  for (const i of nodes) {
    const n = data.nodes[i]!;
    const v = mokuValue(n, key);
    if (v !== null) { sum = (sum ?? 0) + v; continue; }
    const settle = key === 'current' || key === 'spent' || key === 'unused';
    if (settle ? n[13] & (MOKU_FLAG.settleSplit | MOKU_FLAG.requestOnly) : n[13] & MOKU_FLAG.settlePart) continue;
    if (key === 'budget') continue; // 政府案の無い目は、当初予算に無い目（補正・決算で出る目）か、概算要求書にだけある目
    if (key === 'revised' && n[13] & MOKU_FLAG.requestOnly) continue;
    // 当初予算にも補正にも無い目（決算にだけある目）は、概算要求・補正後の段階に無い
    if ((key === 'request' || key === 'revised') && n[5] === null && !(n[13] & (MOKU_FLAG.suppItem | MOKU_FLAG.requestOnly))) continue;
    // 当初予算に無く補正で出る目は、概算要求の段階に無い
    if (key === 'request' && n[5] === null && n[13] & MOKU_FLAG.suppItem) continue;
    return null;
  }
  return sum;
}

/** 選んだ目（行）。値の約束は、チェックボックス付きコンボボックスと同じ: null = まだ選んでいない（一番上の目）、空 = すべて、[NONE_SELECTED] = なし、それ以外 = 行のキー */
function chosenRows(rows: readonly MokuKouRow[], picked: string[] | null): MokuKouRow[] {
  if (picked === null) return rows.slice(0, 1);
  if (picked.includes(NONE_SELECTED)) return [];
  if (picked.length === 0) return [...rows];
  const set = new Set(picked);
  const sel = rows.filter(r => set.has(rowKey(r)));
  return sel.length > 0 ? sel : rows.slice(0, 1); // 別の項に移って、選んだ目が無いとき
}

/**
 * 項の下の目（項の右ペインの「目」タブ）。
 * 最初: 目をコンボボックス（チェックボックス付きの複数選択）で選び、選んだ目の概算要求・政府案・補正後・決算（支出済）の年度推移をグラフで見る（2 つ以上なら、値のある目だけ足した合計）。
 * 次: 選んだ年度の目の、概算要求・政府案・補正後・決算の表。目の計と項の額を並べる（値の無い目は計に入れず、数を添える）。
 * 下: 項の確定した対応でたどった年度の、目 × 年度の表（値を切り替える）。目のそろえ方は `mokuKouTable`（目の改称・統合は見ていない）。
 * 目の行を選ぶと、中ペインの目の一覧で、その目を開く。値の無い所は「—」（0 とは別）で、ホバーで理由。
 */
export function LifecycleMokuTab({ kou, chain, kous, valuesOf, moku, loading, failed, onNavigate, onOpenMoku }: {
  kou: LifecycleKou;
  chain: LifecycleChain;
  kous: readonly LifecycleKou[];
  valuesOf: ReadonlyMap<number, LifecycleValues>;
  /** 目のデータ（`lifecycle/moku.json.gz`）の索引。読み込み中・失敗のときは null */
  moku: MokuIndex | null;
  loading: boolean;
  failed: boolean;
  onNavigate: (id: string) => void;
  /** 目を、中ペインの目の一覧で開く */
  onOpenMoku: (node: number) => void;
}) {
  const [measure, setMeasure] = useState<MokuMeasure>('budget');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const members = useMemo(() => chain.members.map(i => ({ i, k: kous[i]! })), [chain, kous]);
  const table = useMemo(() => (moku ? mokuKouTable(moku, members.map(({ k }) => ({ id: k.id, year: k.year }))) : []), [moku, members]);
  const self = members.find(m => m.k.id === kou.id);
  const kouValues = self ? valuesOf.get(self.i) ?? {} : {};
  const nodes = useMemo(() => {
    if (!moku) return [];
    const k = moku.kouOf.get(kou.id);
    const list = k === undefined ? [] : [...(moku.nodesOf.get(k) ?? [])];
    const size = (i: number) => { const n = moku.data.nodes[i]!; return Math.max(0, n[12] ?? 0, n[5] ?? 0, n[6] ?? 0, n[8] ?? 0); };
    return list.sort((a, b) => size(b) - size(a) || a - b);
  }, [moku, kou.id]);
  // 目の行: 選んだ年度の大きさ（概算要求・政府案・補正後・歳出予算現額の最大）の大きい順。その年度に無い目は、どこかの年度の大きさの順で後ろに
  const rows = useMemo(() => {
    if (!moku) return [];
    const size = (i: number) => { const n = moku.data.nodes[i]!; return Math.max(0, n[12] ?? 0, n[5] ?? 0, n[6] ?? 0, n[8] ?? 0); };
    const at = (cells: Map<number, number>, y?: number): number => {
      const vs = (y === undefined ? [...cells.values()] : cells.has(y) ? [cells.get(y)!] : []).map(size);
      return vs.length === 0 ? -1 : Math.max(...vs);
    };
    return [...table].sort((a, b) => at(b.cells, kou.year) - at(a.cells, kou.year) || at(b.cells) - at(a.cells));
  }, [moku, table, kou.year]);
  const labels = useMemo(() => (moku ? mokuLabels(rows, kou.year, moku.data) : []), [moku, rows, kou.year]);
  const chosen = useMemo(() => chosenRows(rows, picked), [rows, picked]);
  const points = useMemo<TrendPoint[]>(() => {
    if (!moku) return [];
    const yen = (key: MokuMeasure, year: number): number | undefined => {
      const all = rows.every(r => !r.cells.has(year) || chosen.includes(r));
      const sum = chartSum(moku.data, chosen.flatMap(r => (r.cells.has(year) ? [r.cells.get(year)!] : [])), key, all);
      return sum === null ? undefined : sum * 1000;
    };
    return members.map(({ k }) => ({ year: k.year, request: yen('request', k.year), budget: yen('budget', k.year), revised: yen('revised', k.year), spent: yen('spent', k.year) }));
  }, [moku, rows, chosen, members]);

  if (failed) return <p className="p-4 text-xs text-red-700">目の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading || !moku) return <p className="p-4 text-xs text-neutral-500">目を読み込み中…</p>;
  const { data } = moku;
  const coverage = moku.coverageOf.get(kou.id);
  const hasYear = data.years.includes(kou.year);
  const m = mokuMeasure(measure);

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-neutral-500">
          {!hasYear && <li>この年度の目は、データに無い（予算書が無い年度）</li>}
          {hasYear && nodes.length === 0 && <li>この項の目は、データに無い{kou.requestOnly ? '（概算要求書にだけある項。概算要求書の目は、まだ入れていない）' : ''}</li>}
          {kou.requestOnly ? null : data.requestYears.includes(kou.year)
            ? <li>概算要求の目の取れ方: {coverage ? MOKU_REQUEST_COVERAGE_LABEL[coverage] : '概算要求書の項と突合できていない項'}</li>
            : <li>この年度の概算要求の目は、データに無い</li>}
          {!data.suppYears.includes(kou.year) && <li>この年度の補正の書は、データに無い</li>}
          {!data.settleYears.includes(kou.year) && <li>この年度の決算の書は、データに無い</li>}
        </ul>
      </div>

      {rows.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="目の選択">
          <p className="font-semibold">目（{rows.length}）</p>
          <MultiSelectCombo
            label="目"
            options={labels}
            selected={picked === null ? [labels[0]!] : picked.includes(NONE_SELECTED) ? [NONE_SELECTED] : picked.length === 0 ? [] : chosen.map(r => labels[rows.indexOf(r)]!)}
            onChange={next => setPicked(next.includes(NONE_SELECTED) ? [NONE_SELECTED] : next.length === 0 ? [] : next.map(l => rowKey(rows[labels.indexOf(l)]!)))}
            open={open}
            onOpenChange={setOpen}
          />
          <p className="text-[11px] text-neutral-500">{chosen.length === 0 ? '目を選んでください' : chosen.length === 1 ? '年度は、項の確定した対応でたどった年度' : `選んだ ${chosen.length} 目の合計（値のある目だけ足す）`}</p>
          {chosen.length > 0 && (
            <>
              <h3 className="mt-2 font-semibold">段階ごとの額{chosen.length === 1 ? '' : '（選んだ目の合計）'}</h3>
              <TrendChart points={points} current={kou.year} onSelect={y => { const t = members.find(x => x.k.year === y); if (t && t.k.id !== kou.id) onNavigate(t.k.id); }} />
              <p className="text-[11px] text-neutral-500">決算は支出済歳出額。選んだ目のどれかに値が無く、額が分からない年度は点を描かない（例: 補正後は、外N目にまとめられた目や補正の無い項の目に値が無い）。共管別の行・概算要求書にだけある目・当初予算に無い目（補正・決算で出る目）は、その段階に無い目として、値が無くても描く。その年度の目を全部選んだときの概算要求・決算は、値のある目を全部足す（どの行も、目の行のどれか 1 つに置いているので、項の額になる）。</p>
            </>
          )}
        </section>
      )}

      {nodes.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="この年度の目">
          <h3 className="font-semibold">FY{kou.year} の目（{nodes.length}）</h3>
          <p className="text-[11px] text-neutral-500">行を選ぶと、目の一覧でその目を開く。目の計は、値のある目だけを足した額（値の無い目の数を添える）。</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                  <th className={`${th} min-w-[8rem]`}>目名</th>
                  {MOKU_MEASURES.map(x => <th key={x.key} className={`${th} whitespace-nowrap text-right`}>{x.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {nodes.map(i => {
                  const n = data.nodes[i]!;
                  return (
                    <tr key={i} onClick={() => onOpenMoku(i)} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60">
                      <td className={td}>{n[2]}<Marks n={n} /></td>
                      {MOKU_MEASURES.map(x => <Cell key={x.key} data={data} node={i} measure={x.key} />)}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-300 font-medium dark:border-neutral-700">
                  <td className={td}>目の計</td>
                  {MOKU_MEASURES.map(x => {
                    const { sum, missing } = mokuSum(moku, nodes, x.key);
                    return (
                      <td key={x.key} className={num} title={`${sum === null ? '値のある目なし' : exact(sum)}${missing > 0 ? `（値の無い目 ${missing}）` : ''}`}>
                        {sum === null ? '—' : amount(sum)}
                        {missing > 0 && sum !== null && <span className="ml-0.5 text-[10px] text-neutral-400">*</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr className="text-neutral-500">
                  <td className={td}>項の額</td>
                  {MOKU_MEASURES.map(x => {
                    const yen = kouValues[x.kou];
                    const { sum, missing } = mokuSum(moku, nodes, x.key);
                    // 値の無い目があるときは、目の計が項の額に届かないのが当然なので、比べない
                    const diff = yen !== undefined && sum !== null && missing === 0 ? sum - yen / 1000 : null;
                    const off = diff !== null && Math.abs(diff) >= 0.5;
                    const note = diff === null ? (missing > 0 && yen !== undefined ? '（値の無い目があるので、目の計とは比べない）' : '') : off ? `（目の計との差 ${exact(diff)}）` : '（目の計と一致）';
                    return (
                      <td key={x.key} className={`${num} ${off ? 'text-amber-700 dark:text-amber-400' : ''}`} title={yen === undefined ? '項の値なし' : `${exact(yen / 1000)}${note}`}>
                        {yen === undefined ? '—' : amount(yen / 1000)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-neutral-500">* 値の無い目がある（計に入れていない。項の額とは比べない）。値の無い目が無いのに、項の額が目の計と違う所は色を変えた（ホバーで差）。</p>
        </section>
      )}

      {table.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="目の年度推移">
          <h3 className="font-semibold">目の年度推移</h3>
          <p className="text-[11px] text-neutral-500">項の確定した対応でたどった年度。目は目名でそろえ、同じ目名が 2 つ以上ある年度があれば、分類コードでも分ける（「名前」= 年度で分類コードが違う）。目の改称・統合は見ていない。「·」はその年度に目が無い、「—」は目はあるが値が無い（ホバーで理由）。</p>
          <div role="radiogroup" aria-label="値" className="flex flex-wrap gap-1">
            {MOKU_MEASURES.map(x => (
              <button key={x.key} type="button" role="radio" aria-checked={measure === x.key} onClick={() => setMeasure(x.key)} className={`rounded border px-2 py-0.5 text-[11px] ${measure === x.key ? 'border-emerald-600 bg-emerald-50 font-semibold dark:bg-emerald-950/40' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}>{x.label}</button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                  <th className={`${th} sticky left-0 min-w-[8rem] bg-white dark:bg-neutral-900`}>目名</th>
                  {members.map(({ k }) => (
                    <th key={k.id} className={`${th} whitespace-nowrap text-right ${k.id === kou.id ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                      {k.id === kou.id ? `FY${k.year}` : <button type="button" className="underline decoration-dotted hover:text-neutral-800 dark:hover:text-neutral-200" title={`FY${k.year} の項（${k.name}）に移る`} onClick={() => onNavigate(k.id)}>FY{k.year}</button>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isChosen = chosen.includes(r);
                  const here = r.cells.get(kou.year);
                  return (
                    <tr key={rowKey(r)} className={`border-b border-neutral-100 dark:border-neutral-800 ${isChosen ? 'font-medium' : ''}`}>
                      <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>
                        {here !== undefined ? <button type="button" className="text-left hover:underline" title="目の一覧でこの目を開く" onClick={() => onOpenMoku(here)}>{r.name}</button> : r.name}
                        {r.part && <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="決算の共管別の行">共管: {partLabel(r.part)}</span>}
                        {r.byName && <span className="ml-1 text-[10px] text-neutral-400" title="年度で分類コードが違い、目名でそろえた">名前</span>}
                      </td>
                      {members.map(({ k }) => <Cell key={k.id} data={data} node={r.cells.get(k.year)} measure={measure} current={k.id === kou.id} />)}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-300 font-medium dark:border-neutral-700">
                  <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>目の計</td>
                  {members.map(({ k }) => {
                    const ns = rows.flatMap(r => (r.cells.has(k.year) ? [r.cells.get(k.year)!] : []));
                    const { sum, missing } = mokuSum(moku, ns, measure);
                    return <td key={k.id} className={num} title={ns.length === 0 ? '目なし' : `${sum === null ? '値のある目なし' : exact(sum)}${missing > 0 ? `（値の無い目 ${missing}）` : ''}`}>{sum === null ? '—' : amount(sum)}{missing > 0 && sum !== null && <span className="ml-0.5 text-[10px] text-neutral-400">*</span>}</td>;
                  })}
                </tr>
                <tr className="text-neutral-500">
                  <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>項の{m.label}</td>
                  {members.map(({ i, k }) => {
                    const yen = valuesOf.get(i)?.[m.kou];
                    return <td key={k.id} className={num} title={yen === undefined ? '項の値なし' : exact(yen / 1000)}>{yen === undefined ? '—' : amount(yen / 1000)}</td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
