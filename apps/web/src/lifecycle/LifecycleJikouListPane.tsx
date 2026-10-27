import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { formatSen, lifecycleAcctOf, lifecycleGroupOf, lifecycleGroupsOf, lifecycleOrgOf, lifecyclePublisherOf, lifecyclePublishersOf, type JikouListRow, type JikouSortKey, type LifecycleSortDir } from '@nihon-no-yosan/core';
import { Icon } from '../components/Icon.tsx';
import { scrollRowIntoView } from '../components/scrollRowIntoView.ts';

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const MAX_ROWS = 600;
const MIN_COLUMN_WIDTH = 48;
export const DEFAULT_JIKOU_COLUMN_WIDTHS: Record<JikouSortKey, number> = { publisher: 110, group: 110, acct: 110, org: 110, kou: 180, name: 240, request: 96, budget: 96, revised: 96, suppNet: 96, span: 112, size: 96 };
/** 一覧の列。順は、項の一覧に合わせる */
const COLS: { key: JikouSortKey; label: string; left?: boolean; title?: string }[] = [
  { key: 'publisher', label: '要求所管', left: true, title: '概算要求書の公開元の府省（要求書の PDF のドメイン由来）。複数の府省の書に載る項は「N所管」（ホバーで一覧）。概算要求書の無い年度・項は「—」' },
  { key: 'group', label: '予算所管', left: true, title: '予算書の所管（原文を府省に分けたもの）。複数の府省が所管する項は「N所管」' },
  { key: 'acct', label: '会計', left: true },
  { key: 'org', label: '組織／勘定', left: true },
  { key: 'kou', label: '項名', left: true },
  { key: 'name', label: '事項名', left: true },
  { key: 'span', label: '確認済み年度', left: true, title: '確定した対応（同じ鍵、または名前と額の根拠がそろった 1 対 1）でたどれた年度の範囲と年数。項が変わった年度も含む。事業が同じとは限らない' },
  { key: 'request', label: '概算要求', title: '概算要求書（総表）の事項の要求額' },
  { key: 'budget', label: '政府案', title: '予算書の当初予算（提出時）の額' },
  { key: 'revised', label: '補正後', title: '改予算額（補正の事項の記録がある事項。FY2024 まで）' },
  { key: 'size', label: '最大額', title: '概算要求・政府案・補正後のうち最大（既定の並びの基準）' },
];

/** 額の列（千円）。値が無いときは「—」（0 とは別） */
function Amount({ v }: { v: number | null }) {
  return v === null
    ? <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title="値なし">—</td>
    : <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={`${v.toLocaleString('ja-JP')} 千円`}>{v === 0 ? '0円' : formatSen(v)}</td>;
}

export function LifecycleJikouListPane({ items, loading, failed, sortKey, sortDir, onSort, selectedNode, onSelect, widths, onWidthsChange }: {
  /** 絞り込み・並べ替え済み */
  items: readonly JikouListRow[];
  loading: boolean;
  failed: boolean;
  sortKey: JikouSortKey;
  sortDir: LifecycleSortDir;
  onSort: (k: JikouSortKey) => void;
  selectedNode: number | null;
  onSelect: (row: JikouListRow) => void;
  widths: Record<string, number>;
  onWidthsChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
}) {
  const selectedIdx = selectedNode === null ? -1 : items.findIndex(x => x.node === selectedNode);
  const shown = items.slice(0, Math.max(MAX_ROWS, selectedIdx + 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedNode === null) return;
    const el = [...(scrollRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [])].find(e => e.dataset.rowKey === String(selectedNode));
    scrollRowIntoView(scrollRef.current, el);
  }, [selectedNode]);
  const widthOf = (k: JikouSortKey) => widths[k] ?? DEFAULT_JIKOU_COLUMN_WIDTHS[k];
  const tableWidth = COLS.reduce((n, c) => n + widthOf(c.key), 0);

  function startResize(e: ReactMouseEvent, key: JikouSortKey) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startWidth = widthOf(key);
    const onMove = (ev: MouseEvent) => onWidthsChange(w => ({ ...w, [key]: Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); setBodyCursor(''); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    setBodyCursor('col-resize');
  }

  const totals = ([['概算要求', 'request'], ['政府案', 'budget'], ['補正後', 'revised']] as const).map(([label, k]) => {
    let sum = 0, n = 0;
    for (const r of items) { const v = r[k]; if (v !== null) { sum += v; n++; } }
    return { label, sum: n === 0 ? null : sum, n };
  });
  if (failed) return <p className="p-4 text-xs text-red-700">事項の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading) return <p className="p-4 text-xs text-neutral-500">事項を読み込み中…</p>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
        <span><b className="tabular-nums text-neutral-800 dark:text-neutral-100">{items.length.toLocaleString()}</b> 事項</span>
        {totals.map(t => t.sum !== null && <span key={t.label} title={`値のある ${t.n.toLocaleString()} 事項の合計（${t.sum.toLocaleString('ja-JP')} 千円）`}>{t.label} <b className="tabular-nums text-neutral-800 dark:text-neutral-100">{formatSen(t.sum)}</b></span>)}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
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
                  <td className="break-words px-2 py-1 text-left font-medium">{r.name}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-left tabular-nums" title={`FY${r.span.from}${r.span.from === r.span.to ? '' : `〜FY${r.span.to}`}（${r.span.years} 年）。確定した対応だけでたどった範囲`}>
                    {r.span.from === r.span.to ? r.span.from : `${r.span.from}–${r.span.to}`}
                    <span className="ml-1 text-neutral-400">({r.span.years}年)</span>
                  </td>
                  <Amount v={r.request} />
                  <Amount v={r.budget} />
                  <Amount v={r.revised} />
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-neutral-500">{formatSen(r.size)}</td>
                </tr>
              );
            })}
            {items.length > shown.length && <tr><td colSpan={COLS.length} className="px-2 py-2 text-neutral-500">上位 {shown.length.toLocaleString()} 事項を表示（全 {items.length.toLocaleString()} 事項）。絞り込みで減らしてください。</td></tr>}
            {items.length === 0 && <tr><td colSpan={COLS.length} className="px-2 py-8 text-center text-neutral-500">条件に合う事項がありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
