import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  LIFECYCLE_STAGES,
  formatSen,
  lifecycleAcctOf,
  lifecycleGroupOf,
  lifecycleGroupsOf,
  lifecycleOrgOf,
  type LifecycleKou,
  type LifecycleRowAmounts,
  type LifecycleSortDir,
  type LifecycleSortKey,
  type LifecycleStage,
} from '@nihon-no-yosan/core';
import { Icon } from '../components/Icon.tsx';

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const MAX_ROWS = 600;
const MIN_COLUMN_WIDTH = 48;
export const DEFAULT_COLUMN_WIDTHS: Record<LifecycleSortKey, number> = { group: 130, acct: 130, org: 120, name: 220, stages: 72, request: 96, budget: 96, revised: 96, spent: 96, size: 96 };
const BADGE: Record<LifecycleStage, string> = { request: '要', budget: '政', supp: '補', settle: '決' };
const COLS: { key: LifecycleSortKey; label: string; left?: boolean; title?: string }[] = [
  { key: 'group', label: '所管', left: true },
  { key: 'acct', label: '会計', left: true },
  { key: 'org', label: '組織／勘定', left: true },
  { key: 'name', label: '項名', left: true },
  { key: 'stages', label: '段階', left: true, title: '値がある段階。要 = 概算要求、政 = 政府案、補 = 補正、決 = 決算（薄い字は、現行のデータに値が無い）' },
  { key: 'request', label: '概算要求', title: '要求額' },
  { key: 'budget', label: '政府案', title: '政府案の額' },
  { key: 'revised', label: '補正後', title: '改予算額（補正の記録がある項）' },
  { key: 'spent', label: '決算', title: '支出済額' },
  { key: 'size', label: '最大額', title: '歳出予算現額・政府案・要求額のうち最大（既定の並びの基準）' },
];

/** 額の列。値が無いときは「—」（0 とは別） */
function Amount({ yen }: { yen: number | undefined }) {
  return yen === undefined
    ? <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title="値なし">—</td>
    : <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={`${yen.toLocaleString('ja-JP')} 円`}>{yen === 0 ? '0円' : formatSen(yen / 1000)}</td>;
}

export function LifecycleListPane({ items, sortKey, sortDir, onSort, selectedId, onSelect, widths, onWidthsChange }: {
  /** 絞り込み・並べ替え済み */
  items: readonly { k: LifecycleKou; a: LifecycleRowAmounts }[];
  sortKey: LifecycleSortKey;
  sortDir: LifecycleSortDir;
  onSort: (k: LifecycleSortKey) => void;
  selectedId: string | null;
  onSelect: (k: LifecycleKou) => void;
  widths: Record<string, number>;
  onWidthsChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
}) {
  const selectedIdx = selectedId === null ? -1 : items.findIndex(x => x.k.id === selectedId);
  const shown = items.slice(0, Math.max(MAX_ROWS, selectedIdx + 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId === null) return;
    const el = [...(scrollRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [])].find(e => e.dataset.rowKey === selectedId);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
  const widthOf = (k: LifecycleSortKey) => widths[k] ?? DEFAULT_COLUMN_WIDTHS[k];
  const tableWidth = COLS.reduce((n, c) => n + widthOf(c.key), 0);

  function startResize(e: ReactMouseEvent, key: LifecycleSortKey) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startWidth = widthOf(key);
    const onMove = (ev: MouseEvent) => onWidthsChange(w => ({ ...w, [key]: Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); setBodyCursor(''); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    setBodyCursor('col-resize');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
        <span><b className="tabular-nums text-neutral-800 dark:text-neutral-100">{items.length.toLocaleString()}</b> 項</span>
        <span className="text-neutral-400">「—」は値なし（0 とは別）。合計は「集計」タブ（値のある項だけで足す）</span>
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
            {shown.map(({ k, a }) => {
              const selected = k.id === selectedId;
              return (
                <tr
                  key={k.id}
                  data-row-key={k.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(k)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(k); } }}
                  className={`cursor-pointer border-b border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                >
                  <td className={`break-words px-2 py-1 text-left ${lifecycleGroupsOf(k).length > 1 ? 'text-neutral-500' : ''}`} title={lifecycleGroupsOf(k).length > 1 ? lifecycleGroupsOf(k).join('、') : undefined}>{lifecycleGroupOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{lifecycleAcctOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{lifecycleOrgOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left font-medium">{k.name}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-left font-mono">
                    {LIFECYCLE_STAGES.map(s => (
                      <span key={s} className={k.seenIn.includes(s) ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-300 dark:text-neutral-600'}>{BADGE[s]}</span>
                    ))}
                  </td>
                  <Amount yen={a.request} />
                  <Amount yen={a.budget} />
                  <Amount yen={a.revised} />
                  <Amount yen={a.spent} />
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-neutral-500">{formatSen(a.size / 1000)}</td>
                </tr>
              );
            })}
            {items.length > shown.length && <tr><td colSpan={COLS.length} className="px-2 py-2 text-neutral-500">上位 {shown.length.toLocaleString()} 項を表示（全 {items.length.toLocaleString()} 項）。絞り込みで減らしてください。</td></tr>}
            {items.length === 0 && <tr><td colSpan={COLS.length} className="px-2 py-8 text-center text-neutral-500">条件に合う項がありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
