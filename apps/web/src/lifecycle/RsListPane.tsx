import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { formatSen, type LifecycleSortDir, type RsListRow, type RsSortKey } from '@nihon-no-yosan/core';
import { Icon } from '../components/Icon.tsx';
import { scrollRowIntoView } from '../components/scrollRowIntoView.ts';
import { useListKeys } from '../components/useListKeys.ts';

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const MAX_ROWS = 600;
const MIN_COLUMN_WIDTH = 48;
export const DEFAULT_RS_COLUMN_WIDTHS: Record<RsSortKey, number> = { ministry: 100, bureau: 130, name: 280, kou: 64, initial: 92, supp: 92, current: 100, spent: 92, request: 100 };
/** 一覧の列。予算書の項への結びは「項」（結べた項の数。結べない事業は「—」）。額は円（RS の予算・執行） */
const COLS: { key: RsSortKey; label: string; left?: boolean; title?: string }[] = [
  { key: 'ministry', label: '府省庁', left: true },
  { key: 'bureau', label: '局・庁', left: true },
  { key: 'name', label: '事業名', left: true },
  { key: 'kou', label: '項', title: 'この年度に、RS の歳出予算項目が結べた予算書の項の数。「—」は、結べる項が無い（RS に項の記載が無い、予算書に同じ項が無い、同名の項が複数ある）' },
  { key: 'initial', label: '当初予算', title: 'RS の予算・執行のサマリの当初予算（合計）' },
  { key: 'supp', label: '補正予算', title: '補正予算（合計）' },
  { key: 'current', label: '歳出予算現額', title: '歳出予算現額（合計）= 当初予算 + 補正予算 + 前年度からの繰越し + 予備費等' },
  { key: 'spent', label: '執行額', title: '執行額（合計）。全事業で 0 の年度は、値なしとして扱う' },
  { key: 'request', label: '翌年度要求額', title: '翌年度要求額（合計）' },
];

/** 額の列（円）。値が無いときは「—」（0 とは別） */
function Amount({ v, why }: { v: number | null; why?: string | null }) {
  return v === null
    ? <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title={why ?? '値なし（RS の欄が空）'}>—</td>
    : <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={`${v.toLocaleString('ja-JP')} 円`}>{v === 0 ? '0円' : formatSen(v / 1000)}</td>;
}

/** 事業の一覧（中ペインの「RS」）。項に結べない事業も含める */
export function RsListPane({ items, loading, failed, sortKey, sortDir, onSort, selectedId, onSelect, widths, onWidthsChange, yearNote, spentNote }: {
  /** 絞り込み・並べ替え済み */
  items: readonly RsListRow[];
  loading: boolean;
  failed: boolean;
  sortKey: RsSortKey;
  sortDir: LifecycleSortDir;
  onSort: (k: RsSortKey) => void;
  selectedId: string | null;
  onSelect: (row: RsListRow) => void;
  widths: Record<string, number>;
  onWidthsChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  /** 選んだ年度に RS のデータが無いときの説明（あるときは null） */
  yearNote: string | null;
  /** 選んだ年度の執行額が、値のある全事業で 0 のときの説明（そうでなければ null） */
  spentNote: string | null;
}) {
  const selectedIdx = selectedId === null ? -1 : items.findIndex(x => x.id === selectedId);
  useListKeys(items.length, selectedIdx, i => onSelect(items[i]!));
  const shown = items.slice(0, Math.max(MAX_ROWS, selectedIdx + 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId === null) return;
    const el = [...(scrollRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [])].find(e => e.dataset.rowKey === selectedId);
    scrollRowIntoView(scrollRef.current, el);
  }, [selectedId]);
  const widthOf = (k: RsSortKey) => widths[k] ?? DEFAULT_RS_COLUMN_WIDTHS[k];
  const tableWidth = COLS.reduce((n, c) => n + widthOf(c.key), 0);

  function startResize(e: ReactMouseEvent, key: RsSortKey) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startWidth = widthOf(key);
    const onMove = (ev: MouseEvent) => onWidthsChange(w => ({ ...w, [key]: Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); setBodyCursor(''); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    setBodyCursor('col-resize');
  }

  const totals = ([['当初予算', 'initial'], ['歳出予算現額', 'current'], ['執行額', 'spent']] as const).map(([label, k]) => {
    let sum = 0, n = 0;
    for (const r of items) { const v = r[k]; if (v !== null) { sum += v; n++; } }
    return { label, sum: n === 0 ? null : sum, n };
  });
  const linked = items.filter(r => r.kouCount > 0).length;
  if (failed) return <p className="p-4 text-xs text-red-700">RS の事業の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading) return <p className="p-4 text-xs text-neutral-500">RS の事業を読み込み中…</p>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
        <span title="RS のシート（レビューシート）の数。予算事業の数とは一致しないことがある"><b className="tabular-nums text-neutral-800 dark:text-neutral-100">{items.length.toLocaleString()}</b> 事業</span>
        <span title="予算書の項に 1 つ以上結べた事業">項に結べた <b className="tabular-nums text-neutral-800 dark:text-neutral-100">{linked.toLocaleString()}</b></span>
        {totals.map(t => t.sum !== null && <span key={t.label} title={`値のある ${t.n.toLocaleString()} 事業の合計（${t.sum.toLocaleString('ja-JP')} 円）。事業単位の集計で、予算書の数値と必ずしも一致しない`}>{t.label} <b className="tabular-nums text-neutral-800 dark:text-neutral-100">{formatSen(t.sum / 1000)}</b></span>)}
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
              const selected = r.id === selectedId;
              return (
                <tr
                  key={r.id}
                  data-row-key={r.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(r)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                  className={`cursor-pointer border-b border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                >
                  <td className="break-words px-2 py-1 text-left">{r.ministry}</td>
                  <td className="break-words px-2 py-1 text-left">{r.bureau}</td>
                  <td className="break-words px-2 py-1 text-left font-medium" title={`予算事業 ID ${r.id}${r.major ? ` · 主要経費: ${r.major.split('|').join('、')}` : ''}`}>{r.name}</td>
                  {r.kouCount > 0
                    ? <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{r.kouCount}</td>
                    : <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title="この年度に、予算書の項に結べた行が無い">—</td>}
                  <Amount v={r.initial} />
                  <Amount v={r.supp} />
                  <Amount v={r.current} />
                  <Amount v={r.spent} why={spentNote} />
                  <Amount v={r.request} />
                </tr>
              );
            })}
            {items.length > shown.length && <tr><td colSpan={COLS.length} className="px-2 py-2 text-neutral-500">上位 {shown.length.toLocaleString()} 事業を表示（全 {items.length.toLocaleString()} 事業）。絞り込みで減らしてください。</td></tr>}
            {items.length === 0 && <tr><td colSpan={COLS.length} className="px-2 py-8 text-center text-neutral-500">{yearNote ?? '条件に合う事業がありません。'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
