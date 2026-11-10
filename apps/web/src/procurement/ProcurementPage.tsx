import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import {
  INITIAL_PROCUREMENT_FILTERS,
  PROCUREMENT_TEXT_SORT_KEYS,
  filterProcurementRows,
  procurementIndex,
  procurementTrend,
  sortProcurementRows,
  type LifecycleSortDir,
  type ProcurementFilters,
  type ProcurementIndex,
  type ProcurementListRow,
  type ProcurementMeta,
  type ProcurementSortKey,
  type ProcurementYearData,
} from '@nihon-no-yosan/core';
import { loadGzJson } from '../data.ts';
import { PageNavMenu } from '../components/PageNavMenu.tsx';
import { NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { SourceNote } from '../components/SourceNote.tsx';
import { YearSelect } from '../components/YearSelect.tsx';
import { usePaneKeys } from '../components/useListKeys.ts';
import { usePersistedState } from '../usePersistedState.ts';
import { ProcurementAggregateDetail } from './ProcurementAggregateDetail.tsx';
import { ProcurementDetailPane } from './ProcurementDetailPane.tsx';
import { ProcurementFilterPane } from './ProcurementFilterPane.tsx';
import { ProcurementListPane } from './ProcurementListPane.tsx';

/**
 * 調達を観る（調達ポータルの落札実績）。仕様: docs/guides/procurement.md
 *
 * 左にフィルタ、中に選んだ年度の落札実績の一覧、右に選んだ行の原本の値と、同じ案件番号・同じ落札者の行。中ペインの集計行を選ぶと、右ペインに、今のフィルタを全年度に掛けた年度推移（グラフと表）。
 * データは `npm run build:data` が作る静的ファイル（目録 `procurement/meta.json.gz`、年度ごとの `procurement/{年度}.json.gz`）をブラウザが直接読む。年度のファイルは、選んだときに読む（集計行を選んだときは、足りない年度をすべて読む）。
 * 載っているのは、落札が決まった案件だけ。公告中・不調の案件、少額の一部（個人事業主）は載っていない。
 */

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const FILTER_WIDTH = { def: 240, min: 180, max: 420 };
const DETAIL_WIDTH = { def: 400, min: 300, max: 700 };
// overflow は枠ごとに付ける（overflow-hidden と overflow-auto を同時に付けると hidden が効き、詳細がスクロールできない）
const pane = 'min-h-0 min-w-0 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';

/** ペイン間のつまみ（`MofPage` と同じ）。ドラッグで隣のペインの幅を変える（xl 以上のみ） */
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

const message = (text: React.ReactNode, error = false) => (
  <main className="mx-auto max-w-3xl p-8">
    <p className={error ? 'rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800' : 'text-sm text-neutral-500'}>{text}</p>
  </main>
);

export function ProcurementPage() {
  const [meta, setMeta] = useState<ProcurementMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = usePersistedState<number | null>('procurement:year', null);
  // フィルタ・並べ替え・選んだ行も、再読み込みで戻らないよう localStorage に保存する（保存値を既定値の上に重ねる）
  const [storedFilters, setFilters] = usePersistedState<ProcurementFilters>('procurement:filters', INITIAL_PROCUREMENT_FILTERS);
  const filters = useMemo(() => ({ ...INITIAL_PROCUREMENT_FILTERS, ...storedFilters }), [storedFilters]);
  const [sortKey, setSortKey] = usePersistedState<ProcurementSortKey>('procurement:sortKey', 'yen');
  const [sortDir, setSortDir] = usePersistedState<LifecycleSortDir>('procurement:sortDir', -1);
  const [selected, setSelected] = usePersistedState<{ year: number; i: number } | null>('procurement:selected', null);
  const [filterWidth, setFilterWidth] = usePersistedState('procurement:filterWidth', FILTER_WIDTH.def);
  const [detailWidth, setDetailWidth] = usePersistedState('procurement:detailWidth', DETAIL_WIDTH.def);
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>('procurement:columnWidths', {});
  // 読み込んだ年度（年度 → 一覧の行と引き表）と、読み込みに失敗した年度（年度 → 理由）
  const [loaded, setLoaded] = useState<ReadonlyMap<number, ProcurementIndex>>(new Map());
  const [failed, setFailed] = useState<ReadonlyMap<number, string>>(new Map());
  const requested = useRef(new Set<number>());
  // 集計行を選んでいるか（選ぶと、右ペインに一覧全体の年度推移）。初期は選んでいる（開くと、全年度のファイルを読み込み始める）。保存しない（選んだ行は、再読み込みで戻らない）
  const [summarySelected, setSummarySelected] = useState(true);
  usePaneKeys();

  useEffect(() => {
    let alive = true;
    loadGzJson<ProcurementMeta>('procurement/meta.json.gz')
      .then(d => { if (alive) setMeta(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const years = useMemo(() => (meta ? meta.years.map(y => y.year) : []), [meta]);
  const activeYear = meta ? (year !== null && years.includes(year) ? year : years[years.length - 1] ?? null) : null;

  /** 年度のファイルを読む（読み込み中・読み込み済み・失敗した年度は、読み直さない） */
  const ensureYear = useCallback((y: number) => {
    if (!meta || requested.current.has(y)) return;
    requested.current.add(y);
    loadGzJson<ProcurementYearData>(`procurement/${y}.json.gz`)
      .then(d => setLoaded(prev => new Map(prev).set(y, procurementIndex(d, meta))))
      .catch((e: unknown) => setFailed(prev => new Map(prev).set(y, e instanceof Error ? e.message : String(e))));
  }, [meta]);
  useEffect(() => { if (activeYear !== null) ensureYear(activeYear); }, [activeYear, ensureYear]);
  useEffect(() => { if (summarySelected) years.forEach(ensureYear); }, [summarySelected, years, ensureYear]);

  const yearError = activeYear !== null ? failed.get(activeYear) ?? null : null;
  const index = activeYear !== null ? loaded.get(activeYear) ?? null : null;
  const rows = useMemo(() => (index ? sortProcurementRows(filterProcurementRows(index.rows, filters, NONE_SELECTED), sortKey, sortDir) : []), [index, filters, sortKey, sortDir]);
  const trend = useMemo(() => (summarySelected ? procurementTrend(years, y => loaded.get(y)?.rows, filters, NONE_SELECTED) : []), [summarySelected, years, loaded, filters]);
  const selectedRow: ProcurementListRow | null = index && selected && selected.year === activeYear ? index.rows[selected.i] ?? null : null;

  if (error) return message(<>データの読み込みに失敗しました: {error}（<code>npm run build:data</code> で作る）</>, true);
  if (!meta || activeYear === null) return message('読み込み中…');

  const onSort = (k: ProcurementSortKey) => {
    if (k === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(PROCUREMENT_TEXT_SORT_KEYS.includes(k) ? 1 : -1); }
  };
  const select = (i: number) => { setSummarySelected(false); setSelected({ year: activeYear, i }); };
  const info = meta.years.find(y => y.year === activeYear)!;

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div>
          <h1 className="text-base font-semibold">調達を観る</h1>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            落札実績（政府電子調達）· FY{activeYear}（落札決定日 {info.dateMin}〜{info.dateMax}）· 載っているのは落札が決まった案件だけ（公告中・不調の案件、少額の個人事業主は含まない）· 出典: 調達ポータル（デジタル庁）
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <YearSelect value={String(activeYear)} onChange={y => { setYear(Number(y)); }} years={years} />
          <PageNavMenu current="procurement" />
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:flex xl:gap-0">
        <section aria-label="フィルタ" className={`${pane} overflow-hidden xl:w-[var(--fw)] xl:shrink-0`} style={{ '--fw': `${filterWidth}px` } as CSSProperties}>
          {index ? <ProcurementFilterPane rows={index.rows} filters={filters} onChange={setFilters} /> : <p className="p-4 text-xs text-neutral-500">{yearError ? '' : '読み込み中…'}</p>}
        </section>
        <Splitter label="フィルタの幅" width={filterWidth} limits={FILTER_WIDTH} dir={1} onChange={setFilterWidth} />
        <section aria-label="落札実績の一覧" className={`${pane} flex flex-col overflow-hidden xl:min-w-0 xl:flex-1`}>
          {yearError
            ? <p className="p-4 text-xs text-red-700">FY{activeYear} の読み込みに失敗しました: {yearError}（<code>npm run build:data</code> で作る）</p>
            : index
              ? <ProcurementListPane items={rows} sortKey={sortKey} sortDir={sortDir} onSort={onSort} selected={summarySelected ? null : selectedRow?.i ?? null} onSelect={r => select(r.i)} summarySelected={summarySelected} onSelectSummary={() => setSummarySelected(true)} widths={columnWidths} onWidthsChange={setColumnWidths} />
              : <p className="p-4 text-xs text-neutral-500">FY{activeYear} を読み込み中…（{info.rows.toLocaleString()} 行）</p>}
        </section>
        <Splitter label="詳細の幅" width={detailWidth} limits={DETAIL_WIDTH} dir={-1} onChange={setDetailWidth} />
        <section aria-label="詳細" className={`${pane} overflow-auto lg:col-span-2 xl:col-span-1 xl:w-[var(--dw)] xl:shrink-0`} style={{ '--dw': `${detailWidth}px` } as CSSProperties}>
          {summarySelected
            ? <ProcurementAggregateDetail trend={trend} failed={failed} year={activeYear} onYear={setYear} />
            : index ? <ProcurementDetailPane index={index} row={selectedRow} year={activeYear} onSelect={select} /> : null}
        </section>
      </main>
      <SourceNote procurement />
    </div>
  );
}
