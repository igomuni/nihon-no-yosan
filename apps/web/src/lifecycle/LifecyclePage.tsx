import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import {
  LIFECYCLE_PATTERNS,
  lifecycleCoverage,
  lifecyclePatternCounts,
  lifecyclePatternMatches,
  lifecycleValues,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecyclePattern,
  type LifecycleValues,
} from '@nihon-no-yosan/core';
import { loadGzJson } from '../data.ts';
import { PageNavMenu } from '../components/PageNavMenu.tsx';
import { SourceNote } from '../components/SourceNote.tsx';
import { YearSelect } from '../components/YearSelect.tsx';
import { usePersistedState } from '../usePersistedState.ts';
import { LifecycleDetailPane } from './LifecycleDetailPane.tsx';
import { LifecycleFilterPane, type LifecycleAccount } from './LifecycleFilterPane.tsx';
import { LifecycleListPane } from './LifecycleListPane.tsx';
import { LifecycleSummaryPane } from './LifecycleSummaryPane.tsx';
import { kouTitle } from './shared.ts';

/**
 * 予算の一生の表（項の粒度, FY2023・FY2024）。1 つの項について、概算要求 → 政府案 → 補正 → 決算の値を、段階ごとの状態・グラフ・表で見る。
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

export function LifecyclePage() {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = usePersistedState<number | null>('lifecycle:year', null);
  const [account, setAccount] = usePersistedState<LifecycleAccount>('lifecycle:account', 'all');
  const [query, setQuery] = usePersistedState('lifecycle:query', '');
  const [pattern, setPattern] = usePersistedState<LifecyclePattern>('lifecycle:pattern', 'all');
  const [selectedId, setSelectedId] = usePersistedState<string | null>('lifecycle:selected', null);
  const [view, setView] = usePersistedState<'list' | 'summary'>('lifecycle:view', 'list');
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
  const coverage = useMemo(() => lifecycleCoverage(data?.kous ?? []), [data]);

  const years = data?.years ?? [];
  const activeYear = data ? (year !== null && years.includes(year) ? year : years[0]!) : null;
  // 年度・会計・検索で絞った項（値のある段階で絞る前）。段階ごとの件数は、この集合で数える
  const base = useMemo(() => {
    if (!data || activeYear === null) return [];
    const q = query.trim().toLowerCase();
    return data.kous
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.year === activeYear && (account === 'all' || k.account === account) && (q === '' || `${k.name} ${kouTitle(k)}`.toLowerCase().includes(q)));
  }, [data, activeYear, account, query]);
  const patternCounts = useMemo(() => lifecyclePatternCounts(base.map(x => x.k)), [base]);
  const list = useMemo(() => {
    const size = (i: number): number => { const v = valuesOf.get(i) ?? {}; return Math.max(0, v.current_amount ?? 0, v.budget_amount ?? 0, v.request_amount ?? 0); };
    return base.filter(({ k }) => lifecyclePatternMatches(k, pattern)).map(({ k, i }) => ({ k, i, size: size(i) })).sort((a, b) => b.size - a.size);
  }, [base, pattern, valuesOf]);

  if (error) return <main className="mx-auto max-w-3xl p-8"><p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">データの読み込みに失敗しました: {error}（<code>npm run build:data</code> で作る）</p></main>;
  if (!data || activeYear === null) return <main className="mx-auto max-w-3xl p-8"><p className="text-sm text-neutral-500">読み込み中…</p></main>;

  // 選んだ項は、年度が違えば無効にする（kou.id が年度を含むかに頼らず、年度で確かめる）
  const selectedIndex = selectedId === null ? -1 : data.kous.findIndex(k => k.id === selectedId && k.year === activeYear);
  const kou = selectedIndex >= 0 ? data.kous[selectedIndex]! : null;
  const checks = data.checks.filter(c => c.year === activeYear);
  const scope = `FY${activeYear} · 会計: ${account === 'all' ? 'すべて' : account === 'general' ? '一般会計' : '特別会計'} · 検索: ${query.trim() === '' ? 'なし' : `「${query.trim()}」`} · 値のある段階: ${LIFECYCLE_PATTERNS.find(p => p.id === pattern)!.label}`;

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div>
          <h1 className="text-base font-semibold">予算の一生の表</h1>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            項の粒度 · FY{years[0]}–FY{years[years.length - 1]} · 概算要求 → 政府案 → 補正 → 決算 · 値が無い段階は補完せず「値なし」と表示
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <YearSelect value={String(activeYear)} onChange={y => { setYear(Number(y)); setSelectedId(null); }} years={years} />
          <PageNavMenu current="lifecycle" />
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:flex xl:gap-0">
        <section aria-label="フィルタ" className={`${pane} overflow-hidden xl:w-[var(--fw)] xl:shrink-0`} style={{ '--fw': `${filterWidth}px` } as CSSProperties}>
          <LifecycleFilterPane
            query={query}
            onQuery={setQuery}
            account={account}
            onAccount={setAccount}
            pattern={pattern}
            onPattern={p => { setPattern(p); setSelectedId(null); }}
            patternCounts={patternCounts}
            onReset={() => { setQuery(''); setAccount('all'); setPattern('all'); setSelectedId(null); }}
          />
        </section>
        <Splitter label="フィルタの幅" width={filterWidth} limits={FILTER_WIDTH} dir={1} onChange={setFilterWidth} />
        <section aria-label="項の一覧" className={`${pane} flex flex-col overflow-hidden xl:min-w-0 xl:flex-1`}>
          <div role="tablist" aria-label="表示" className="flex shrink-0 gap-1 border-b border-neutral-200 px-3 pt-2 text-xs dark:border-neutral-800">
            {(['list', 'summary'] as const).map(v => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-t border-b-2 px-2.5 py-1 ${view === v ? 'border-emerald-600 font-semibold text-neutral-900 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
                {v === 'list' ? '一覧' : '集計'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {view === 'list'
              ? <LifecycleListPane items={list} selectedId={kou?.id ?? null} onSelect={k => setSelectedId(k.id)} />
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
        <section aria-label="項の一生" className={`${pane} overflow-auto lg:col-span-2 xl:col-span-1 xl:w-[var(--dw)] xl:shrink-0`} style={{ '--dw': `${detailWidth}px` } as CSSProperties}>
          <LifecycleDetailPane kou={kou} events={selectedIndex >= 0 ? byKou.get(selectedIndex) ?? [] : []} coverage={coverage} />
        </section>
      </main>
      <SourceNote />
    </div>
  );
}
