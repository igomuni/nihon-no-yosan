import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  LIFECYCLE_STAGES,
  formatSen,
  lifecycleAcctOf,
  lifecycleGroupOf,
  lifecycleGroupsOf,
  lifecycleOrgOf,
  lifecyclePublisherOf,
  lifecyclePublishersOf,
  LIFECYCLE_CHAIN_END_LABEL,
  type JikouCount,
  type LifecycleChain,
  type LifecycleKou,
  type LifecycleLinkStatus,
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
export const DEFAULT_COLUMN_WIDTHS: Record<LifecycleSortKey, number> = { publisher: 110, group: 130, acct: 130, org: 120, name: 220, jikou: 64, stages: 72, links: 72, span: 112, request: 96, budget: 96, revised: 96, spent: 96, size: 96 };
const BADGE: Record<LifecycleStage, string> = { request: '要', budget: '政', supp: '補', settle: '決' };
const COLS: { key: LifecycleSortKey; label: string; left?: boolean; title?: string }[] = [
  { key: 'publisher', label: '提出府省', left: true, title: '概算要求書の公開元の府省（要求書の PDF のドメイン由来）。複数の府省の書に載る項は「N府省」。概算要求書の無い年度・項は「—」' },
  { key: 'group', label: '所管', left: true, title: '予算書の所管（原文を府省に分けたもの）' },
  { key: 'acct', label: '会計', left: true },
  { key: 'org', label: '組織／勘定', left: true },
  { key: 'name', label: '項名', left: true },
  { key: 'jikou', label: '事項', title: '項の下の事項の数（その年度。概算要求・予算書の当初予算・補正の事項を合わせた数）。「—」は事項が無い（0 とは別）。決算は事項の単位が無い' },
  { key: 'stages', label: '段階', left: true, title: '値がある段階。要 = 概算要求、政 = 政府案、補 = 補正、決 = 決算（薄い字は、現行のデータに値が無い）' },
  { key: 'links', label: '対応', left: true, title: '年度をまたぐ項の対応。確定 = 同じ鍵などで 1 対 1、未確定 = 候補はあるが根拠がそろわない、候補なし = 相手の年度に候補が無い（項が無くなった・新しくできたとは限らない）' },
  { key: 'span', label: '確認済み年度', left: true, title: '確定した対応（同じ鍵、または名前と額の根拠がそろった 1 対 1）でたどれた年度の範囲と年数。候補・候補なしでは進まない。? は、その先に未確定の候補があること。事業が同じとは限らない' },
  { key: 'request', label: '概算要求', title: '要求額' },
  { key: 'budget', label: '政府案', title: '政府案の額' },
  { key: 'revised', label: '補正後', title: '改予算額（補正の記録がある項）' },
  { key: 'spent', label: '決算', title: '支出済額' },
  { key: 'size', label: '最大額', title: '歳出予算現額・政府案・要求額のうち最大（既定の並びの基準）' },
];

/** 対応の状態の表示。未確定・候補なしは目立たせすぎず、確定との違いが分かる程度にする */
export function LinkBadge({ status }: { status: LifecycleLinkStatus }) {
  const [label, cls] = status === 'RESOLVED' ? ['確定', 'border-emerald-600 text-emerald-700 dark:text-emerald-400'] : status === 'AMBIGUOUS' ? ['未確定', 'border-amber-600 text-amber-700 dark:text-amber-400'] : ['候補なし', 'border-neutral-400 text-neutral-500'];
  return <span className={`rounded-full border px-1.5 text-[10px] ${cls}`}>{label}</span>;
}

/** 確認済みの年度。確定した対応でたどれた範囲。未確定の候補がある端には ? を付ける（そこで止まっただけで、続いていないとは限らない） */
function SpanCell({ chain, span }: { chain: LifecycleChain; span: { from: number; to: number; years: number } }) {
  const mark = (end: LifecycleChain['before']): string => (end === 'ambiguous' || end === 'multiple' ? '?' : '');
  const title = `FY${span.from}${span.from === span.to ? '' : `〜FY${span.to}`}（${span.years} 年）。前: ${LIFECYCLE_CHAIN_END_LABEL[chain.before]} / 後: ${LIFECYCLE_CHAIN_END_LABEL[chain.after]}`;
  return (
    <td className="whitespace-nowrap px-2 py-1 text-left tabular-nums" title={title}>
      <span className="text-amber-700 dark:text-amber-400">{mark(chain.before)}</span>
      {span.from === span.to ? span.from : `${span.from}–${span.to}`}
      <span className="text-amber-700 dark:text-amber-400">{mark(chain.after)}</span>
      <span className="ml-1 text-neutral-400">({span.years}年)</span>
    </td>
  );
}

/** 事項の数。事項が無いときは「—」（0 とは別）、読み込み中は「…」。ツールチップに、補正にだけある事項と概算要求にだけある事項の数 */
function JikouCountCell({ count, loading }: { count: JikouCount | null; loading: boolean }) {
  if (count === null) return <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title={loading ? '事項を読み込み中' : '事項なし（現行のデータに、この項の事項が無い）'}>{loading ? '…' : '—'}</td>;
  const extra = [count.suppOnly > 0 ? `補正にだけある ${count.suppOnly}` : '', count.requestOnly > 0 ? `概算要求にだけある ${count.requestOnly}` : ''].filter(Boolean).join('、');
  return <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={`事項 ${count.total}${extra ? `（うち${extra}）` : ''}`}>{count.total}</td>;
}

/** 額の列。値が無いときは「—」（0 とは別） */
function Amount({ yen }: { yen: number | undefined }) {
  return yen === undefined
    ? <td className="whitespace-nowrap px-2 py-1 text-right text-neutral-300 dark:text-neutral-600" title="値なし">—</td>
    : <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums" title={`${yen.toLocaleString('ja-JP')} 円`}>{yen === 0 ? '0円' : formatSen(yen / 1000)}</td>;
}

export function LifecycleListPane({ items, notice, jikouLoading, sortKey, sortDir, onSort, selectedId, onSelect, widths, onWidthsChange }: {
  /** 絞り込み・並べ替え済み */
  items: readonly { k: LifecycleKou; a: LifecycleRowAmounts; link: LifecycleLinkStatus | null; chain: LifecycleChain; span: { from: number; to: number; years: number }; jikou: JikouCount | null }[];
  /** 一覧の代わりに出す文（事項名で絞るのに、事項のデータが届いていないとき）。無ければ null */
  notice: string | null;
  /** 事項のデータ（`lifecycle/jikou.json.gz`）を読み込み中。このあいだ、事項の列は「…」 */
  jikouLoading: boolean;
  sortKey: LifecycleSortKey;
  sortDir: LifecycleSortDir;
  onSort: (k: LifecycleSortKey) => void;
  selectedId: string | null;
  onSelect: (k: LifecycleKou) => void;
  widths: Record<string, number>;
  onWidthsChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
}) {
  // 一覧の項の、段階ごとの額の合計（値のある項だけ。0 は値）
  const totals = ([['概算要求', 'request'], ['政府案', 'budget'], ['補正後', 'revised'], ['決算', 'spent']] as const).map(([label, k]) => {
    let sum = 0, n = 0;
    for (const x of items) { const v = x.a[k]; if (v !== undefined) { sum += v; n++; } }
    return { label, sum: n === 0 ? null : sum, n };
  });
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

  if (notice !== null) return <p className="p-4 text-xs text-neutral-500">{notice}</p>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
        <span><b className="tabular-nums text-neutral-800 dark:text-neutral-100">{items.length.toLocaleString()}</b> 項</span>
        {totals.map(t => t.sum !== null && <span key={t.label} title={`値のある ${t.n.toLocaleString()} 項の合計（${t.sum.toLocaleString('ja-JP')} 円）`}>{t.label} <b className="tabular-nums text-neutral-800 dark:text-neutral-100">{formatSen(t.sum / 1000)}</b></span>)}
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
            {shown.map(({ k, a, link, chain, span, jikou }) => {
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
                  <td className={`break-words px-2 py-1 text-left ${lifecyclePublishersOf(k).length > 1 ? 'text-neutral-500' : ''}`} title={lifecyclePublishersOf(k).length > 1 ? lifecyclePublishersOf(k).join('、') : undefined}>{lifecyclePublisherOf(k) || <span className="text-neutral-300 dark:text-neutral-600">—</span>}</td>
                  <td className={`break-words px-2 py-1 text-left ${lifecycleGroupsOf(k).length > 1 ? 'text-neutral-500' : ''}`} title={lifecycleGroupsOf(k).length > 1 ? lifecycleGroupsOf(k).join('、') : undefined}>{lifecycleGroupOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{lifecycleAcctOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left">{lifecycleOrgOf(k)}</td>
                  <td className="break-words px-2 py-1 text-left font-medium">{k.name}</td>
                  <JikouCountCell count={jikou} loading={jikouLoading} />
                  <td className="whitespace-nowrap px-2 py-1 text-left font-mono">
                    {LIFECYCLE_STAGES.map(s => (
                      <span key={s} className={k.seenIn.includes(s) ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-300 dark:text-neutral-600'}>{BADGE[s]}</span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-left">{link === null ? '' : <LinkBadge status={link} />}</td>
                  <SpanCell chain={chain} span={span} />
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
