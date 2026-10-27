import { useEffect, useMemo, useRef, useState } from 'react';
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
export const amount = (v: number): string => (v === 0 ? '0円' : formatSen(v));

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

/** 年度を縦にした表と、選んだ年度の内訳に出す値（事項のタブの `YEAR_COLS` に当たる。決算の値を足す） */
export const YEAR_COLS: { key: MokuMeasure; label: string }[] = [
  { key: 'request', label: '要求' },
  { key: 'budget', label: '政府案' },
  { key: 'revised', label: '補正後' },
  { key: 'current', label: '歳出予算現額' },
  { key: 'spent', label: '支出済' },
  { key: 'unused', label: '不用額' },
];
/** 項の額と照合する値（補正後は、外N目にまとめられた目に値が無く、目の計が項の額に届かないので、照合しない） */
const CHECKED: readonly MokuMeasure[] = ['request', 'budget', 'current', 'spent', 'unused'];

/** 合計のセル。値のある目だけを足す。額が分からない（値の無い目がある）ときは、値のある目の数を添える */
function SumCell({ moku, nodes, measure, all, current }: { moku: MokuIndex; nodes: readonly number[]; measure: MokuMeasure; /** その年度の目を全部選んでいる（`chartSum` と同じ判定） */ all: boolean; current?: boolean }) {
  const hl = current ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : '';
  if (nodes.length === 0) return <td className={`${num} ${hl} text-neutral-300 dark:text-neutral-600`} title="この年度に、選んだ目が無い">·</td>;
  const { sum, missing } = mokuSum(moku, nodes, measure);
  const unknown = missing > 0 && chartSum(moku.data, nodes, measure, all) === null;
  return (
    <td className={`${num} ${hl}`} title={sum === null ? '値のある目が無い' : `${exact(sum)}（値のある ${nodes.length - missing} 目の合計）`}>
      {sum === null ? <span className="text-neutral-300 dark:text-neutral-600">—</span> : amount(sum)}
      {sum !== null && unknown && <span className="block text-[10px] text-amber-700 dark:text-amber-400">{nodes.length - missing}/{nodes.length} 目</span>}
    </td>
  );
}

/**
 * 項の下の目（項の右ペインの「目」タブ）。年度推移・事項のタブと同じ構成。
 * 目をコンボボックス（チェックボックス付きの複数選択）で選び、選んだ目の概算要求・政府案・補正後・決算（支出済）の年度推移をグラフと、年度を縦に並べた表で見る。
 * 2 つ以上選ぶと、選んだ目の合計（値のある目だけ足す）と、選んだ年度の目ごとの内訳を出す。
 * 目の計は項の額と照合する（折りたたみ）。この項のすべての目は、年度 × 値の表（折りたたみ）。
 * 年度は項の確定した対応でたどった年度。目のそろえ方は `mokuKouTable`（目の改称・統合は見ていない）。値の無い所は「—」（0 とは別）で、ホバーで理由。
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
  const [picked, setPicked] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const top = useRef<HTMLElement>(null);
  const members = useMemo(() => chain.members.map(i => ({ i, k: kous[i]! })), [chain, kous]);
  const table = useMemo(() => (moku ? mokuKouTable(moku, members.map(({ k }) => ({ id: k.id, year: k.year }))) : []), [moku, members]);
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
  const one = chosen.length === 1 ? chosen[0]! : null;
  const nodesIn = (rs: readonly MokuKouRow[], year: number): number[] => rs.flatMap(r => (r.cells.has(year) ? [r.cells.get(year)!] : []));
  const points = useMemo<TrendPoint[]>(() => {
    if (!moku) return [];
    const yen = (key: MokuMeasure, year: number): number | undefined => {
      const all = rows.every(r => !r.cells.has(year) || chosen.includes(r));
      const sum = chartSum(moku.data, chosen.flatMap(r => (r.cells.has(year) ? [r.cells.get(year)!] : [])), key, all);
      return sum === null ? undefined : sum * 1000;
    };
    return members.map(({ k }) => ({ year: k.year, request: yen('request', k.year), budget: yen('budget', k.year), revised: yen('revised', k.year), spent: yen('spent', k.year) }));
  }, [moku, rows, chosen, members]);
  const select = (key: string): void => { setPicked([key]); top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const goYear = (y: number): void => { const t = members.find(x => x.k.year === y); if (t && t.k.id !== kou.id) onNavigate(t.k.id); };

  if (failed) return <p className="p-4 text-xs text-red-700">目の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading || !moku) return <p className="p-4 text-xs text-neutral-500">目を読み込み中…</p>;
  const { data } = moku;
  const coverage = moku.coverageOf.get(kou.id);
  const hasYear = data.years.includes(kou.year);

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-neutral-500">
          {!hasYear && <li>この年度の目は、データに無い（予算書が無い年度）</li>}
          {hasYear && rows.length === 0 && <li>この項の目は、データに無い{kou.requestOnly ? '（概算要求書にだけある項。概算要求書の目は、まだ入れていない）' : ''}</li>}
          {kou.requestOnly ? null : data.requestYears.includes(kou.year)
            ? <li>概算要求の目の取れ方: {coverage ? MOKU_REQUEST_COVERAGE_LABEL[coverage] : '概算要求書の項と突合できていない項'}</li>
            : <li>この年度の概算要求の目は、データに無い</li>}
          {!data.suppYears.includes(kou.year) && <li>この年度の補正の書は、データに無い</li>}
          {!data.settleYears.includes(kou.year) && <li>この年度の決算の書は、データに無い</li>}
        </ul>
      </div>

      {rows.length > 0 && (
        <>
          <section ref={top} className="flex flex-col gap-1.5" aria-label="目の選択">
            <p className="font-semibold">目（{rows.length}）</p>
            <MultiSelectCombo
              label="目"
              options={labels}
              selected={picked === null ? [labels[0]!] : picked.includes(NONE_SELECTED) ? [NONE_SELECTED] : picked.length === 0 ? [] : chosen.map(r => labels[rows.indexOf(r)]!)}
              onChange={next => setPicked(next.includes(NONE_SELECTED) ? [NONE_SELECTED] : next.length === 0 ? [] : next.map(l => rowKey(rows[labels.indexOf(l)]!)))}
              open={open}
              onOpenChange={setOpen}
            />
            <p className="text-[11px] text-neutral-500">
              {one ? `${spanOf(one)}${one.byName ? ' · 年度で分類コードが違い、目名でそろえた' : ''}` : chosen.length === 0 ? '目を選んでください' : `選んだ ${chosen.length} 目の合計`}
              {one && one.cells.has(kou.year) && <button type="button" onClick={() => onOpenMoku(one.cells.get(kou.year)!)} className="ml-2 underline decoration-dotted hover:text-neutral-800 dark:hover:text-neutral-200">目の一覧で開く</button>}
            </p>
          </section>

          {chosen.length > 0 && (
            <>
              <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
                <h3 className="font-semibold">段階ごとの額{one ? '' : '（選んだ目の合計）'}</h3>
                <TrendChart points={points} current={kou.year} onSelect={goYear} />
                <p className="text-[11px] text-neutral-500">決算は支出済歳出額。選んだ目のどれかに値が無く、額が分からない年度は点を描かない（例: 補正後は、外N目にまとめられた目や補正の無い項の目に値が無い）。共管別の行・概算要求書にだけある目・当初予算に無い目（補正・決算で出る目）は、その段階に無い目として、値が無くても描く。その年度の目を全部選んだときの概算要求・決算は、値のある目を全部足す（どの行も、目の行のどれか 1 つに置いているので、項の額になる）。</p>
              </section>

              <section className="flex flex-col gap-2" aria-label="年度の表">
                <h3 className="font-semibold">年度ごとの額{one ? 'と対応' : '（選んだ目の合計）'}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left">
                        <th className={th}>年度</th>
                        <th className={`${th} min-w-[7rem]`}>{one ? '目名（対応）' : '合計'}</th>
                        {YEAR_COLS.map(c => <th key={c.key} className={`${th} whitespace-nowrap text-right`} title={mokuMeasure(c.key).label}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(({ k }) => {
                        const selected = k.id === kou.id;
                        const node = one?.cells.get(k.year);
                        const n = node === undefined ? undefined : data.nodes[node]!;
                        const ns = nodesIn(chosen, k.year);
                        const all = rows.every(r => !r.cells.has(k.year) || chosen.includes(r));
                        return (
                          <tr
                            key={k.id}
                            tabIndex={0}
                            aria-selected={selected}
                            title={selected ? undefined : `FY${k.year} を開く`}
                            onClick={() => { if (!selected) onNavigate(k.id); }}
                            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onNavigate(k.id); } }}
                            className={`border-t border-neutral-100 align-top dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                          >
                            <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{k.year}</td>
                            <td className={td}>
                              {one ? (n ? (
                                <>
                                  {n[2]}<Marks n={n} />
                                  {n[3] && <span className="block text-[10px] text-neutral-500">分類コード: {n[3].split('|').join('-')}</span>}
                                </>
                              ) : <span className="text-neutral-400">{data.years.includes(k.year) ? 'この年度に目なし' : 'この年度の目は、データに無い'}</span>)
                                : <span className="text-neutral-500">{ns.length}/{chosen.length} 目</span>}
                            </td>
                            {YEAR_COLS.map(c => (one
                              ? <Cell key={c.key} data={data} node={node} measure={c.key} />
                              : <SumCell key={c.key} moku={moku} nodes={ns} measure={c.key} all={all} />))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {!one && <MokuBreakdown rows={chosen} moku={moku} year={kou.year} onSelect={select} />}
            </>
          )}

          <Reconcile rows={rows} moku={moku} members={members} valuesOf={valuesOf} current={kou.year} />
          <AllMoku rows={rows} moku={moku} members={members} kou={kou} onNavigate={onNavigate} onPick={select} picked={chosen.map(rowKey)} />
        </>
      )}
    </div>
  );
}

/** 目の年度の範囲（行の表示用） */
function spanOf(r: MokuKouRow): string {
  const ys = [...r.cells.keys()];
  const from = Math.min(...ys), to = Math.max(...ys);
  return `FY${from}${from === to ? '' : `〜FY${to}`}${r.part ? ` · 決算の共管: ${partLabel(r.part)}` : ''}`;
}

/** 選んだ年度の、選んだ目ごとの値（2 つ以上選んだとき）。行を押すと、その目だけにする */
function MokuBreakdown({ rows, moku, year, onSelect }: { rows: readonly MokuKouRow[]; moku: MokuIndex; year: number; onSelect: (key: string) => void }) {
  return (
    <section className="flex flex-col gap-2" aria-label="選んだ目ごと">
      <h3 className="font-semibold">FY{year} の選んだ目ごと</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left">
              <th className={`${th} min-w-[7rem]`}>目</th>
              {YEAR_COLS.map(c => <th key={c.key} className={`${th} whitespace-nowrap text-right`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const node = r.cells.get(year);
              return (
                <tr key={rowKey(r)} onClick={() => onSelect(rowKey(r))} title="この目だけにする" className="cursor-pointer border-t border-neutral-100 align-top hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60">
                  <td className={td}>
                    {r.name}{node !== undefined && <Marks n={moku.data.nodes[node]!} />}
                    {node === undefined && <span className="block text-[10px] text-neutral-500">この年度に目なし（{spanOf(r)}）</span>}
                  </td>
                  {YEAR_COLS.map(c => <Cell key={c.key} data={moku.data} node={node} measure={c.key} />)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 目の計と、項の額の照合（項のすべての目を足す）。違う年度があれば、見出しに出す */
function Reconcile({ rows, moku, members, valuesOf, current }: { rows: readonly MokuKouRow[]; moku: MokuIndex; members: readonly { i: number; k: LifecycleKou }[]; valuesOf: ReadonlyMap<number, LifecycleValues>; current: number }) {
  const checks = useMemo(() => CHECKED.map(key => ({
    key,
    totals: members.map(({ i, k }) => {
      const ns = rows.flatMap(r => (r.cells.has(k.year) ? [r.cells.get(k.year)!] : []));
      const { sum } = mokuSum(moku, ns, key);
      const yen = valuesOf.get(i)?.[mokuMeasure(key).kou];
      const kouV = yen === undefined ? null : yen / 1000;
      return { year: k.year, rows: ns.length, sum, kou: kouV, differs: kouV !== null && sum !== null && Math.abs(sum - kouV) >= 0.5 };
    }),
  })), [rows, moku, members, valuesOf]);
  const nDiffer = checks.reduce((n, c) => n + c.totals.filter(t => t.differs).length, 0);
  return (
    <details className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
      <summary className="cursor-pointer font-semibold">
        項の額との照合
        {nDiffer > 0 && <span className="ml-2 font-normal text-amber-700 dark:text-amber-400">目の計と違う年度・値が {nDiffer} 件</span>}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-[11px] text-neutral-500">項のすべての目の、値のある目を足した額（目の計）と、項の額。補正後は、外N目にまとめられた目に値が無く、目の計が項の額に届かないので、照合しない。</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                {checks.map(c => <th key={c.key} className={`${th} text-right`}>{mokuMeasure(c.key).label}（目の計 / 項の額）</th>)}
              </tr>
            </thead>
            <tbody>
              {members.map(({ k }) => (
                <tr key={k.id} className={`border-t border-neutral-100 dark:border-neutral-800 ${k.year === current ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                  <td className={`${td} whitespace-nowrap`}>FY{k.year}</td>
                  {checks.map(c => {
                    const t = c.totals.find(x => x.year === k.year)!;
                    return (
                      <td key={c.key} className={`${num} ${t.differs ? 'text-amber-700 dark:text-amber-400' : ''}`} title={t.sum === null ? undefined : `目の計 ${exact(t.sum)}${t.kou === null ? '' : ` / 項の額 ${exact(t.kou)}`}`}>
                        {t.sum === null ? '—' : amount(t.sum)} / {t.kou === null ? '—' : amount(t.kou)}
                        {t.differs && <span className="block text-[10px]">違う</span>}
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

/** この項のすべての目を、年度 × 値で並べた表。行を押すと、その目に選び直す */
function AllMoku({ rows, moku, members, kou, onNavigate, onPick, picked }: { rows: readonly MokuKouRow[]; moku: MokuIndex; members: readonly { i: number; k: LifecycleKou }[]; kou: LifecycleKou; onNavigate: (id: string) => void; onPick: (key: string) => void; picked: readonly string[] }) {
  const [shown, setShown] = useState(false);
  const [measure, setMeasure] = useState<MokuMeasure>('budget');
  const scroller = useRef<HTMLDivElement>(null);
  // 年度の列が多いときは、選んだ年度の列が見える位置まで、表を横にずらす
  useEffect(() => {
    const box = scroller.current;
    const head = box?.querySelector<HTMLElement>('[data-selected="true"]');
    if (box && head) box.scrollLeft = Math.max(0, head.offsetLeft - box.clientWidth / 2);
  }, [shown, kou.id, rows, measure]);
  return (
    <details className="rounded border border-neutral-200 p-2 dark:border-neutral-700" onToggle={e => setShown((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold">この項のすべての目（{rows.length}）</summary>
      {shown && (
        <div className="mt-2 flex flex-col gap-2">
          <div role="tablist" aria-label="目の値" className="flex flex-wrap gap-1">
            {MOKU_MEASURES.map(m => (
              <button key={m.key} type="button" role="tab" aria-selected={measure === m.key} onClick={() => setMeasure(m.key)} className={`rounded-full border px-2.5 py-0.5 ${measure === m.key ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}>{m.label}</button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">「·」はその年度に目が無い、「—」は目はあるが値が無い（ホバーで理由）。</p>
          <div ref={scroller} className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left">
                  <th className={`${th} sticky left-0 min-w-[11rem] bg-white dark:bg-neutral-900`}>目</th>
                  {members.map(({ k }) => {
                    const selected = k.id === kou.id;
                    return (
                      <th key={k.id} data-selected={selected} className={`${th} whitespace-nowrap text-right ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}>
                        <button type="button" disabled={selected} title={selected ? undefined : `FY${k.year} の項を開く`} onClick={() => onNavigate(k.id)} className={selected ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'underline decoration-dotted underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100'}>FY{k.year}</button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={rowKey(r)} onClick={() => onPick(rowKey(r))} title="この目だけにする" className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60 ${picked.includes(rowKey(r)) ? 'bg-neutral-50 dark:bg-neutral-800/60' : ''}`}>
                    <td className={`${td} sticky left-0 bg-white dark:bg-neutral-900`}>
                      {r.name}
                      {r.part && <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500 dark:bg-neutral-800" title="決算の共管別の行">共管: {partLabel(r.part)}</span>}
                      {r.byName && <span className="ml-1 text-[10px] text-neutral-400" title="年度で分類コードが違い、目名でそろえた">名前</span>}
                    </td>
                    {members.map(({ k }) => <Cell key={k.id} data={moku.data} node={r.cells.get(k.year)} measure={measure} current={k.id === kou.id} />)}
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
