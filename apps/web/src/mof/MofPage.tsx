import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import {
  INITIAL_MOF_FILTERS,
  filterMofRows,
  mofRowKey,
  sortMofRows,
  type BudgetRequestMofData,
  type BudgetRequestMofDetailData,
  type MofFilters,
  type MofSortDir,
  type MofSortKey,
} from '@nihon-no-yosan/core';
import { loadGzJson } from '../data.ts';
import { PageNavMenu } from '../components/PageNavMenu.tsx';
import { YearSelect } from '../components/YearSelect.tsx';
import { usePersistedState } from '../usePersistedState.ts';
import { MofDetailPane, type MofDetailTab } from './MofDetailPane.tsx';
import { MofFilterPane } from './MofFilterPane.tsx';
import { MofListPane } from './MofListPane.tsx';
import { MofScatter } from './MofScatter.tsx';

/**
 * 概算要求と当初予算（予算書・国会提出時の政府案）の差（項の粒度, FY2023〜2026）。
 *
 * 左にフィルタ、中に選択年度の一覧（要求額・当初予算額・差）または分布図（横軸 = 要求額、縦軸 = 当初予算額）、右に選んだ項の要求書へのリンクと差の理由の型。
 * データは `npm run build:data` が作る静的ファイル（`mof/kou.json.gz`、事項・目の内訳は `mof/detail.json.gz`）をブラウザが直接読む。
 * 仕様: docs/guides/mof-ui.md、mof-screen.md。年度推移とは別のページ（予算書との突合を年度推移に混ぜない）。
 */

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const FILTER_WIDTH = { def: 240, min: 180, max: 420 };
const DETAIL_WIDTH = { def: 400, min: 300, max: 700 };
// overflow は枠ごとに付ける（overflow-hidden と overflow-auto を同時に付けると hidden が効き、詳細がスクロールできない）
const pane = 'min-h-0 min-w-0 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';

/** ペイン間のつまみ（/budget-request-trend と同じ）。ドラッグで隣のペインの幅を変える（xl 以上のみ） */
function Splitter({ label, width, limits, dir, onChange }: { label: string; width: number; limits: { min: number; max: number }; dir: 1 | -1; onChange: (w: number) => void }) {
  const start = (e: ReactMouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = width;
    const move = (ev: MouseEvent) => onChange(Math.min(limits.max, Math.max(limits.min, w0 + dir * (ev.clientX - x0))));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); setBodyCursor(''); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    setBodyCursor('col-resize');
  };
  return <div role="separator" aria-orientation="vertical" aria-label={label} onMouseDown={start} className="hidden w-1.5 shrink-0 cursor-col-resize rounded hover:bg-emerald-500/40 xl:block" />;
}

export function MofPage() {
  const [data, setData] = useState<BudgetRequestMofData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = usePersistedState<number | null>('mof:year', null);
  // フィルタ・並べ替え・選んだ項も、再読み込みで戻らないよう localStorage に保存する。
  // フィルタは保存値を既定値の上に重ねる（項目が増えた後に、古い保存値を読んでも欠けないように）
  const [storedFilters, setFilters] = usePersistedState<MofFilters>('mof:filters', INITIAL_MOF_FILTERS);
  const filters = useMemo(() => ({ ...INITIAL_MOF_FILTERS, ...storedFilters }), [storedFilters]);
  const [sortKey, setSortKey] = usePersistedState<MofSortKey>('mof:sortKey', 'diff');
  const [sortDir, setSortDir] = usePersistedState<MofSortDir>('mof:sortDir', -1);
  const [selectedKey, setSelectedKey] = usePersistedState<string | null>('mof:selected', null);
  const [filterWidth, setFilterWidth] = usePersistedState('mof:filterWidth', FILTER_WIDTH.def);
  const [detailWidth, setDetailWidth] = usePersistedState('mof:detailWidth', DETAIL_WIDTH.def);
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>('mof:columnWidths', {});
  const [view, setView] = usePersistedState<'list' | 'scatter'>('mof:view', 'list');
  const [detailTab, setDetailTab] = usePersistedState<MofDetailTab>('mof:detailTab', 'kou');
  const [detail, setDetail] = useState<BudgetRequestMofDetailData | null>(null);
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGzJson<BudgetRequestMofData>('mof/kou.json.gz')
      .then(d => { if (alive) setData(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    // 事項・目の内訳は一覧の後に読む（一覧の表示を待たせない）
    loadGzJson<BudgetRequestMofDetailData>('mof/detail.json.gz')
      .then(d => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetailError(true); });
    return () => { alive = false; };
  }, []);

  const years = data?.years ?? [];
  const activeYear = data ? (year !== null && years.includes(year) ? year : years[years.length - 1]!) : null;
  const rows = useMemo(() => (data && activeYear !== null ? sortMofRows(filterMofRows(data.rows, filters, activeYear, data.urls), sortKey, sortDir, data.urls) : []), [data, filters, sortKey, sortDir, activeYear]);
  const selected = useMemo(() => (data && selectedKey ? data.rows.find(r => mofRowKey(r) === selectedKey) ?? null : null), [data, selectedKey]);

  if (error) return <main className="mx-auto max-w-3xl p-8"><p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">データの読み込みに失敗しました: {error}（<code>npm run build:data</code> で作る）</p></main>;
  if (!data || activeYear === null) return <main className="mx-auto max-w-3xl p-8"><p className="text-sm text-neutral-500">読み込み中…</p></main>;

  const onSort = (k: MofSortKey) => {
    if (k === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(k === 'group' || k === 'acct' || k === 'org' || k === 'name' ? 1 : -1); }
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div>
          <h1 className="text-base font-semibold">概算要求と当初予算</h1>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            項の粒度 · FY{years[0]}–FY{years[years.length - 1]} · 差 = 当初予算額（予算書・国会提出時の政府案）− 概算要求額 · 出典: 各府省の歳出概算要求書、財務省の予算書
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <YearSelect value={String(activeYear)} onChange={y => { setYear(Number(y)); setSelectedKey(null); }} years={years} />
          <PageNavMenu current="mof" />
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:flex xl:gap-0">
        <section aria-label="フィルタ" className={`${pane} overflow-hidden xl:w-[var(--fw)] xl:shrink-0`} style={{ '--fw': `${filterWidth}px` } as CSSProperties}>
          <MofFilterPane rows={data.rows} urls={data.urls} year={activeYear} filters={filters} onChange={setFilters} />
        </section>
        <Splitter label="フィルタの幅" width={filterWidth} limits={FILTER_WIDTH} dir={1} onChange={setFilterWidth} />
        <section aria-label="項の一覧" className={`${pane} flex flex-col overflow-hidden xl:min-w-0 xl:flex-1`}>
          <div role="tablist" aria-label="表示" className="flex shrink-0 gap-1 border-b border-neutral-200 px-3 pt-2 text-xs dark:border-neutral-800">
            {(['list', 'scatter'] as const).map(v => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-t border-b-2 px-2.5 py-1 ${view === v ? 'border-emerald-600 font-semibold text-neutral-900 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
                {v === 'list' ? '一覧' : '分布図'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {view === 'list'
              ? <MofListPane rows={rows} urls={data.urls} sortKey={sortKey} sortDir={sortDir} onSort={onSort} selectedKey={selectedKey} onSelect={r => setSelectedKey(mofRowKey(r))} widths={columnWidths} onWidthsChange={setColumnWidths} />
              : <MofScatter rows={rows} selectedKey={selectedKey} onSelect={r => setSelectedKey(mofRowKey(r))} />}
          </div>
        </section>
        <Splitter label="詳細の幅" width={detailWidth} limits={DETAIL_WIDTH} dir={-1} onChange={setDetailWidth} />
        <section aria-label="詳細" className={`${pane} overflow-auto lg:col-span-2 xl:col-span-1 xl:w-[var(--dw)] xl:shrink-0`} style={{ '--dw': `${detailWidth}px` } as CSSProperties}>
          <MofDetailPane row={selected} urls={data.urls} version={data.versions[String(activeYear)] ?? ''} detail={detail} detailError={detailError} tab={detailTab} onTab={setDetailTab} rowKey={selected ? mofRowKey(selected) : null} />
        </section>
      </main>
    </div>
  );
}
