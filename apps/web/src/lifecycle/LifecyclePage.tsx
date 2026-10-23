import { useEffect, useMemo, useState } from 'react';
import {
  LIFECYCLE_MEASURES,
  LIFECYCLE_PAIRS,
  LIFECYCLE_PATTERNS,
  LIFECYCLE_STAGES,
  formatRate,
  formatSen,
  formatSenSigned,
  lifecycleAllStages,
  lifecycleChanges,
  lifecycleCoverage,
  lifecycleLevels,
  lifecycleObserved,
  lifecyclePair,
  lifecyclePatternCounts,
  lifecyclePatternMatches,
  lifecycleStageStatuses,
  lifecycleUse,
  lifecycleValues,
  type LifecycleCoverage,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecycleEventType,
  type LifecycleKou,
  type LifecycleMeasure,
  type LifecyclePattern,
  type LifecycleStage,
  type LifecycleValues,
  type StageStatus,
} from '@nihon-no-yosan/core';
import { ChangesChart, LevelsChart, UseChart } from './charts.tsx';
import { loadGzJson } from '../data.ts';
import { PageNavMenu } from '../components/PageNavMenu.tsx';
import { SourceNote } from '../components/SourceNote.tsx';
import { YearSelect } from '../components/YearSelect.tsx';
import { usePersistedState } from '../usePersistedState.ts';

/**
 * 予算の一生の表（試作）。1 つの項について、概算要求 → 政府案 → 補正 → 決算の値を、段階ごとの状態・グラフ・表で見る。
 * 仕様（案）: docs/guides/budget-lifecycle.md。段階の状態の定義: docs/guides/lifecycle-status.md。
 * 欠けている値や、確かめられていない関係は、補完も断定もしない（0 と「値なし」を分ける）。
 */

const EVENT_LABEL: Record<LifecycleEventType, string> = { request: '概算要求', budget: '政府案', supp: '補正', settle: '決算', derived: '導出' };
const EVENT_BADGE: Record<LifecycleStage, string> = { request: '要', budget: '政', supp: '補', settle: '決' };
const EVENT_ORDER: LifecycleEventType[] = ['request', 'budget', 'supp', 'settle', 'derived'];
const STAGE_OF_MEASURE: Partial<Record<LifecycleMeasure, LifecycleStage>> = { request_amount: 'request', budget_amount: 'budget', revised_amount: 'supp', appropriation: 'settle', current_amount: 'settle', spent: 'settle' };
const yen = (n: number): string => n.toLocaleString('ja-JP');
const kouTitle = (k: LifecycleKou): string => (k.account === 'general' ? `${k.ministry} › ${k.org}` : `${k.specialAccount}特別会計${k.subAccount ? ` › ${k.subAccount}` : ''}`);
const th = 'px-2 py-1 font-medium text-neutral-500';
const td = 'px-2 py-1';
const num = 'whitespace-nowrap px-2 py-1 text-right tabular-nums';
const STATE_BADGE = { original: '原本', derived: '導出' } as const;

export function LifecyclePage() {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = usePersistedState<number | null>('lifecycle:year', null);
  const [account, setAccount] = usePersistedState<'all' | 'general' | 'special'>('lifecycle:account', 'all');
  const [query, setQuery] = useState('');
  const [pattern, setPattern] = useState<LifecyclePattern>('all');
  const [selected, setSelected] = useState<number | null>(null);

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
  const sizeOf = useMemo(() => {
    const m = new Map<number, number>();
    for (const [i, v] of valuesOf) m.set(i, Math.max(0, v.current_amount ?? 0, v.budget_amount ?? 0, v.request_amount ?? 0));
    return m;
  }, [valuesOf]);
  const coverage = useMemo(() => lifecycleCoverage(data?.kous ?? []), [data]);

  const years = data?.years ?? [];
  const activeYear = data ? (year !== null && years.includes(year) ? year : years[0]!) : null;
  // 年度・会計・検索で絞った項（欠落パターンで絞る前）。パターンごとの件数は、この集合で数える
  const base = useMemo(() => {
    if (!data || activeYear === null) return [];
    const q = query.trim().toLowerCase();
    return data.kous
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.year === activeYear && (account === 'all' || k.account === account) && (q === '' || `${k.name} ${kouTitle(k)}`.toLowerCase().includes(q)));
  }, [data, activeYear, account, query]);
  const patternCounts = useMemo(() => lifecyclePatternCounts(base.map(x => x.k)), [base]);
  const list = useMemo(() => base.filter(({ k }) => lifecyclePatternMatches(k, pattern)).sort((a, b) => (sizeOf.get(b.i) ?? 0) - (sizeOf.get(a.i) ?? 0)), [base, pattern, sizeOf]);

  if (error) return <main className="mx-auto max-w-3xl p-8"><p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">データの読み込みに失敗しました: {error}（<code>npm run build:data</code> で作る）</p></main>;
  if (!data || activeYear === null) return <main className="mx-auto max-w-3xl p-8"><p className="text-sm text-neutral-500">読み込み中…</p></main>;

  const kou = selected !== null ? data.kous[selected] : undefined;
  const events = selected !== null ? byKou.get(selected) ?? [] : [];
  const checks = data.checks.filter(c => c.year === activeYear);
  const scope = `FY${activeYear} · 会計: ${account === 'all' ? 'すべて' : account === 'general' ? '一般会計' : '特別会計'} · 検索: ${query.trim() === '' ? 'なし' : `「${query.trim()}」`} · 欠落パターン: ${LIFECYCLE_PATTERNS.find(p => p.id === pattern)!.label}`;

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div>
          <h1 className="text-base font-semibold">予算の一生の表（試作）</h1>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            項の粒度 · FY{years[0]}–FY{years[years.length - 1]} · 概算要求 → 政府案 → 補正 → 決算 · データの形の仕様（案）を確かめるための試作で、確定した画面ではありません
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <YearSelect value={String(activeYear)} onChange={y => { setYear(Number(y)); setSelected(null); }} years={years} />
          <PageNavMenu current="lifecycle" />
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section aria-label="項の一覧" className="flex min-h-0 flex-col rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-2 border-b border-neutral-200 p-2 text-xs dark:border-neutral-800">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="項名・所管・組織で検索" aria-label="検索" className="w-full rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900" />
            <div className="flex items-center gap-3">
              {(['all', 'general', 'special'] as const).map(a => (
                <label key={a} className="flex cursor-pointer items-center gap-1">
                  <input type="radio" name="account" checked={account === a} onChange={() => setAccount(a)} />
                  {a === 'all' ? 'すべて' : a === 'general' ? '一般会計' : '特別会計'}
                </label>
              ))}
              <span className="ml-auto tabular-nums text-neutral-500">{list.length.toLocaleString()} 項</span>
            </div>
            <fieldset className="flex flex-col gap-0.5">
              <legend className="mb-0.5 text-[11px] font-semibold text-neutral-500">値のある段階</legend>
              {LIFECYCLE_PATTERNS.map(p => (
                <label key={p.id} title={p.definition || undefined} className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="pattern" checked={pattern === p.id} onChange={() => { setPattern(p.id); setSelected(null); }} />
                  {p.label}
                  <span className="ml-auto tabular-nums text-neutral-400">{patternCounts[p.id].toLocaleString()}</span>
                </label>
              ))}
              {pattern !== 'all' && <p className="text-[11px] text-neutral-500">{LIFECYCLE_PATTERNS.find(p => p.id === pattern)!.definition}。理由が分かっているかどうかは問わない。</p>}
            </fieldset>
            <p className="text-[11px] text-neutral-500">額の大きい順。要 = 概算要求、政 = 政府案、補 = 補正、決 = 決算 の値がある段階（薄い字は、値なし）。</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto">
            {list.slice(0, 400).map(({ k, i }) => (
              <li key={k.id}>
                <button type="button" onClick={() => setSelected(i)} aria-pressed={selected === i} className={`flex w-full flex-col gap-0.5 border-b border-neutral-100 px-3 py-1.5 text-left text-xs dark:border-neutral-800 ${selected === i ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{k.name}</span>
                    <span className="shrink-0 tabular-nums text-neutral-500">{formatSen((sizeOf.get(i) ?? 0) / 1000)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span className="truncate">{kouTitle(k)}</span>
                    <span className="shrink-0 font-mono">
                      {LIFECYCLE_STAGES.map(s => (
                        <span key={s} className={k.seenIn.includes(s) ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-300 dark:text-neutral-600'}>{EVENT_BADGE[s]}</span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {list.length > 400 && <li className="px-3 py-2 text-xs text-neutral-500">上位 400 項を表示。検索で絞ってください。</li>}
          </ul>
        </section>
        <section aria-label="項の一生" className="min-h-0 overflow-auto rounded-lg border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          {kou ? (
            <KouDetail kou={kou} events={events} coverage={coverage} />
          ) : (
            <Overview
              checks={checks}
              scope={scope}
              kous={list.map(x => x.k)}
              values={list.map(x => valuesOf.get(x.i) ?? {})}
              events={list.map(x => byKou.get(x.i) ?? [])}
              coverage={coverage}
            />
          )}
        </section>
      </main>
      <SourceNote />
    </div>
  );
}

/** 項を選ぶ前: 集計の対象範囲、観測額（全体）、比較できる項、検算の結果 */
function Overview({ checks, scope, kous, values, events, coverage }: { checks: LifecycleData['checks']; scope: string; kous: LifecycleKou[]; values: LifecycleValues[]; events: LifecycleEventRow[][]; coverage: LifecycleCoverage }) {
  const [mode, setMode] = useState<'observed' | 'compare'>('observed');
  const [pairId, setPairId] = useState<string>(LIFECYCLE_PAIRS[0]!.id);
  const NAME: Record<string, string> = {
    supp_identity: '補正: 改予算額 = 成立予算額 + 差引額、差引額 = 追加額 + 修正減少額',
    enacted_eq_budget: '成立予算額 = 政府案（両方に項がある項）',
    settle_current: '決算: 歳出予算現額 = 歳出予算額 + 前年度繰越 + 予備費使用 + 流用等 + 移替',
    settle_unused: '決算: 不用額 = 現額 − 支出済 − 翌年度繰越',
    settle_eq_revised: '決算の歳出予算額 = 改予算額（補正に項がある。段をまたぐ式）',
    settle_eq_budget_when_no_supp: '決算の歳出予算額 = 政府案（補正に項が無い。段をまたぐ式）',
  };
  const observed = lifecycleObserved(values);
  const all4 = pairId === 'all4' ? lifecycleAllStages(values) : null;
  const spec = LIFECYCLE_PAIRS.find(p => p.id === pairId);
  const pair = spec ? lifecyclePair(values, spec) : null;

  // 比べられない項の内訳: 値が無い側の段階について、その理由（画面の状態と同じ判定）を数える
  const excluded = (side: 'from' | 'to'): [string, number][] => {
    if (!spec) return [];
    const measure = side === 'from' ? spec.from : spec.to;
    const other = side === 'from' ? spec.to : spec.from;
    const stage = STAGE_OF_MEASURE[measure]!;
    const counts = new Map<string, number>();
    values.forEach((v, n) => {
      if (v[measure] !== undefined || v[other] === undefined) return;
      const st = lifecycleStageStatuses(kous[n]!, events[n]!.filter(e => e[1] !== 'derived'), coverage).find(x => x.stage === stage)!;
      counts.set(st.badge || '値なし', (counts.get(st.badge || '値なし') ?? 0) + 1);
    });
    return [...counts].sort((a, b) => b[1] - a[1]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">左の一覧から項を選ぶと、その項の一生を、段階ごとの状態・グラフ・表で見られます。</p>
        <p className="mt-1 text-neutral-500">値が無い段階は、0 ではなく「値なし」と表示し、理由が分かる範囲だけ併記します。補完はしません。</p>
      </div>
      <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/40">
        <p className="font-semibold">集計の対象</p>
        <p className="text-neutral-600 dark:text-neutral-300">{scope} · 対象 {kous.length.toLocaleString()} 項（左の一覧の項。年度・会計・検索・値のある段階の絞り込みに連動）</p>
      </div>
      <div role="tablist" aria-label="集計の見方" className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {([['observed', '観測額（全体）'], ['compare', '比較できる項']] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`-mb-px border-b-2 px-2.5 py-1 text-xs ${mode === m ? 'border-emerald-700 font-semibold dark:border-emerald-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>{label}</button>
        ))}
      </div>

      {mode === 'observed' ? (
        <section className="flex flex-col gap-2">
          <p className="text-neutral-500">各段階で、値を確認できた項の合計です。段階によって、値のある項の集合が違います（下の項数）。段階の間の差は、査定や増減を表しません。補正の記録が無い項は、補正後の合計に入っていません（政府案の額で補いません）。</p>
          <LevelsChart levels={observed.map(t => t.level)} />
          <table className="w-full max-w-2xl border-collapse">
            <thead><tr className="text-left"><th className={th}>段階（項目）</th><th className={`${th} text-right`}>観測額の合計</th><th className={`${th} text-right`}>値のある項数 / 対象</th></tr></thead>
            <tbody>
              {observed.map(t => (
                <tr key={t.level.key} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className={td}>{t.level.label}</td>
                  <td className={num}>{yen(t.level.yen!)} 円</td>
                  <td className={num}>{t.kou.toLocaleString()} / {kous.length.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-neutral-500">一般会計と特別会計をまたぐ合計は、繰入の分が二重になります。決算の共管（特別会計）の行は、足してあります。</p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-neutral-500">比べる 2 つの段階を選びます。<b>両方に値がある項だけ</b>で、合計と差を出します。片方にしか値が無い項は、比べず、数と理由だけを書きます。差の原因（査定・補正・組み替えなど）は、ここでは決めません。</p>
          <label className="flex items-center gap-2">
            比べる段階
            <select value={pairId} onChange={e => setPairId(e.target.value)} className="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900">
              {LIFECYCLE_PAIRS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="all4">4 つの段階がそろう項（概算要求・政府案・補正後・決算の歳出予算額）</option>
            </select>
          </label>
          {pair && spec && (
            <div className="flex flex-col gap-2">
              {pair.both === 0 ? (
                <p className="rounded border-l-[3px] border-amber-600 bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/40">比較できません: 両方の段階に値がある項が 0 です。差は計算しません。</p>
              ) : (
                <>
                  <LevelsChart levels={[{ key: spec.from, label: LIFECYCLE_MEASURES[spec.from].label, yen: pair.fromSum, stage: STAGE_OF_MEASURE[spec.from]! }, { key: spec.to, label: LIFECYCLE_MEASURES[spec.to].label, yen: pair.toSum, stage: STAGE_OF_MEASURE[spec.to]! }]} />
                  <table className="w-full max-w-2xl border-collapse">
                    <tbody>
                      <tr className="border-t border-neutral-100 dark:border-neutral-800"><td className={td}>比較できる項（両方に値がある）</td><td className={num}>{pair.both.toLocaleString()} 項</td></tr>
                      <tr className="border-t border-neutral-100 dark:border-neutral-800"><td className={td}>{LIFECYCLE_MEASURES[spec.from].label} の合計</td><td className={num}>{yen(pair.fromSum)} 円</td></tr>
                      <tr className="border-t border-neutral-100 dark:border-neutral-800"><td className={td}>{LIFECYCLE_MEASURES[spec.to].label} の合計</td><td className={num}>{yen(pair.toSum)} 円</td></tr>
                      <tr className="border-t border-neutral-100 font-semibold dark:border-neutral-800"><td className={td}>差（後 − 前）</td><td className={num}>{formatSenSigned(pair.diff / 1000)}（{formatRate(pair.rate)}）</td></tr>
                    </tbody>
                  </table>
                </>
              )}
              <p className="text-[11px] text-neutral-500">同じ項と見なした根拠: {spec.basis}。</p>
              <div className="text-[11px] text-neutral-500">
                <p>比べていない項: 前の段階にだけ値がある {pair.fromOnly.toLocaleString()} 項、後の段階にだけ値がある {pair.toOnly.toLocaleString()} 項（対象のうち、どちらにも値が無い項 {(kous.length - pair.both - pair.fromOnly - pair.toOnly).toLocaleString()} 項は数えない）。</p>
                {pair.fromOnly > 0 && <p>前だけ（後の段階が値なし）の内訳: {excluded('to').map(([b, n]) => `${b} ${n}`).join(' / ')}</p>}
                {pair.toOnly > 0 && <p>後だけ（前の段階が値なし）の内訳: {excluded('from').map(([b, n]) => `${b} ${n}`).join(' / ')}</p>}
              </div>
            </div>
          )}
          {all4 && (
            <div className="flex flex-col gap-2">
              {all4.kou === 0 ? (
                <p className="rounded border-l-[3px] border-amber-600 bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/40">4 つの段階がそろう項が 0 です。</p>
              ) : (
                <>
                  <LevelsChart levels={all4.levels} />
                  <p>4 つの段階がそろう {all4.kou.toLocaleString()} 項（対象 {kous.length.toLocaleString()} 項のうち）の合計です。2 つの段階の比較（上）とは、対象の項が違います。</p>
                </>
              )}
              <p className="text-[11px] text-neutral-500">同じ項と見なした根拠: 概算要求は名前の突合（MATCHED / NEAR_NAME）、ほかは同じ年度・同じ鍵。</p>
            </div>
          )}
        </section>
      )}

      <div>
        <h2 className="mt-2 font-semibold">{scope.split(' · ')[0]} の検算（全項目の件数。一覧の絞り込みには連動しない）</h2>
        <table className="mt-1 w-full max-w-3xl border-collapse">
          <thead><tr className="text-left"><th className={th}>式</th><th className={`${th} text-left`}>会計</th><th className={`${th} text-right`}>成り立つ / 対象</th></tr></thead>
          <tbody>
            {checks.map(c => (
              <tr key={`${c.account}-${c.name}`} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className={td}>{NAME[c.name] ?? c.name}</td>
                <td className={td}>{c.account === 'general' ? '一般' : '特別'}</td>
                <td className={`${num} ${c.ng > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{c.ok.toLocaleString()} / {(c.ok + c.ng).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-neutral-500">段をまたぐ式で合わない項は、原因が未確認です。</p>
      </div>
    </div>
  );
}

/** 段階の状態カード。値のある段階は代表の額（と補助の額）、無い段階は「—」と、理由が分かる範囲のラベル */
function StageCard({ s }: { s: StageStatus }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-lg border p-2.5 ${s.observed ? 'border-neutral-200 dark:border-neutral-700' : 'border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800/40'}`}>
      <p className="text-[11px] font-semibold text-neutral-500">{s.label}</p>
      {s.observed && s.headline ? (
        <>
          <p className="text-[11px] text-neutral-500">{s.headline.label}</p>
          <p className="text-base font-semibold tabular-nums" title={`${yen(s.headline.yen)} 円`}>{s.headline.yen === 0 ? '0円' : formatSen(s.headline.yen / 1000)}</p>
          <p className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-500">
            <span className="tabular-nums">{yen(s.headline.yen)} 円</span>
            <span title={s.headline.note} className={`rounded-full border px-1.5 ${s.headline.state === 'original' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-neutral-400'}`}>{STATE_BADGE[s.headline.state]}</span>
          </p>
          {s.headline.yen === 0 && <p className="text-[10px] text-neutral-500">観測した値が 0（値なしではない）</p>}
          {s.extras.length > 0 && (
            <dl className="mt-0.5 flex flex-col gap-0.5 border-t border-neutral-100 pt-1 text-[10px] dark:border-neutral-800">
              {s.extras.map(x => (
                <div key={x.measure} className="flex justify-between gap-2"><dt className="text-neutral-500">{x.label}</dt><dd className="tabular-nums" title={`${yen(x.yen)} 円（${STATE_BADGE[x.state]}）`}>{formatSen(x.yen / 1000)}</dd></div>
              ))}
            </dl>
          )}
        </>
      ) : s.observed ? (
        <p className="text-neutral-500">値あり（代表の額なし。下の表を参照）</p>
      ) : (
        <>
          <p className="text-base font-semibold text-neutral-400">—</p>
          <p className="text-[11px] font-semibold">{s.badge}</p>
          <p className="text-[10px] leading-relaxed text-neutral-500">{s.detail}</p>
        </>
      )}
    </div>
  );
}

function KouDetail({ kou, events: unsorted, coverage }: { kou: LifecycleKou; events: LifecycleEventRow[]; coverage: LifecycleCoverage }) {
  // 出来事の順（概算要求 → 政府案 → 補正 → 決算 → 導出）。同じ出来事の中は、元の並び
  const events = useMemo(() => [...unsorted].sort((a, b) => EVENT_ORDER.indexOf(a[1]) - EVENT_ORDER.indexOf(b[1])), [unsorted]);
  const groups = useMemo(() => {
    const out: { event: LifecycleEventType; version: string; part: string; rows: LifecycleEventRow[] }[] = [];
    for (const e of events) {
      const g = out.find(x => x.event === e[1] && x.version === e[2] && x.part === e[4]);
      if (g) g.rows.push(e);
      else out.push({ event: e[1], version: e[2], part: e[4], rows: [e] });
    }
    return out;
  }, [events]);
  const observedEvents = useMemo(() => events.filter(e => e[1] !== 'derived'), [events]);
  const statuses = useMemo(() => lifecycleStageStatuses(kou, observedEvents, coverage), [kou, observedEvents, coverage]);
  const values = useMemo(() => lifecycleValues(observedEvents), [observedEvents]);
  const levels = lifecycleLevels(values);
  const { changes, zero } = lifecycleChanges(values);
  const use = lifecycleUse(values);
  const base = values.budget_amount ?? values.current_amount ?? null;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · 項コード {kou.code} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
      </div>

      <section className="flex flex-col gap-2" aria-label="段階ごとの状態">
        <h3 className="font-semibold">段階ごとの状態</h3>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {statuses.map(s => <StageCard key={s.stage} s={s} />)}
        </div>
        <p className="text-[11px] text-neutral-500">
          「—」は、現行のデータにこの項の値が無いこと（0 とは別）。公式の資料にその項が無かったことは意味しません。代表の額は、概算要求 = 要求額、政府案 = 政府案の額、補正 = 改予算額、決算 = 支出済額。決算の歳出予算額・歳出予算現額は別の指標で、補助に出しています。
          「原本」= 原本の値、「導出」= 計算した値（予算書の項の金額は、目の行を足した値）。
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-label="グラフ">
        <h3 className="font-semibold">グラフ</h3>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-neutral-600 dark:text-neutral-300">段階ごとの額</p>
          <LevelsChart levels={levels} caption="柱 = 観測した値（0 を基準）。「—」= 値なし。段階の間は線で結んでいません（対応関係を線で表していません）。小さな差は、下の「増減」で見る。" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-neutral-600 dark:text-neutral-300">段階ごとの増減</p>
          <ChangesChart changes={changes} zero={zero} base={base} baseLabel={values.budget_amount !== undefined ? '政府案' : '現額'} />
          <p className="text-[11px] text-neutral-500">増減は、観測した 2 つの値の差（導出）。両方の値がある増減だけを出しています。原因が分かっていない差は、灰色の破線の棒です。</p>
        </div>
        {use && (
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-neutral-600 dark:text-neutral-300">歳出予算現額の使われ方</p>
            <UseChart parts={use.parts} total={use.total} />
          </div>
        )}
        <p className="text-[11px] text-neutral-500">グラフの値は、下の表の値と同じです（グラフは見やすさのためで、正は表）。概算要求から決算までを 1 本の帯（サンキー）にしないのは、概算要求 → 政府案の変化は査定による増減で、お金の移動ではないためです。</p>
      </section>

      <details className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
        <summary className="cursor-pointer font-semibold">検証用のデータ（幅広の形・長い形・出典・単位。{events.length} 行）</summary>
        <div className="mt-3 flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">幅広の形（出来事ごとに 1 つの表）</h3>
        {groups.map(g => (
          <div key={`${g.event}|${g.version}|${g.part}`} className="overflow-x-auto">
            <p className="mb-0.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
              {EVENT_LABEL[g.event]}
              {g.part && <span className="ml-1 font-normal text-neutral-500">（{g.part}）</span>}
              <span className="ml-1 font-normal text-neutral-500">単位: 円</span>
            </p>
            <table className="border-collapse">
              <thead>
                <tr>{g.rows.map(r => <th key={r[5]} className={`${th} text-right`}>{LIFECYCLE_MEASURES[r[5]].label}</th>)}</tr>
              </thead>
              <tbody>
                <tr className="border-t border-neutral-100 dark:border-neutral-800">
                  {g.rows.map(r => <td key={r[5]} className={`${num} ${r[9] === 'derived' && g.event === 'derived' ? 'text-sky-700 dark:text-sky-400' : ''}`}>{yen(r[8])}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">長い形（値 1 つが 1 行。events の行そのもの）</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>出来事</th><th className={th}>版</th><th className={th}>組織（共管）</th><th className={th}>項目</th>
                <th className={`${th} text-right`}>原本の値</th><th className={th}>単位</th><th className={`${th} text-right`}>円</th><th className={th}>状態</th><th className={th}>出典</th><th className={th}>注</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, n) => (
                <tr key={n} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className={td}>{EVENT_LABEL[e[1]]}</td>
                  <td className={`${td} text-neutral-500`}>{e[2]}</td>
                  <td className={`${td} text-neutral-500`}>{e[4]}</td>
                  <td className={td}><span className="font-mono text-[11px] text-neutral-500">{e[5]}</span><span className="block">{LIFECYCLE_MEASURES[e[5]].label}</span></td>
                  <td className={num}>{e[1] === 'derived' ? '' : Number(e[6]).toLocaleString('ja-JP')}</td>
                  <td className={`${td} text-neutral-500`}>{e[1] === 'derived' ? '' : e[7]}</td>
                  <td className={num}>{yen(e[8])}</td>
                  <td className={td}>
                    <span className={`rounded-full border px-1.5 text-[10px] ${e[9] === 'original' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-neutral-400 text-neutral-500'}`}>{e[9] === 'original' ? '原本' : '導出'}</span>
                  </td>
                  <td className={`${td} text-[11px] text-neutral-500`}>{e[10]}</td>
                  <td className={`${td} text-[11px] text-neutral-500`}>{e[11]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-neutral-500">
          状態: 原本 = 原本の値そのもの、導出 = 計算した値。予算書の項の金額は目の行を足した値なので「導出（目の合計）」。値が無い項目は、行を作らない（0 の行にしない）。
        </p>
      </section>
        </div>
      </details>
    </div>
  );
}
