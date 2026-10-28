import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { usePaneKeys } from '../components/useListKeys.ts';
import {
  INITIAL_LIFECYCLE_FILTERS,
  LIFECYCLE_PATTERNS,
  type LifecycleKou,
  filterLifecycleKous,
  lifecycleChainSpan,
  lifecycleChains,
  lifecycleCoverage,
  lifecycleLinkGap,
  lifecycleLinkState,
  lifecycleLinksByKou,
  lifecyclePatternCounts,
  lifecycleRowAmounts,
  lifecycleSourcePresence,
  filterJikouRows,
  filterMokuRows,
  kouIdsWithMoku,
  MOKU_TEXT_SORT_KEYS,
  mokuIndex,
  mokuListRows,
  mokuSelectionKey,
  mokuSettleNote,
  mokuSuppNote,
  sortMokuRows,
  type LifecycleMokuData,
  type MokuIndex,
  type MokuListRow,
  type MokuSortKey,
  jikouCounts,
  jikouIndex,
  jikouListRows,
  kouIdsWithJikou,
  lifecycleValues,
  matchesLifecycleLinks,
  matchesLifecyclePattern,
  sortJikouRows,
  sortLifecycleRows,
  type JikouIndex,
  type JikouSortKey,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecycleJikouData,
  type LifecycleFilters,
  type LifecycleSortDir,
  type LifecycleSortKey,
  type LifecycleValues,
  INITIAL_RS_FILTERS,
  RS_SPENT_UNFILLED_NOTE,
  RS_TEXT_SORT_KEYS,
  filterRsRows,
  rsIndex,
  rsListRows,
  sortRsRows,
  type RsFilters,
  type RsIndex,
  type RsJigyoData,
  type RsListRow,
  type RsSortKey,
  type SiteAbout,
} from '@nihon-no-yosan/core';
import { loadGzJson, loadJson } from '../data.ts';
import { NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { PageNavMenu } from '../components/PageNavMenu.tsx';
import { SourceNote } from '../components/SourceNote.tsx';
import { YearSelect } from '../components/YearSelect.tsx';
import { usePersistedState } from '../usePersistedState.ts';
import { LifecycleDetailPane, type DetailTab } from './LifecycleDetailPane.tsx';
import { LifecycleFilterPane } from './LifecycleFilterPane.tsx';
import { LifecycleJikouDetail } from './LifecycleJikouDetail.tsx';
import { LifecycleJikouListPane } from './LifecycleJikouListPane.tsx';
import { LifecycleListPane } from './LifecycleListPane.tsx';
import { LifecycleMokuDetail } from './LifecycleMokuDetail.tsx';
import { LifecycleMokuListPane } from './LifecycleMokuListPane.tsx';
import { LifecycleSummaryPane } from './LifecycleSummaryPane.tsx';
import { RsDetail } from './RsDetail.tsx';
import { RsFilterPane } from './RsFilterPane.tsx';
import { RsListPane } from './RsListPane.tsx';

/**
 * 予算の推移（項の粒度。年度ごとに、基準データにある段階だけ）。1 つの項について、概算要求 → 政府案 → 補正 → 決算の値を、段階ごとの状態・グラフ・表で見る。
 *
 * 左にフィルタ、中に項の一覧または集計、右に選んだ項の一生。
 * 仕様: docs/guides/budget-lifecycle.md。段階の状態の定義: docs/guides/lifecycle-status.md。
 * 欠けている値や、確かめられていない関係は、補完も断定もしない（0 と「値なし」を分ける）。
 */

/** ドラッグ中のカーソル（イベントの外から body を変えるので、関数にまとめる） */
function setBodyCursor(value: string): void {
  document.body.style.cursor = value;
}

const FILTER_WIDTH = { def: 240, min: 180, max: 420 };
const DETAIL_WIDTH = { def: 480, min: 340, max: 800 };
// overflow は枠ごとに付ける（overflow-hidden と overflow-auto を同時に付けると hidden が効き、詳細がスクロールできない）
const pane = 'min-h-0 min-w-0 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';

/** ペイン間のつまみ。ドラッグで隣のペインの幅を変える（xl 以上のみ） */
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

const NO_KOUS: readonly LifecycleKou[] = [];

export function LifecyclePage() {
  usePaneKeys();
  const [data, setData] = useState<LifecycleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = usePersistedState<number | null>('lifecycle:year', null);
  // フィルタは保存値を既定値の上に重ねる（項目が増えた後に、古い保存値を読んでも欠けないように）
  const [storedFilters, setFilters] = usePersistedState<LifecycleFilters>('lifecycle:filters', INITIAL_LIFECYCLE_FILTERS);
  const filters = useMemo(() => ({ ...INITIAL_LIFECYCLE_FILTERS, ...storedFilters }), [storedFilters]);
  const [sortKey, setSortKey] = usePersistedState<LifecycleSortKey>('lifecycle:sortKey', 'size');
  const [sortDir, setSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:sortDir', -1);
  const [selectedId, setSelectedId] = usePersistedState<string | null>('lifecycle:selected', null);
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:columnWidths', {});
  const [storedView, setView] = usePersistedState<'list' | 'jikou' | 'moku' | 'rs' | 'summary'>('lifecycle:view', 'list');
  // RS の事業（中ペインの「RS」）。RS のデータを載せたビルドだけにある（`about.json` の `rs`）。選んだ事業は、予算事業 ID で持つ
  const [rsAvailable, setRsAvailable] = useState<boolean | null>(null);
  const view = storedView === 'rs' && rsAvailable === false ? 'list' : storedView;
  const [selectedRs, setSelectedRs] = usePersistedState<string | null>('lifecycle:selectedRs', null);
  const [storedRsFilters, setRsFilters] = usePersistedState<RsFilters>('lifecycle:rsFilters', INITIAL_RS_FILTERS);
  const rsFilters = useMemo(() => ({ ...INITIAL_RS_FILTERS, ...storedRsFilters }), [storedRsFilters]);
  const [rsSortKey, setRsSortKey] = usePersistedState<RsSortKey>('lifecycle:rsSortKey', 'current');
  const [rsSortDir, setRsSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:rsSortDir', -1);
  const [rsColumnWidths, setRsColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:rsColumnWidths', {});
  // 事項の一覧（中ペインの「事項」）。選んだ事項は、`${項の id}|${事項名}` で持つ（事項のデータの添字は、データを作り直すと変わるため）
  const [selectedJikou, setSelectedJikou] = usePersistedState<string | null>('lifecycle:selectedJikou', null);
  const [jikouSortKey, setJikouSortKey] = usePersistedState<JikouSortKey>('lifecycle:jikouSortKey', 'size');
  const [jikouSortDir, setJikouSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:jikouSortDir', -1);
  const [jikouColumnWidths, setJikouColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:jikouColumnWidths', {});
  // 目の一覧（中ペインの「目」）。選んだ目は、`${項の id}|${目の識別}` で持つ（`mokuSelectionKey`）
  const [selectedMoku, setSelectedMoku] = usePersistedState<string | null>('lifecycle:selectedMoku', null);
  const [mokuSortKey, setMokuSortKey] = usePersistedState<MokuSortKey>('lifecycle:mokuSortKey', 'size');
  const [mokuSortDir, setMokuSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:mokuSortDir', -1);
  const [mokuColumnWidths, setMokuColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:mokuColumnWidths', {});
  const [detailTab, setDetailTab] = usePersistedState<DetailTab>('lifecycle:detailTab', 'life');
  const [filterWidth, setFilterWidth] = usePersistedState('lifecycle:filterWidth', FILTER_WIDTH.def);
  const [detailWidth, setDetailWidth] = usePersistedState('lifecycle:detailWidth', DETAIL_WIDTH.def);

  useEffect(() => {
    let alive = true;
    loadGzJson<LifecycleData>('lifecycle/data.json.gz')
      .then(d => { if (alive) setData(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  // 項ごとの出来事（導出の行を除く）と、項目ごとの値、並べ替えの大きさ（現額・政府案・要求額のうち最大）
  const byKou = useMemo(() => {
    const m = new Map<number, LifecycleEventRow[]>();
    for (const e of data?.events ?? []) (m.get(e[0]) ?? m.set(e[0], []).get(e[0])!).push(e);
    return m;
  }, [data]);
  const valuesOf = useMemo(() => {
    const m = new Map<number, LifecycleValues>();
    for (const [i, es] of byKou) m.set(i, lifecycleValues(es.filter(e => e[1] !== 'derived')));
    return m;
  }, [byKou]);
  const linksByKou = useMemo(() => lifecycleLinksByKou(data?.links ?? []), [data]);
  const coverage = useMemo(() => lifecycleCoverage(data?.kous ?? []), [data]);
  const presence = useMemo(() => lifecycleSourcePresence(data?.kous ?? []), [data]);
  const chainOf = useMemo(() => lifecycleChains(data?.kous ?? [], data?.links ?? [], data?.years ?? []), [data]);

  // 事項（lifecycle/jikou.json.gz。項の一覧の「事項」列と、事項のタブが使う）は、項の一覧の表示を待たせず、後から読む。結果（索引か失敗）は、読み終えたときに入れる
  const [jikouResult, setJikouResult] = useState<{ index: JikouIndex } | { failed: true } | null>(null);
  const jikouRequested = useRef(false);
  useEffect(() => {
    if (jikouRequested.current) return;
    jikouRequested.current = true;
    loadGzJson<LifecycleJikouData>('lifecycle/jikou.json.gz')
      .then(d => setJikouResult({ index: jikouIndex(d) }))
      .catch(() => setJikouResult({ failed: true }));
  }, []);
  const jikou = jikouResult && 'index' in jikouResult ? jikouResult.index : null;
  const jikouState = jikouResult === null ? 'loading' : 'index' in jikouResult ? 'ready' : 'error';
  const jikouCountOf = useMemo(() => (jikou ? jikouCounts(jikou) : null), [jikou]);

  // 目（lifecycle/moku.json.gz。大きいので、目のタブを開いたとき、または目名で絞るときに読む）
  const [mokuResult, setMokuResult] = useState<{ index: MokuIndex } | { failed: true } | null>(null);
  const mokuRequested = useRef(false);
  const needMoku = view === 'moku' || (view === 'list' && detailTab === 'moku') || storedFilters.mokuName?.trim();
  useEffect(() => {
    if (!needMoku || mokuRequested.current) return;
    mokuRequested.current = true;
    loadGzJson<LifecycleMokuData>('lifecycle/moku.json.gz')
      .then(d => setMokuResult({ index: mokuIndex(d) }))
      .catch(() => setMokuResult({ failed: true }));
  }, [needMoku]);
  const moku = mokuResult && 'index' in mokuResult ? mokuResult.index : null;
  const mokuState = mokuResult === null ? 'loading' : 'index' in mokuResult ? 'ready' : 'error';

  useEffect(() => {
    let alive = true;
    loadJson<SiteAbout>('about.json').then(a => { if (alive) setRsAvailable(a.rs !== undefined); }).catch(() => { if (alive) setRsAvailable(false); });
    return () => { alive = false; };
  }, []);
  // RS の事業（rs/jigyo.json.gz。RS のタブを開いたときに読む）
  const [rsResult, setRsResult] = useState<{ index: RsIndex } | { failed: true } | null>(null);
  const rsRequested = useRef(false);
  useEffect(() => {
    if (view !== 'rs' || rsRequested.current) return;
    rsRequested.current = true;
    loadGzJson<RsJigyoData>('rs/jigyo.json.gz')
      .then(d => setRsResult({ index: rsIndex(d) }))
      .catch(() => setRsResult({ failed: true }));
  }, [view]);
  const rs = rsResult && 'index' in rsResult ? rsResult.index : null;
  const rsState = rsResult === null ? 'loading' : 'index' in rsResult ? 'ready' : 'error';

  const years = useMemo(() => data?.years ?? [], [data]);
  const activeYear = data ? (year !== null && years.includes(year) ? year : years[0]!) : null;
  // 年度・所管・会計・組織・項名で絞った項（値のある段階で絞る前）。段階ごとの件数は、この集合で数える
  const inYear = useMemo(() => (data && activeYear !== null ? data.kous.filter(k => k.year === activeYear) : []), [data, activeYear]);
  // 事項名の絞り込みは、その年度に事項名が合う事項を持つ項に絞る（事項のデータが届くまでは絞れないので、項の一覧は読み込み中の表示にする）
  const jikouKouSet = useMemo(() => (jikou && activeYear !== null ? kouIdsWithJikou(jikou, activeYear, filters.jikouName, filters.jikouNameRegex) : null), [jikou, activeYear, filters.jikouName, filters.jikouNameRegex]);
  const mokuKouSet = useMemo(() => (moku && activeYear !== null ? kouIdsWithMoku(moku, activeYear, filters.mokuName, filters.mokuNameRegex) : null), [moku, activeYear, filters.mokuName, filters.mokuNameRegex]);
  const jikouFilterNotice = filters.jikouName.trim() !== '' && jikouState !== 'ready'
    ? (jikouState === 'loading' ? '事項を読み込み中…' : '事項の読み込みに失敗しました（npm run build:data で作る）。')
    : filters.mokuName.trim() !== '' && mokuState !== 'ready'
      ? (mokuState === 'loading' ? '目を読み込み中…' : '目の読み込みに失敗しました（npm run build:data で作る）。')
      : null;
  const base = useMemo(() => {
    if (!data || activeYear === null) return [];
    const kous = filterLifecycleKous(data.kous.map((k, i) => ({ k, i })), filters, activeYear);
    return kous.filter(({ k }) => (jikouKouSet === null || jikouKouSet.has(k.id)) && (mokuKouSet === null || mokuKouSet.has(k.id)));
  }, [data, activeYear, filters, jikouKouSet, mokuKouSet]);
  const patternCounts = useMemo(() => lifecyclePatternCounts(base.map(x => x.k)), [base]);
  const unsettledCount = useMemo(() => base.filter(({ i }) => matchesLifecycleLinks(lifecycleLinkState(linksByKou.get(i)), { ...INITIAL_LIFECYCLE_FILTERS, links: 'unsettled' })).length, [base, linksByKou]);
  const list = useMemo(
    () => sortLifecycleRows(
      base
        .map(({ k, i }) => { const chain = chainOf(i); const span = lifecycleChainSpan(data?.kous ?? [], chain); return { k, i, a: lifecycleRowAmounts(valuesOf.get(i) ?? {}), link: lifecycleLinkState(linksByKou.get(i)), linkGap: lifecycleLinkGap(presence, years, data?.kous ?? [], i, linksByKou.get(i)), chain, span, years: span.years, jikou: jikouCountOf?.get(k.id) ?? null }; })
        .filter(({ k, link }) => matchesLifecyclePattern(k, filters) && matchesLifecycleLinks(link, filters)),
      sortKey,
      sortDir,
    ),
    [base, data, chainOf, filters, valuesOf, linksByKou, jikouCountOf, presence, years, sortKey, sortDir],
  );
  // 事項の一覧: 選んだ年度の事項を、項の一覧と同じフィルタ（所管・会計・組織／勘定・項名）と事項名で絞る
  const kouById = useMemo(() => new Map((data?.kous ?? []).map(k => [k.id, k])), [data]);
  const jikouRows = useMemo(() => (jikou && activeYear !== null ? jikouListRows(jikou, kouById, activeYear) : []), [jikou, kouById, activeYear]);
  const jikouList = useMemo(() => (activeYear === null ? [] : sortJikouRows(filterJikouRows(jikouRows, filters, activeYear), jikouSortKey, jikouSortDir)), [jikouRows, filters, activeYear, jikouSortKey, jikouSortDir]);
  const selectedJikouNode = useMemo(() => {
    const node = jikou && selectedJikou !== null ? jikou.nodeByKey.get(selectedJikou) : undefined;
    return node !== undefined && jikou!.data.nodes[node]![1] === activeYear ? node : null;
  }, [jikou, selectedJikou, activeYear]);
  const onJikouSort = (k: JikouSortKey) => {
    if (k === jikouSortKey) setJikouSortDir(d => (d === 1 ? -1 : 1));
    else { setJikouSortKey(k); setJikouSortDir(k === 'publisher' || k === 'group' || k === 'acct' || k === 'org' || k === 'kou' || k === 'name' ? 1 : -1); }
  };
  // 目の一覧: 選んだ年度の目を、項の一覧と同じフィルタ（所管・会計・組織／勘定・項名）と目名で絞る
  const kouIndexById = useMemo(() => new Map((data?.kous ?? []).map((k, i) => [k.id, i])), [data]);
  // 目の確認済み年度に使う、項ごとの確定した対応でたどった項の id（年度の古い順）
  const mokuRows = useMemo(() => {
    if (!moku || activeYear === null || !data) return [];
    const cache = new Map<string, string[]>();
    const chainIds = (kouId: string): string[] => {
      let ids = cache.get(kouId);
      if (!ids) { const i = kouIndexById.get(kouId); ids = i === undefined ? [kouId] : chainOf(i).members.map(m => data.kous[m]!.id); cache.set(kouId, ids); }
      return ids;
    };
    return mokuListRows(moku, kouById, activeYear, chainIds);
  }, [moku, kouById, activeYear, data, kouIndexById, chainOf]);
  const mokuList = useMemo(() => (activeYear === null ? [] : sortMokuRows(filterMokuRows(mokuRows, filters, activeYear), mokuSortKey, mokuSortDir)), [mokuRows, filters, activeYear, mokuSortKey, mokuSortDir]);
  // RS の事業の一覧（選んだ年度の事業。項に結べない事業も含める）
  const rsYearRows = useMemo<RsListRow[]>(() => (rs && activeYear !== null ? rsListRows(rs, activeYear) : []), [rs, activeYear]);
  const rsList = useMemo(() => sortRsRows(filterRsRows(rsYearRows, rsFilters, NONE_SELECTED), rsSortKey, rsSortDir), [rsYearRows, rsFilters, rsSortKey, rsSortDir]);
  const rsMinistries = useMemo(() => (rs ? rs.data.jigyo.map(j => j[2]) : []), [rs]);
  const onRsSort = (k: RsSortKey) => {
    if (k === rsSortKey) setRsSortDir(d => (d === 1 ? -1 : 1));
    else { setRsSortKey(k); setRsSortDir(RS_TEXT_SORT_KEYS.includes(k) ? 1 : -1); }
  };
  const selectedMokuNode = useMemo(() => {
    const node = moku && selectedMoku !== null ? moku.nodeByKey.get(selectedMoku) : undefined;
    return node !== undefined && moku!.data.nodes[node]![1] === activeYear ? node : null;
  }, [moku, selectedMoku, activeYear]);
  // 選んだ目の項を通る、確定した対応でたどった項（年度の古い順）
  const mokuChainKouIds = useMemo(() => {
    if (!moku || selectedMokuNode === null || !data) return [];
    const i = kouIndexById.get(moku.data.kous[moku.data.nodes[selectedMokuNode]![0]]!);
    return i === undefined ? [] : chainOf(i).members.map(m => data.kous[m]!.id);
  }, [moku, selectedMokuNode, kouIndexById, chainOf, data]);
  const mokuWhy = (r: MokuListRow) => (moku ? { supp: mokuSuppNote(moku.data, moku.data.nodes[r.node]!), settle: mokuSettleNote(moku.data, moku.data.nodes[r.node]!) } : { supp: null, settle: null });
  const onMokuSort = (k: MokuSortKey) => {
    if (k === mokuSortKey) setMokuSortDir(d => (d === 1 ? -1 : 1));
    else { setMokuSortKey(k); setMokuSortDir(MOKU_TEXT_SORT_KEYS.includes(k) ? 1 : -1); }
  };
  const jikouKeyOf = (node: number): string => `${jikou!.data.kous[jikou!.data.nodes[node]![0]]}|${jikou!.data.nodes[node]![2]}`;
  const onSort = (k: LifecycleSortKey) => {
    if (k === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(k === 'publisher' || k === 'group' || k === 'acct' || k === 'org' || k === 'name' || k === 'links' ? 1 : -1); }
  };

  if (error) return <main className="mx-auto max-w-3xl p-8"><p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">データの読み込みに失敗しました: {error}（<code>npm run build:data</code> で作る）</p></main>;
  if (!data || activeYear === null) return <main className="mx-auto max-w-3xl p-8"><p className="text-sm text-neutral-500">読み込み中…</p></main>;

  // 選んだ項は、年度が違えば無効にする（kou.id が年度を含むかに頼らず、年度で確かめる）
  const selectedIndex = selectedId === null ? -1 : data.kous.findIndex(k => k.id === selectedId && k.year === activeYear);
  const kou = selectedIndex >= 0 ? data.kous[selectedIndex]! : null;
  const checks = data.checks.filter(c => c.year === activeYear);
  const listed = (names: string[]): string => (names.length === 0 ? 'すべて' : names.join('、'));
  const text = (label: string, value: string, regex: boolean): string => (value.trim() === '' ? '' : ` · ${label}: 「${value.trim()}」${regex ? '（正規表現）' : ''}`);
  const scope = `FY${activeYear}${filters.publishers.length > 0 ? ` · 要求所管: ${listed(filters.publishers)}` : ''} · 予算所管: ${listed(filters.groups)} · 会計: ${listed(filters.accts)}${text('組織／勘定', filters.org, filters.orgRegex)}${text('項名', filters.name, filters.nameRegex)}${text('事項名', filters.jikouName, filters.jikouNameRegex)}${text('目名', filters.mokuName, filters.mokuNameRegex)} · 値のある段階: ${LIFECYCLE_PATTERNS.find(p => p.id === filters.pattern)!.label}${filters.links === 'unsettled' ? ' · 年度をまたぐ対応: 未確定のみ' : ''}`;

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div>
          <h1 className="text-base font-semibold">予算の推移</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <YearSelect value={String(activeYear)} onChange={y => { setYear(Number(y)); setSelectedId(null); setSelectedJikou(null); setSelectedMoku(null); }} years={years} />
          <PageNavMenu current="lifecycle" />
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:flex xl:gap-0">
        <section aria-label="フィルタ" className={`${pane} overflow-hidden xl:w-[var(--fw)] xl:shrink-0`} style={{ '--fw': `${filterWidth}px` } as CSSProperties}>
          {view === 'rs'
            ? <RsFilterPane ministries={rsMinistries} rows={rsYearRows} filters={rsFilters} onChange={setRsFilters} />
            : <LifecycleFilterPane allKous={data?.kous ?? NO_KOUS} inYear={inYear} patternCounts={patternCounts} unsettledCount={unsettledCount} filters={filters} onChange={f => { setFilters(f); setSelectedId(null); setSelectedJikou(null); setSelectedMoku(null); }} />}
        </section>
        <Splitter label="フィルタの幅" width={filterWidth} limits={FILTER_WIDTH} dir={1} onChange={setFilterWidth} />
        <section aria-label="項の一覧" className={`${pane} flex flex-col overflow-hidden xl:min-w-0 xl:flex-1`}>
          <div role="tablist" aria-label="表示" className="flex shrink-0 gap-1 border-b border-neutral-200 px-3 pt-2 text-xs dark:border-neutral-800">
            {([...['list', 'jikou', 'moku'] as const, ...(rsAvailable ? ['rs' as const] : []), 'summary' as const]).map(v => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-t border-b-2 px-2.5 py-1 ${view === v ? 'border-emerald-600 font-semibold text-neutral-900 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
                {v === 'list' ? '項' : v === 'jikou' ? '事項' : v === 'moku' ? '目' : v === 'rs' ? 'RS' : '集計'}
              </button>
            ))}
          </div>
          <div {...(view === 'summary' ? { 'data-pane': 'list', tabIndex: -1 } : {})} className={`min-h-0 flex-1 ${view === 'summary' ? `overflow-auto outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500/50` : 'overflow-hidden'}`}>
            {view === 'rs'
              ? <RsListPane items={rsList} loading={rsState === 'loading'} failed={rsState === 'error'} sortKey={rsSortKey} sortDir={rsSortDir} onSort={onRsSort} selectedId={selectedRs} onSelect={r => setSelectedRs(r.id)} widths={rsColumnWidths} onWidthsChange={setRsColumnWidths} spentNote={rs && rs.spentUnfilled.has(activeYear) ? RS_SPENT_UNFILLED_NOTE : null} yearNote={rs && !rs.data.years.includes(activeYear) ? `FY${activeYear} の RS のデータは無い（RS の予算年度は ${rs.data.years[0]}〜${rs.data.years[rs.data.years.length - 1]}）。` : null} />
              : view === 'moku'
              ? <LifecycleMokuListPane items={mokuList} loading={mokuState === 'loading'} failed={mokuState === 'error'} sortKey={mokuSortKey} sortDir={mokuSortDir} onSort={onMokuSort} selectedNode={selectedMokuNode} onSelect={r => setSelectedMoku(mokuSelectionKey(moku!, r.node))} widths={mokuColumnWidths} onWidthsChange={setMokuColumnWidths} suppNote={mokuWhy} />
              : view === 'jikou'
              ? <LifecycleJikouListPane items={jikouList} loading={jikouState === 'loading'} failed={jikouState === 'error'} sortKey={jikouSortKey} sortDir={jikouSortDir} onSort={onJikouSort} selectedNode={selectedJikouNode} onSelect={r => setSelectedJikou(`${r.k.id}|${r.name}`)} widths={jikouColumnWidths} onWidthsChange={setJikouColumnWidths} />
              : view === 'list'
              ? <LifecycleListPane items={list} notice={jikouFilterNotice} jikouLoading={jikouState === 'loading'} sortKey={sortKey} sortDir={sortDir} onSort={onSort} selectedId={kou?.id ?? null} onSelect={k => setSelectedId(k.id)} widths={columnWidths} onWidthsChange={setColumnWidths} />
              : <LifecycleSummaryPane
                  checks={checks}
                  scope={scope}
                  kous={list.map(x => x.k)}
                  values={list.map(x => valuesOf.get(x.i) ?? {})}
                  events={list.map(x => byKou.get(x.i) ?? [])}
                  coverage={coverage}
                />}
          </div>
        </section>
        <Splitter label="詳細の幅" width={detailWidth} limits={DETAIL_WIDTH} dir={-1} onChange={setDetailWidth} />
        <section aria-label={view === 'rs' ? 'RS の事業の詳細' : view === 'jikou' ? '事項の詳細' : view === 'moku' ? '目の詳細' : '項の一生'} data-pane="detail" tabIndex={-1} className={`${pane} overflow-auto lg:col-span-2 xl:col-span-1 xl:w-[var(--dw)] xl:shrink-0 outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500/50`} style={{ '--dw': `${detailWidth}px` } as CSSProperties}>
          {view === 'rs' ? (
            <RsDetail
              rs={rs}
              loading={rsState === 'loading'}
              failed={rsState === 'error'}
              id={selectedRs}
              year={activeYear}
              kouOf={kouById}
              onYear={y => setYear(y)}
              onOpenKou={k => { setYear(k.year); setSelectedId(k.id); setView('list'); setDetailTab('life'); }}
            />
          ) : view === 'moku' ? (
            <LifecycleMokuDetail
              moku={moku}
              loading={mokuState === 'loading'}
              failed={mokuState === 'error'}
              node={selectedMokuNode}
              kouOf={kouById}
              chainKouIds={mokuChainKouIds}
              onSelectNode={node => { setYear(moku!.data.nodes[node]![1]); setSelectedMoku(mokuSelectionKey(moku!, node)); }}
              onOpenKou={k => { setYear(k.year); setSelectedId(k.id); setView('list'); setDetailTab('life'); }}
            />
          ) : view === 'jikou' ? (
            <LifecycleJikouDetail
              jikou={jikou}
              loading={jikouState === 'loading'}
              failed={jikouState === 'error'}
              node={selectedJikouNode}
              kouOf={kouById}
              onSelectNode={node => { setYear(jikou!.data.nodes[node]![1]); setSelectedJikou(jikouKeyOf(node)); }}
              onOpenKou={k => { setYear(k.year); setSelectedId(k.id); setView('list'); setDetailTab('jikou'); }}
            />
          ) : (
          <LifecycleDetailPane kou={kou} events={selectedIndex >= 0 ? byKou.get(selectedIndex) ?? [] : []} coverage={coverage} data={data} links={selectedIndex >= 0 ? linksByKou.get(selectedIndex) ?? [] : []} selfIndex={selectedIndex} onNavigate={id => { const t = data.kous.find(x => x.id === id); if (t) { setYear(t.year); setSelectedId(id); } }} tab={detailTab} onTab={setDetailTab} chain={selectedIndex >= 0 ? chainOf(selectedIndex) : null} valuesOf={valuesOf} jikou={jikou} jikouState={jikouState} moku={moku} mokuState={mokuState} onOpenMoku={node => { setSelectedMoku(mokuSelectionKey(moku!, node)); setView('moku'); }} />
          )}
        </section>
      </main>
      <SourceNote rs={view === 'rs'} />
    </div>
  );
}
