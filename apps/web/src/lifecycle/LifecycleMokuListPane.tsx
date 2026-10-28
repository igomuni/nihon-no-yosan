import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { MOKU_FLAG, formatSen, lifecycleAcctOf, lifecycleGroupOf, lifecycleGroupsOf, lifecycleOrgOf, lifecyclePublisherOf, lifecyclePublishersOf, type LifecycleSortDir, type MokuListRow, type MokuSortKey } from '@nihon-no-yosan/core';
import { Icon } from '../components/Icon.tsx';
import { scrollRowIntoView } from '../components/scrollRowIntoView.ts';
import { useListKeys } from '../components/useListKeys.ts';

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const MAX_ROWS = 600;
const MIN_COLUMN_WIDTH = 48;
export const DEFAULT_MOKU_COLUMN_WIDTHS: Record<MokuSortKey, number> = { publisher: 100, group: 100, acct: 100, org: 110, kou: 170, name: 200, span: 112, request: 92, budget: 92, revised: 92, current: 92, spent: 92, unused: 92, size: 92 };
/** 一覧の列。順は、事項の一覧に合わせ、決算の列を足す */
const COLS: { key: MokuSortKey; label: string; left?: boolean; title?: string }[] = [
  { key: 'publisher', label: '要求所管', left: true, title: '概算要求書の公開元の府省（要求書の PDF のドメイン由来）。複数の府省の書に載る項は「N所管」' },
  { key: 'group', label: '予算所管', left: true, title: '予算書の所管（原文を府省に分けたもの）。複数の府省が所管する項は「N所管」' },
  { key: 'acct', label: '会計', left: true },
  { key: 'org', label: '組織／勘定', left: true },
  { key: 'kou', label: '項名', left: true },
  { key: 'name', label: '目名', left: true },
  { key: 'span', label: '確認済み年度', left: true, title: '項の確定した対応でたどった年度のうち、この目（目名・分類コード。無ければ同じ目名が 1 つだけの目）が続けて見つかった範囲と年数。目の改称・統合は見ていない。事業が同じとは限らない' },
  { key: 'request', label: '概算要求', title: '概算要求書の明細の目の要求額（予算書の目と、同じ項の中で名前でつないだもの）' },
  { key: 'budget', label: '政府案', title: '予算書の当初予算（提出時）の目の額' },
  { key: 'revised', label: '補正後', title: '補正の書の改予算額（目の個別の行があるときだけ。「外N目」にまとめられた目、項の行だけの項は値なし）' },
  { key: 'current', label: '歳出予算現額', title: '決算の書の歳出予算現額' },
  { key: 'spent', label: '支出済', title: '決算の書の支出済歳出額' },
  { key: 'unused', label: '不用額', title: '決算の書の不用額' },
  { key: 'size', label: '最大額', title: '概算要求・政府案・補正後・歳出予算現額のうち最大（既定の並びの基準）' },
];

/** 額の列（千円）。値が無いときは「—」（0 とは別）。`why` は値が無い理由 */
function Amount({ v, why }: { v: number | null; why?: string | null }) {
  return v === null
    ? <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title={why ?? '値なし'}>—</td>
    : <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={`${v.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} 千円`}>{v === 0 ? '0円' : formatSen(v)}</td>;
}

/** 目名の横の印（共管別の行・概算要求のみ・目名だけで結んだ） */
function Marks({ r }: { r: MokuListRow }) {
  const marks: [string, string][] = [];
  if (r.flags & MOKU_FLAG.settlePart) marks.push(['共管', `決算の共管別の行: ${r.part.replace(/#\d+$/, '').split('|').filter(Boolean).join(' / ') || '（共管の名前なし）'}`]);
  if (r.flags & MOKU_FLAG.requestOnly) marks.push(['要求のみ', '概算要求書にだけある目（予算書に、同じ名前の目が無い。項が予算書に無い場合を含む）']);
  if (r.flags & MOKU_FLAG.settleSplit) marks.push(['決算は共管別', '決算は、共管の組織ごとの行に分かれている']);
  return <>{marks.map(([t, title]) => <span key={t} title={title} className="ml-1 rounded bg-neutral-100 px-1 text-[10px] font-normal text-neutral-500 dark:bg-neutral-800">{t}</span>)}</>;
}

export function LifecycleMokuListPane({ items, loading, failed, sortKey, sortDir, onSort, selectedNode, onSelect, widths, onWidthsChange, suppNote }: {
  /** 絞り込み・並べ替え済み */
  items: readonly MokuListRow[];
  loading: boolean;
  failed: boolean;
  sortKey: MokuSortKey;
  sortDir: LifecycleSortDir;
  onSort: (k: MokuSortKey) => void;
  selectedNode: number | null;
  onSelect: (row: MokuListRow) => void;
  widths: Record<string, number>;
  onWidthsChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  /** 補正・決算の値が無い理由（表示用） */
  suppNote: (r: MokuListRow) => { supp: string | null; settle: string | null };
}) {
  const selectedIdx = selectedNode === null ? -1 : items.findIndex(x => x.node === selectedNode);
  useListKeys(items.length, selectedIdx, i => onSelect(items[i]!));
  const shown = items.slice(0, Math.max(MAX_ROWS, selectedIdx + 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedNode === null) return;
    const el = [...(scrollRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [])].find(e => e.dataset.rowKey === String(selectedNode));
    scrollRowIntoView(scrollRef.current, el);
  }, [selectedNode]);
  const widthOf = (k: MokuSortKey) => widths[k] ?? DEFAULT_MOKU_COLUMN_WIDTHS[k];
  const tableWidth = COLS.reduce((n, c) => n + widthOf(c.key), 0);

  function startResize(e: ReactMouseEvent, key: MokuSortKey) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startWidth = widthOf(key);
    const onMove = (ev: MouseEvent) => onWidthsChange(w => ({ ...w, [key]: Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); setBodyCursor(''); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    setBodyCursor('col-resize');
  }

  const totals = ([['概算要求', 'request'], ['政府案', 'budget'], ['補正後', 'revised'], ['決算', 'spent']] as const).map(([label, k]) => {
    let sum = 0, n = 0;
    for (const r of items) { const v = r[k]; if (v !== null) { sum += v; n++; } }
    return { label, sum: n === 0 ? null : sum, n };
  });
  if (failed) return <p className="p-4 text-xs text-red-700">目の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading) return <p className="p-4 text-xs text-neutral-500">目を読み込み中…</p>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
        <span title="額の列の「—」は値なし（0 ではない）。ホバーで理由"><b className="tabular-nums text-neutral-800 dark:text-neutral-100">{items.length.toLocaleString()}</b> 目</span>
        {totals.map(t => t.sum !== null && <span key={t.label} title={`値のある ${t.n.toLocaleString()} 目の合計（${t.sum.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} 千円）${t.label === '決算' ? '。支出済歳出額' : ''}`}>{t.label} <b className="tabular-nums text-neutral-800 dark:text-neutral-100">{formatSen(t.sum)}</b></span>)}
      </div>
      <div ref={scrollRef} data-pane="list" tabIndex={-1} className="min-h-0 flex-1 overflow-auto outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500/50">
        <table className="border-collapse text-xs" style={{ width: tableWidth, tableLayout: 'fixed' }}>
          <colgroup>{COLS.map(c => <col key={c.key} style={{ width: widthOf(c.key) }} />)}</colgroup>
          <thead>
            <tr>
              {COLS.map(c => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortKey === c.key ? (sortDir > 0 ? 'ascending' : 'descending') : undefined}
                  className={`sticky top-0 z-10 cursor-pointer select-none overflow-hidden whitespace-nowrap border-b border-neutral-200 bg-neutral-100 px-2 py-1.5 font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 ${c.left ? 'text-left' : 'text-right'}`}
                  onClick={() => onSort(c.key)}
                  title={c.title}
                >
                  {c.label}
                  {sortKey === c.key && <Icon name={sortDir > 0 ? 'arrow_drop_up' : 'arrow_drop_down'} size={16} className="inline align-middle" />}
                  <span role="separator" aria-orientation="vertical" aria-label={`${c.label}の列幅`} onMouseDown={e => startResize(e, c.key)} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-500/40" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const selected = r.node === selectedNode;
              const k = r.k;
              const why = suppNote(r);
              return (
                <tr
                  key={r.node}
                  data-row-key={r.node}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(r)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                  className={`cursor-pointer border-b border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                >
                  <td className={`break-words px-2 py-1 text-left ${lifecyclePublishersOf(k).length > 1 ? 'text-neutral-500' : ''}`} title={lifecyclePublishersOf(k).length > 1 ? lifecyclePublishersOf(k).join('、') : undefined}>{lifecyclePublisherOf(k) || <span className="text-neutral-300 dark:text-neutral-600">—</span>}</td>
                  <td className={`break-words px-2 py-1 text-left ${lifecycleGroupsOf(k).length > 1 ? 'text-neutral-500' : ''}`} title={lifecycleGroupsOf(k).length > 1 ? lifecycleGroupsOf(k).join('、') : undefined}>{lifecycleGroupOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{lifecycleAcctOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{lifecycleOrgOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{k.name}</td>
                  <td className="break-words px-2 py-1 text-left font-medium">{r.name}<Marks r={r} /></td>
                  <td className="whitespace-nowrap px-2 py-1 text-left tabular-nums" title={`FY${r.span.from}${r.span.from === r.span.to ? '' : `〜FY${r.span.to}`}（${r.span.years} 年）。項の確定した対応でたどった年度のうち、この目が続けて見つかった範囲`}>
                    {r.span.from === r.span.to ? r.span.from : `${r.span.from}–${r.span.to}`}
                    <span className="ml-1 text-neutral-400">({r.span.years}年)</span>
                  </td>
                  <Amount v={r.request} why={r.flags & MOKU_FLAG.settlePart ? '決算の共管別の行' : '概算要求の目が無い（要求書の明細に無い、名前で結べない、または概算要求書を読んでいない年度）'} />
                  <Amount v={r.budget} why={r.flags & MOKU_FLAG.settlePart ? '決算の共管別の行' : '当初予算に、この目が無い'} />
                  <Amount v={r.revised} why={why.supp} />
                  <Amount v={r.current} why={why.settle} />
                  <Amount v={r.spent} why={why.settle} />
                  <Amount v={r.unused} why={why.settle} />
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-neutral-500">{formatSen(r.size)}</td>
                </tr>
              );
            })}
            {items.length > shown.length && <tr><td colSpan={COLS.length} className="px-2 py-2 text-neutral-500">上位 {shown.length.toLocaleString()} 目を表示（全 {items.length.toLocaleString()} 目）。絞り込みで減らしてください。</td></tr>}
            {items.length === 0 && <tr><td colSpan={COLS.length} className="px-2 py-8 text-center text-neutral-500">条件に合う目がありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
