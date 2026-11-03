import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { usePaneKeys } from '../components/useListKeys.ts';
import { AGG_JIKOU, AGG_KOU, AGG_RS, AggregateDetail } from './AggregateDetail.tsx';
import {
  INITIAL_LIFECYCLE_FILTERS,
  type LifecycleKou,
  filterLifecycleKous,
  lifecycleChainSpan,
  lifecycleChains,
  lifecycleLinkGap,
  lifecycleLinkState,
  lifecycleLinksByKou,
  lifecyclePatternCounts,
  lifecycleRowAmounts,
  lifecycleSourcePresence,
  aggregateJikou,
  lifecycleListCounts,
  aggregateKous,
  aggregateMoku,
  aggregateRs,
  filterJikouRows,
  filterMokuRows,
  kouIdsWithMoku,
  MOKU_TEXT_SORT_KEYS,
  mokuCodeCounts,
  mokuCounts,
  codeNameOf,
  type LifecycleCodeTables,
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
  decodeLifecycleUrl,
  encodeLifecycleUrl,
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
import { LifecycleFilterPane } from './LifecycleFilterPane.tsx';
import { LifecycleJikouDetail } from './LifecycleJikouDetail.tsx';
import { LifecycleKouDetail } from './LifecycleKouDetail.tsx';
import { LifecycleJikouListPane } from './LifecycleJikouListPane.tsx';
import { LifecycleListPane } from './LifecycleListPane.tsx';
import { LifecycleMokuDetail } from './LifecycleMokuDetail.tsx';
import { LifecycleMokuListPane } from './LifecycleMokuListPane.tsx';
import { RsDetail } from './RsDetail.tsx';
import { RsFilterPane } from './RsFilterPane.tsx';
import { RsListPane } from './RsListPane.tsx';

/**
 * 予算の推移（項の粒度。年度ごとに、基準データにある段階だけ）。左にフィルタ、中に一覧（項・事項・目・RS のタブ）、右に選んだ行の詳細（年度推移のグラフと、年度ごとの表）。
 * 仕様: docs/guides/budget-lifecycle.md。値の無い段階の見せ方: docs/guides/lifecycle-status.md。
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
  // URL に状態があるとき（`#/lifecycle?view=moku&year=2024`）は、それが状態のすべて。保存した前回の状態は使わない
  const [urlState] = useState(() => decodeLifecycleUrl(window.location.hash));
  const [year, setYear] = usePersistedState<number | null>('lifecycle:year', null, urlState ? { value: urlState.year } : undefined);
  // フィルタは保存値を既定値の上に重ねる（項目が増えた後に、古い保存値を読んでも欠けないように）
  const [storedFilters, setFilters] = usePersistedState<LifecycleFilters>('lifecycle:filters', INITIAL_LIFECYCLE_FILTERS, urlState ? { value: urlState.filters } : undefined);
  const filters = useMemo(() => ({ ...INITIAL_LIFECYCLE_FILTERS, ...storedFilters }), [storedFilters]);
  const [sortKey, setSortKey] = usePersistedState<LifecycleSortKey>('lifecycle:sortKey', 'size');
  const [sortDir, setSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:sortDir', -1);
  const [selectedId, setSelectedId] = usePersistedState<string | null>('lifecycle:selected', null, urlState ? { value: urlState.view === 'list' ? urlState.selected : null } : undefined);
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:columnWidths', {});
  const [storedView, setView] = usePersistedState<'list' | 'jikou' | 'moku' | 'rs' | 'summary'>('lifecycle:view', 'list', urlState ? { value: urlState.view } : undefined); // 'summary'（集計）は廃止。保存していた値は、項に戻す
  // RS の事業（中ペインの「RS」）。RS のデータを載せたビルドだけにある（`about.json` の `rs`）。選んだ事業は、予算事業 ID で持つ
  const [rsAvailable, setRsAvailable] = useState<boolean | null>(null);
  const view: 'list' | 'jikou' | 'moku' | 'rs' = storedView === 'summary' || (storedView === 'rs' && rsAvailable === false) ? 'list' : storedView;
  const [selectedRs, setSelectedRs] = usePersistedState<string | null>('lifecycle:selectedRs', null, urlState ? { value: urlState.view === 'rs' ? urlState.selected : null } : undefined);
  const [storedRsFilters, setRsFilters] = usePersistedState<RsFilters>('lifecycle:rsFilters', INITIAL_RS_FILTERS, urlState ? { value: urlState.rsFilters } : undefined);
  const rsFilters = useMemo(() => ({ ...INITIAL_RS_FILTERS, ...storedRsFilters }), [storedRsFilters]);
  const [rsSortKey, setRsSortKey] = usePersistedState<RsSortKey>('lifecycle:rsSortKey', 'current');
  const [rsSortDir, setRsSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:rsSortDir', -1);
  const [rsColumnWidths, setRsColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:rsColumnWidths', {});
  // 事項の一覧（中ペインの「事項」）。選んだ事項は、`${項の id}|${事項名}` で持つ（事項のデータの添字は、データを作り直すと変わるため）
  const [selectedJikou, setSelectedJikou] = usePersistedState<string | null>('lifecycle:selectedJikou', null, urlState ? { value: urlState.view === 'jikou' ? urlState.selected : null } : undefined);
  const [jikouSortKey, setJikouSortKey] = usePersistedState<JikouSortKey>('lifecycle:jikouSortKey', 'size');
  const [jikouSortDir, setJikouSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:jikouSortDir', -1);
  const [jikouColumnWidths, setJikouColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:jikouColumnWidths', {});
  // 目の一覧（中ペインの「目」）。選んだ目は、`${項の id}|${目の識別}` で持つ（`mokuSelectionKey`）
  const [selectedMoku, setSelectedMoku] = usePersistedState<string | null>('lifecycle:selectedMoku', null, urlState ? { value: urlState.view === 'moku' ? urlState.selected : null } : undefined);
  const [mokuSortKey, setMokuSortKey] = usePersistedState<MokuSortKey>('lifecycle:mokuSortKey', 'size');
  const [mokuSortDir, setMokuSortDir] = usePersistedState<LifecycleSortDir>('lifecycle:mokuSortDir', -1);
  const [mokuColumnWidths, setMokuColumnWidths] = usePersistedState<Record<string, number>>('lifecycle:mokuColumnWidths', {});
  // 集計行を選んでいる画面（選ぶと、右ペインに一覧全体の年度推移。行を選ぶ・画面を変えると外れる）
  const [aggView, setAggView] = useState<string | null>(null);
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
  const presence = useMemo(() => lifecycleSourcePresence(data?.kous ?? []), [data]);
  const chainOf = useMemo(() => lifecycleChains(data?.kous ?? [], data?.links ?? [], data?.years ?? []), [data]);

  // 事項（lifecycle/jikou.json.gz。項の一覧の「事項」列と、中ペインの「事項」が使う）は、項の一覧の表示を待たせず、後から読む。結果（索引か失敗）は、読み終えたときに入れる
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

  // 目（lifecycle/moku.json.gz。大きいので、中ペインの「目」を開いたとき、または目名で絞るときに読む）
  const [mokuResult, setMokuResult] = useState<{ index: MokuIndex } | { failed: true } | null>(null);
  const mokuRequested = useRef(false);
  // 目は、項・事項・目の一覧（目の数の列・分類コードの選択肢と絞り込み）が使うので、RS 以外のタブで読む
  const needMoku = view !== 'rs' || storedFilters.mokuName?.trim();
  useEffect(() => {
    if (!needMoku || mokuRequested.current) return;
    mokuRequested.current = true;
    loadGzJson<LifecycleMokuData>('lifecycle/moku.json.gz')
      .then(d => setMokuResult({ index: mokuIndex(d) }))
      .catch(() => setMokuResult({ failed: true }));
  }, [needMoku]);
  const moku = mokuResult && 'index' in mokuResult ? mokuResult.index : null;
  const mokuState = mokuResult === null ? 'loading' : 'index' in mokuResult ? 'ready' : 'error';
  const mokuCountOf = useMemo(() => (moku ? mokuCounts(moku.data) : null), [moku]);

  // 分類コードの名前（lifecycle/codes.json.gz。小さい）
  const [codeTables, setCodeTables] = useState<LifecycleCodeTables | null>(null);
  useEffect(() => {
    let alive = true;
    loadGzJson<LifecycleCodeTables>('lifecycle/codes.json.gz').then(t => { if (alive) setCodeTables(t); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
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
  // 画面の状態を URL に書く（共有・再現のため。履歴は増やさない）。データを読む前は、年度が決まらないので書かない
  const selectedOfView = view === 'rs' ? selectedRs : view === 'moku' ? selectedMoku : view === 'jikou' ? selectedJikou : selectedId;
  useEffect(() => {
    if (activeYear === null) return;
    const q = encodeLifecycleUrl({ view, year: activeYear, filters, rsFilters, selected: selectedOfView });
    const next = `#/lifecycle?${q}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [view, activeYear, filters, rsFilters, selectedOfView]);
  // 年度・所管・会計・組織・項名で絞った項（値のある段階で絞る前）。段階ごとの件数は、この集合で数える
  const inYear = useMemo(() => (data && activeYear !== null ? data.kous.filter(k => k.year === activeYear) : []), [data, activeYear]);
  // 事項名の絞り込みは、その年度に事項名が合う事項を持つ項に絞る（事項のデータが届くまでは絞れないので、項の一覧は読み込み中の表示にする）
  const jikouKouSet = useMemo(() => (jikou && activeYear !== null ? kouIdsWithJikou(jikou, activeYear, filters.jikouName, filters.jikouNameRegex) : null), [jikou, activeYear, filters.jikouName, filters.jikouNameRegex]);
  const mokuKouSet = useMemo(() => (moku && activeYear !== null ? kouIdsWithMoku(moku, activeYear, filters.mokuName, filters.mokuNameRegex, filters) : null), [moku, activeYear, filters]);
  const jikouFilterNotice = filters.jikouName.trim() !== '' && jikouState !== 'ready'
    ? (jikouState === 'loading' ? '事項を読み込み中…' : '事項の読み込みに失敗しました（npm run build:data で作る）。')
    : (filters.mokuName.trim() !== '' || filters.majors.length > 0 || filters.uses.length > 0) && mokuState !== 'ready'
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
        .map(({ k, i }) => { const chain = chainOf(i); const span = lifecycleChainSpan(data?.kous ?? [], chain); return { k, i, a: lifecycleRowAmounts(valuesOf.get(i) ?? {}), link: lifecycleLinkState(linksByKou.get(i)), linkGap: lifecycleLinkGap(presence, years, data?.kous ?? [], i, linksByKou.get(i)), chain, span, years: span.years, jikou: jikouCountOf?.get(k.id) ?? null, moku: mokuCountOf?.get(k.id) ?? null }; })
        .filter(({ k, link }) => matchesLifecyclePattern(k, filters) && matchesLifecycleLinks(link, filters)),
      sortKey,
      sortDir,
    ),
    [base, data, chainOf, filters, valuesOf, linksByKou, jikouCountOf, mokuCountOf, presence, years, sortKey, sortDir],
  );
  // 事項の一覧: 選んだ年度の事項を、項の一覧と同じフィルタ（所管・会計・組織／勘定・項名）と事項名で絞る
  const kouById = useMemo(() => new Map((data?.kous ?? []).map(k => [k.id, k])), [data]);
  const jikouRows = useMemo(() => (jikou && activeYear !== null ? jikouListRows(jikou, kouById, activeYear) : []), [jikou, kouById, activeYear]);
  // 事項の使途別の絞り込み: 事項に使途別は無いので、選んだ使途別の目を持つ項の事項に絞る（目のデータが届くまでは、空）
  const usesKouSet = useMemo(() => (filters.uses.length === 0 || activeYear === null ? null : moku ? kouIdsWithMoku(moku, activeYear, '', false, { majors: [], uses: filters.uses }) : new Set<string>()), [moku, activeYear, filters.uses]);
  const jikouList = useMemo(() => (activeYear === null ? [] : sortJikouRows(filterJikouRows(jikouRows, filters, activeYear, usesKouSet), jikouSortKey, jikouSortDir)), [jikouRows, filters, activeYear, usesKouSet, jikouSortKey, jikouSortDir]);
  // 主要経費別・使途別の選択肢（選んだ年度の目のコードと、名前と、目の数）
  const codeOptions = useMemo<Record<'major' | 'use', [string, string, number][]>>(() => {
    if (!moku || !codeTables || activeYear === null) return { major: [], use: [] };
    const counts = mokuCodeCounts(moku.data, activeYear);
    const make = (axis: 'major' | 'use'): [string, string, number][] => [...counts[axis]].sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => [c, (codeNameOf(codeTables, axis, c, activeYear, 'general') ?? codeNameOf(codeTables, axis, c, activeYear, 'special'))?.name ?? c, n]);
    return { major: make('major'), use: make('use') };
  }, [moku, codeTables, activeYear]);
  const selectedJikouNode = useMemo(() => {
    const node = jikou && selectedJikou !== null ? jikou.nodeByKey.get(selectedJikou) : undefined;
    return node !== undefined && jikou!.data.nodes[node]![1] === activeYear ? node : null;
  }, [jikou, selectedJikou, activeYear]);
  const onJikouSort = (k: JikouSortKey) => {
    if (k === jikouSortKey) setJikouSortDir(d => (d === 1 ? -1 : 1));
    else { setJikouSortKey(k); setJikouSortDir(k === 'publisher' || k === 'group' || k === 'acct' || k === 'org' || k === 'kou' || k === 'name' || k === 'major' ? 1 : -1); }
  };
  // 目の一覧: 選んだ年度の目を、項の一覧と同じフィルタ（所管・会計・組織／勘定・項名）と目名で絞る
  const kouIndexById = useMemo(() => new Map((data?.kous ?? []).map((k, i) => [k.id, i])), [data]);
  // 項ごとの、確定した対応でたどった項の id（年度の古い順）。目の確認済み年度と、集計行の年度推移に使う
  const chainIdsOf = useMemo(() => (kouId: string): string[] => {
    const i = kouIndexById.get(kouId);
    return i === undefined || !data ? [kouId] : chainOf(i).members.map(m => data.kous[m]!.id);
  }, [kouIndexById, chainOf, data]);
  const mokuRows = useMemo(() => (moku && activeYear !== null && data ? mokuListRows(moku, kouById, activeYear, chainIdsOf) : []), [moku, kouById, activeYear, data, chainIdsOf]);
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
  // 何も選んでいないときは、集計行を選んだ状態にする（右ペインに一覧全体の年度推移）
  const nothingSelected = view === 'rs' ? selectedRs === null : view === 'moku' ? selectedMokuNode === null : view === 'jikou' ? selectedJikouNode === null : !(selectedId !== null && data?.kous.some(k => k.id === selectedId && k.year === activeYear));
  const agg = aggView === view || nothingSelected;
  const aggRows = useMemo(() => {
    if (!agg || !data) return [];
    if (view === 'list') return aggregateKous(list.map(x => x.chain.members), data.kous, valuesOf);
    if (view === 'jikou') return jikou ? aggregateJikou(jikou, jikouList.map(r => r.node)) : [];
    if (view === 'moku') return moku ? aggregateMoku(moku, mokuList.map(r => r.node), chainIdsOf) : [];
    return rs ? aggregateRs(rs, rsList.map(r => r.idx)) : [];
  }, [agg, data, view, list, valuesOf, jikou, jikouList, moku, mokuList, chainIdsOf, rs, rsList]);
  // 右ペインの見出し（集計行を選んだとき）: 一覧の行の数と、内訳
  const aggHead = useMemo(() => {
    const n = (v: number): string => v.toLocaleString();
    if (view === 'rs') return { title: `${n(rsList.length)}事業`, facts: [`${n(new Set(rsList.map(r => r.ministry)).size)}府省庁`, `${n(new Set(rsList.map(r => `${r.ministry}|${r.bureau}`)).size)}局・庁`, `項に結べた ${n(rsList.filter(r => r.kouCount > 0).length)}事業`] };
    const ks = view === 'moku' ? mokuList.map(r => r.k) : view === 'jikou' ? jikouList.map(r => r.k) : list.map(x => x.k);
    const c = lifecycleListCounts(ks);
    const common = [`要求${n(c.publishers)}所管`, `予算${n(c.groups)}所管`, `${n(c.accts)}会計`, `${n(c.generalOrgs)}組織/${n(c.specialSubs)}勘定`];
    if (view === 'moku') return { title: `${n(mokuList.length)}目`, facts: [...common, `${n(c.kous)}項`] };
    if (view === 'jikou') return { title: `${n(jikouList.length)}事項`, facts: [...common, `${n(c.kous)}項`] };
    const jikouSum = list.reduce((s, x) => s + (x.jikou?.total ?? 0), 0), mokuSum = list.reduce((s, x) => s + (x.moku?.total ?? 0), 0);
    return { title: `${n(list.length)}項`, facts: [...common, jikouState === 'ready' ? `${n(jikouSum)}事項` : '事項 …', mokuState === 'ready' ? `${n(mokuSum)}目` : '目 …'] };
  }, [view, list, jikouList, mokuList, rsList, jikouState, mokuState]);
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
            : <LifecycleFilterPane allKous={data?.kous ?? NO_KOUS} inYear={inYear} patternCounts={patternCounts} unsettledCount={unsettledCount} codeOptions={codeOptions} filters={filters} onChange={f => { setFilters(f); setSelectedId(null); setSelectedJikou(null); setSelectedMoku(null); }} />}
        </section>
        <Splitter label="フィルタの幅" width={filterWidth} limits={FILTER_WIDTH} dir={1} onChange={setFilterWidth} />
        <section aria-label="項の一覧" className={`${pane} flex flex-col overflow-hidden xl:min-w-0 xl:flex-1`}>
          <div role="tablist" aria-label="表示" className="flex shrink-0 gap-1 border-b border-neutral-200 px-3 pt-2 text-xs dark:border-neutral-800">
            {([...['list', 'jikou', 'moku'] as const, ...(rsAvailable ? ['rs' as const] : [])]).map(v => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); setAggView(null); }} className={`rounded-t border-b-2 px-2.5 py-1 ${view === v ? 'border-emerald-600 font-semibold text-neutral-900 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
                {v === 'list' ? '項' : v === 'jikou' ? '事項' : v === 'moku' ? '目' : 'RS'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {view === 'rs'
              ? <RsListPane items={rsList} loading={rsState === 'loading'} failed={rsState === 'error'} sortKey={rsSortKey} sortDir={rsSortDir} onSort={onRsSort} selectedId={agg ? null : selectedRs} onSelect={r => { setAggView(null); setSelectedRs(r.id); }} summarySelected={agg} onSelectSummary={() => { setSelectedRs(null); setAggView(view); }} widths={rsColumnWidths} onWidthsChange={setRsColumnWidths} spentNote={rs && rs.spentUnfilled.has(activeYear) ? RS_SPENT_UNFILLED_NOTE : null} yearNote={rs && !rs.data.years.includes(activeYear) ? `FY${activeYear} の RS のデータは無い（RS の予算年度は ${rs.data.years[0]}〜${rs.data.years[rs.data.years.length - 1]}）。` : null} />
              : view === 'moku'
              ? <LifecycleMokuListPane items={mokuList} codes={codeTables} loading={mokuState === 'loading'} failed={mokuState === 'error'} sortKey={mokuSortKey} sortDir={mokuSortDir} onSort={onMokuSort} selectedNode={agg ? null : selectedMokuNode} onSelect={r => { setAggView(null); setSelectedMoku(mokuSelectionKey(moku!, r.node)); }} summarySelected={agg} onSelectSummary={() => { setSelectedMoku(null); setAggView(view); }} widths={mokuColumnWidths} onWidthsChange={setMokuColumnWidths} suppNote={mokuWhy} />
              : view === 'jikou'
              ? <LifecycleJikouListPane items={jikouList} codes={codeTables} loading={jikouState === 'loading'} failed={jikouState === 'error'} sortKey={jikouSortKey} sortDir={jikouSortDir} onSort={onJikouSort} selectedNode={agg ? null : selectedJikouNode} onSelect={r => { setAggView(null); setSelectedJikou(`${r.k.id}|${r.name}`); }} summarySelected={agg} onSelectSummary={() => { setSelectedJikou(null); setAggView(view); }} widths={jikouColumnWidths} onWidthsChange={setJikouColumnWidths} />
              : <LifecycleListPane items={list} notice={jikouFilterNotice} jikouLoading={jikouState === 'loading'} mokuLoading={mokuState === 'loading'} sortKey={sortKey} sortDir={sortDir} onSort={onSort} selectedId={agg ? null : kou?.id ?? null} onSelect={k => { setAggView(null); setSelectedId(k.id); }} summarySelected={agg} onSelectSummary={() => { setSelectedId(null); setAggView(view); }} widths={columnWidths} onWidthsChange={setColumnWidths} />}
          </div>
        </section>
        <Splitter label="詳細の幅" width={detailWidth} limits={DETAIL_WIDTH} dir={-1} onChange={setDetailWidth} />
        <section aria-label={view === 'rs' ? 'RS の事業の詳細' : view === 'jikou' ? '事項の詳細' : view === 'moku' ? '目の詳細' : '項の詳細'} data-pane="detail" tabIndex={-1} className={`${pane} overflow-auto lg:col-span-2 xl:col-span-1 xl:w-[var(--dw)] xl:shrink-0 outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500/50`} style={{ '--dw': `${detailWidth}px` } as CSSProperties}>
          {agg && (view === 'jikou' ? jikou === null : view === 'moku' ? moku === null : view === 'rs' ? rs === null : false) ? (
            <p className="p-4 text-xs text-neutral-500">読み込み中…</p>
          ) : agg ? (
            <AggregateDetail
              title={aggHead.title}
              facts={aggHead.facts}
              unit={view === 'rs' ? '事業' : view === 'moku' ? '目' : view === 'jikou' ? '事項' : '項'}
              rows={aggRows}
              year={activeYear}
              spec={view === 'rs' ? AGG_RS : view === 'jikou' ? AGG_JIKOU : AGG_KOU}
              onYear={y => setYear(y)}
            />
          ) : view === 'rs' ? (
            <RsDetail
              rs={rs}
              loading={rsState === 'loading'}
              failed={rsState === 'error'}
              id={selectedRs}
              year={activeYear}
              kouOf={kouById}
              onYear={y => setYear(y)}
              onOpenKou={k => { setYear(k.year); setSelectedId(k.id); setView('list'); }}
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
              onOpenKou={k => { setYear(k.year); setSelectedId(k.id); setView('list'); }}
            />
          ) : view === 'jikou' ? (
            <LifecycleJikouDetail
              jikou={jikou}
              loading={jikouState === 'loading'}
              failed={jikouState === 'error'}
              node={selectedJikouNode}
              kouOf={kouById}
              onSelectNode={node => { setYear(jikou!.data.nodes[node]![1]); setSelectedJikou(jikouKeyOf(node)); }}
              onOpenKou={k => { setYear(k.year); setSelectedId(k.id); setView('list'); }}
            />
          ) : (
          <LifecycleKouDetail kou={kou} chain={selectedIndex >= 0 ? chainOf(selectedIndex) : null} kous={data.kous} valuesOf={valuesOf} links={data.links} jikou={jikou} jikouFailed={jikouState === 'error'} moku={moku} mokuFailed={mokuState === 'error'} onNavigate={id => { const t = data.kous.find(x => x.id === id); if (t) { setYear(t.year); setSelectedId(id); } }} />
          )}
        </section>
      </main>
      <SourceNote rs={view === 'rs'} />
    </div>
  );
}
