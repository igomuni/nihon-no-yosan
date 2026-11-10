import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { PROCUREMENT_SUM_NOTE, formatSen, procurementTotals, yenText, type LifecycleSortDir, type ProcurementListRow, type ProcurementSortKey } from '@nihon-no-yosan/core';
import { Icon } from '../components/Icon.tsx';
import { scrollRowIntoView } from '../components/scrollRowIntoView.ts';
import { useListKeys } from '../components/useListKeys.ts';

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const MAX_ROWS = 600;
const MIN_COLUMN_WIDTH = 48;
export const DEFAULT_PROCUREMENT_COLUMN_WIDTHS: Record<ProcurementSortKey, number> = { date: 92, ministry: 110, name: 320, method: 170, vendor: 190, yen: 110, caseNo: 150 };
const COLS: { key: ProcurementSortKey; label: string; left?: boolean; title?: string }[] = [
  { key: 'date', label: '落札決定日', left: true },
  { key: 'ministry', label: '府省', left: true },
  { key: 'name', label: '案件名', left: true },
  { key: 'method', label: '入札方式', left: true },
  { key: 'vendor', label: '落札者', left: true },
  { key: 'yen', label: '落札価格', title: '原本の落札価格。単価契約の単価など、総額でない値も含みうる（原本の列からは区別できない）' },
  { key: 'caseNo', label: '調達案件番号', left: true, title: '同じ案件番号に、複数の行（複数の落札者など）があることがある' },
];

/** 落札実績の一覧（中ペイン）。絞り込み・並べ替え済みの全行の集計を、見出しの下に固定する */
export function ProcurementListPane({ items, sortKey, sortDir, onSort, selected, onSelect, widths, onWidthsChange }: {
  items: readonly ProcurementListRow[];
  sortKey: ProcurementSortKey;
  sortDir: LifecycleSortDir;
  onSort: (k: ProcurementSortKey) => void;
  /** 選んだ行（年度のファイルの行の添字）。選んでいなければ null */
  selected: number | null;
  onSelect: (row: ProcurementListRow) => void;
  widths: Record<string, number>;
  onWidthsChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
}) {
  const selectedIdx = selected === null ? -1 : items.findIndex(x => x.i === selected);
  useListKeys(items.length, selectedIdx, i => onSelect(items[i]!));
  const shown = items.slice(0, Math.max(MAX_ROWS, selectedIdx + 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected === null) return;
    const el = [...(scrollRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [])].find(e => e.dataset.rowKey === String(selected));
    scrollRowIntoView(scrollRef.current, el);
  }, [selected]);
  const widthOf = (k: ProcurementSortKey) => widths[k] ?? DEFAULT_PROCUREMENT_COLUMN_WIDTHS[k];
  const tableWidth = COLS.reduce((n, c) => n + widthOf(c.key), 0);

  function startResize(e: ReactMouseEvent, key: ProcurementSortKey) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startWidth = widthOf(key);
    const onMove = (ev: MouseEvent) => onWidthsChange(w => ({ ...w, [key]: Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); setBodyCursor(''); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    setBodyCursor('col-resize');
  }

  const t = procurementTotals(items);
  const foot: Partial<Record<ProcurementSortKey, { text: string; title?: string }>> = {
    date: { text: `${t.rows.toLocaleString()}行`, title: '絞り込んだ全行（表示の上限を超えた分も含む）' },
    ministry: { text: `${t.ministries}府省` },
    name: { text: `${t.cases.toLocaleString()}案件`, title: '調達案件番号の種類。同じ案件番号に複数の行があることがある' },
    vendor: { text: `${t.vendors.toLocaleString()}者`, title: '法人番号があれば法人番号、なければ名称が同じものを、同じ落札者として数える' },
    yen: { text: t.rows === 0 ? '—' : t.yen === 0 ? '0円' : formatSen(t.yen / 1000), title: `${t.yen.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} 円。${PROCUREMENT_SUM_NOTE}` },
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} data-pane="list" tabIndex={-1} className="min-h-0 flex-1 overflow-auto outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500/50">
        <table className="border-collapse text-xs" style={{ width: tableWidth, tableLayout: 'fixed' }}>
          <colgroup>{COLS.map(c => <col key={c.key} style={{ width: widthOf(c.key) }} />)}</colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              {COLS.map(c => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortKey === c.key ? (sortDir > 0 ? 'ascending' : 'descending') : undefined}
                  className={`relative cursor-pointer select-none overflow-hidden whitespace-nowrap border-b border-neutral-200 bg-neutral-100 px-2 py-1.5 font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 ${c.left ? 'text-left' : 'text-right'}`}
                  onClick={() => onSort(c.key)}
                  title={c.title}
                >
                  {c.label}
                  {sortKey === c.key && <Icon name={sortDir > 0 ? 'arrow_drop_up' : 'arrow_drop_down'} size={16} className="inline align-middle" />}
                  <span role="separator" aria-orientation="vertical" aria-label={`${c.label}の列幅`} onMouseDown={e => startResize(e, c.key)} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-500/40" />
                </th>
              ))}
            </tr>
            {items.length > 0 && (
              <tr>
                {COLS.map(c => (
                  <td key={c.key} title={foot[c.key]?.title} className={`overflow-hidden whitespace-nowrap border-b border-neutral-300 bg-neutral-100 px-2 py-1.5 font-semibold tabular-nums text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 ${c.left ? 'text-left' : 'text-right'}`}>{foot[c.key]?.text}</td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {shown.map(r => {
              const sel = r.i === selected;
              return (
                <tr
                  key={r.i}
                  data-row-key={r.i}
                  tabIndex={0}
                  aria-selected={sel}
                  onClick={() => onSelect(r)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
                  className={`cursor-pointer border-b border-neutral-100 dark:border-neutral-800 ${sel ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                >
                  <td className="whitespace-nowrap px-2 py-1 text-left tabular-nums">{r.date}</td>
                  <td className="break-words px-2 py-1 text-left" title={`府省コード ${r.ministry}`}>{r.ministryName}</td>
                  <td className="break-words px-2 py-1 text-left font-medium">{r.name}</td>
                  <td className="break-words px-2 py-1 text-left" title={`入札方式コード ${r.method}`}>{r.methodName}</td>
                  <td className="break-words px-2 py-1 text-left" title={r.corp === '' ? '法人番号: 原本が空' : `法人番号 ${r.corp}`}>{r.vendorName}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={yenText(r.yen)}>{r.yen === 0 ? '0円' : formatSen(r.yen / 1000)}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-left tabular-nums text-neutral-500">{r.caseNo}</td>
                </tr>
              );
            })}
            {items.length > shown.length && <tr><td colSpan={COLS.length} className="px-2 py-2 text-neutral-500">上位 {shown.length.toLocaleString()} 行を表示（全 {items.length.toLocaleString()} 行）。絞り込みで減らしてください。</td></tr>}
            {items.length === 0 && <tr><td colSpan={COLS.length} className="px-2 py-8 text-center text-neutral-500">条件に合う落札実績がありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
