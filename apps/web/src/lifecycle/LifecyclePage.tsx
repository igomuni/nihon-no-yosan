import { useEffect, useMemo, useState } from 'react';
import {
  LIFECYCLE_MEASURES,
  formatSen,
  lifecycleChanges,
  lifecycleLevels,
  lifecycleTotals,
  lifecycleUse,
  lifecycleValues,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecycleEventType,
  type LifecycleKou,
} from '@nihon-no-yosan/core';
import { ChangesChart, LevelsChart, UseChart } from './charts.tsx';
import { loadGzJson } from '../data.ts';
import { PageNavMenu } from '../components/PageNavMenu.tsx';
import { SourceNote } from '../components/SourceNote.tsx';
import { YearSelect } from '../components/YearSelect.tsx';
import { usePersistedState } from '../usePersistedState.ts';

/**
 * 予算の一生の表（試作）。1 つの項について、概算要求 → 政府案 → 補正 → 決算の値を、2 つの形で見比べる。
 * 仕様（案）: docs/guides/budget-lifecycle.md。仕様のレビュー用で、確定した画面ではない。
 */

const EVENT_LABEL: Record<LifecycleEventType, string> = { request: '概算要求', budget: '政府案', supp: '補正', settle: '決算', derived: '導出' };
const EVENT_BADGE: Record<Exclude<LifecycleEventType, 'derived'>, string> = { request: '要', budget: '政', supp: '補', settle: '決' };
const EVENT_ORDER: LifecycleEventType[] = ['request', 'budget', 'supp', 'settle', 'derived'];
const yen = (n: number): string => n.toLocaleString('ja-JP');
const kouTitle = (k: LifecycleKou): string => (k.account === 'general' ? `${k.ministry} › ${k.org}` : `${k.specialAccount}特別会計${k.subAccount ? ` › ${k.subAccount}` : ''}`);
const th = 'px-2 py-1 font-medium text-neutral-500';
const td = 'px-2 py-1';
const num = 'whitespace-nowrap px-2 py-1 text-right tabular-nums';

export function LifecyclePage() {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = usePersistedState<number | null>('lifecycle:year', null);
  const [account, setAccount] = usePersistedState<'all' | 'general' | 'special'>('lifecycle:account', 'all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadGzJson<LifecycleData>('lifecycle/data.json.gz')
      .then(d => { if (alive) setData(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  // 項ごとの出来事と、並べ替えの大きさ（現額・政府案・要求額のうち最大）
  const byKou = useMemo(() => {
    const m = new Map<number, LifecycleEventRow[]>();
    for (const e of data?.events ?? []) (m.get(e[0]) ?? m.set(e[0], []).get(e[0])!).push(e);
    return m;
  }, [data]);
  const sizeOf = useMemo(() => {
    const m = new Map<number, number>();
    for (const [i, es] of byKou) m.set(i, Math.max(0, ...es.filter(e => e[5] === 'current_amount' || e[5] === 'budget_amount' || e[5] === 'request_amount').map(e => e[8])));
    return m;
  }, [byKou]);

  const years = data?.years ?? [];
  const activeYear = data ? (year !== null && years.includes(year) ? year : years[0]!) : null;
  const list = useMemo(() => {
    if (!data || activeYear === null) return [];
    const q = query.trim().toLowerCase();
    return data.kous
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.year === activeYear && (account === 'all' || k.account === account) && (q === '' || `${k.name} ${kouTitle(k)}`.toLowerCase().includes(q)))
      .sort((a, b) => (sizeOf.get(b.i) ?? 0) - (sizeOf.get(a.i) ?? 0));
  }, [data, activeYear, account, query, sizeOf]);

  if (error) return <main className="mx-auto max-w-3xl p-8"><p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">データの読み込みに失敗しました: {error}（<code>npm run build:data</code> で作る）</p></main>;
  if (!data || activeYear === null) return <main className="mx-auto max-w-3xl p-8"><p className="text-sm text-neutral-500">読み込み中…</p></main>;

  const totals = lifecycleTotals(list.map(({ i }) => byKou.get(i) ?? []));
  const kou = selected !== null ? data.kous[selected] : undefined;
  const events = selected !== null ? byKou.get(selected) ?? [] : [];
  const checks = data.checks.filter(c => c.year === activeYear);

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
            <p className="text-[11px] text-neutral-500">額の大きい順。要 = 概算要求、政 = 政府案、補 = 補正、決 = 決算 の値がある段階。</p>
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
                      {(['request', 'budget', 'supp', 'settle'] as const).map(s => (
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
          {kou ? <KouDetail kou={kou} events={events} /> : <Overview checks={checks} year={activeYear} totals={totals} account={account} />}
        </section>
      </main>
      <SourceNote />
    </div>
  );
}

/** 項を選ぶ前: 説明と、その年度の検算の結果 */
function Overview({ checks, year, totals, account }: { checks: LifecycleData['checks']; year: number; totals: ReturnType<typeof lifecycleTotals>; account: 'all' | 'general' | 'special' }) {
  const NAME: Record<string, string> = {
    supp_identity: '補正: 改予算額 = 成立予算額 + 差引額、差引額 = 追加額 + 修正減少額',
    enacted_eq_budget: '成立予算額 = 政府案（両方に項がある項）',
    settle_current: '決算: 歳出予算現額 = 歳出予算額 + 前年度繰越 + 予備費使用 + 流用等 + 移替',
    settle_unused: '決算: 不用額 = 現額 − 支出済 − 翌年度繰越',
    settle_eq_revised: '決算の歳出予算額 = 改予算額（補正に項がある。段をまたぐ式）',
    settle_eq_budget_when_no_supp: '決算の歳出予算額 = 政府案（補正に項が無い。段をまたぐ式）',
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">左の一覧から項を選ぶと、その項の一生を 2 つの形で並べます。</p>
      <ul className="list-disc space-y-1 pl-5 text-neutral-600 dark:text-neutral-300">
        <li><b>幅広の形:</b> 出来事（概算要求・政府案・補正・決算）ごとに 1 つの表。項目が列。人が読みやすい。</li>
        <li><b>長い形:</b> 値 1 つが 1 行（events の行そのもの）。状態（原本 / 導出）・出典・原本の単位と、正規化した円を持つ。</li>
      </ul>
      <p className="text-neutral-500">同じ値を、2 つの形で出しています。どちらを正とするか（または両方持つか）を決めるための試作です。</p>
      <h2 className="mt-2 font-semibold">FY{year} の段階ごとの合計（左の一覧の項の合計）</h2>
      <LevelsChart levels={totals.map(t => t.level)} caption="政府案がある項の合計（決算にだけある項は含めない）。補正の無い項は、補正後を政府案と同額として足した。概算要求・決算の段は、その段に値がある項だけの合計なので、項の数（下）を見て読む。一般会計と特別会計をまたぐ合計は、繰入の分が二重になります。" />
      <p className="text-[11px] text-neutral-500">項の数: {totals.map(t => `${t.level.label} ${t.kou.toLocaleString()}`).join(' / ')}{account === 'all' ? '（一般会計と特別会計の合計）' : ''}</p>
      <h2 className="mt-2 font-semibold">FY{year} の検算（全項目の件数）</h2>
      <table className="w-full max-w-3xl border-collapse">
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
      <p className="text-neutral-500">段をまたぐ式で合わない項は、原因が未確認です。</p>
    </div>
  );
}

function KouDetail({ kou, events: unsorted }: { kou: LifecycleKou; events: LifecycleEventRow[] }) {
  // 出来事の順（概算要求 → 政府案 → 補正 → 決算 → 導出）。同じ出来事の中は、元の並び
  const events = useMemo(() => [...unsorted].sort((a, b) => EVENT_ORDER.indexOf(a[1]) - EVENT_ORDER.indexOf(b[1])), [unsorted]);
  // 幅広の形: 出来事（と、決算の共管の組織）ごとに 1 行
  const groups = useMemo(() => {
    const out: { event: LifecycleEventType; version: string; part: string; rows: LifecycleEventRow[] }[] = [];
    for (const e of events) {
      const g = out.find(x => x.event === e[1] && x.version === e[2] && x.part === e[4]);
      if (g) g.rows.push(e);
      else out.push({ event: e[1], version: e[2], part: e[4], rows: [e] });
    }
    return out;
  }, [events]);
  const missing = (['request', 'budget', 'supp', 'settle'] as const).filter(s => !kou.seenIn.includes(s));
  const values = useMemo(() => lifecycleValues(events.filter(e => e[1] !== 'derived')), [events]);
  const levels = lifecycleLevels(values);
  const { changes, zero } = lifecycleChanges(values);
  const use = lifecycleUse(values);
  const base = values.budget_amount ?? values.current_amount ?? null;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · 項コード {kou.code} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
        <p className="mt-1 text-neutral-500">
          値がある段階: {kou.seenIn.map(s => EVENT_LABEL[s]).join('・') || 'なし'}
          {missing.length > 0 && `（${missing.map(s => EVENT_LABEL[s]).join('・')}には、この項の値が無い。0 ではなく「無い」）`}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="font-semibold">グラフ</h3>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-neutral-600 dark:text-neutral-300">段階ごとの額</p>
          <LevelsChart levels={levels} caption="柱は 0 を基準にした額。段の間の小さな差は、下の「増減」で見る。" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-neutral-600 dark:text-neutral-300">段階ごとの増減</p>
          <ChangesChart changes={changes} zero={zero} base={base} baseLabel={values.budget_amount !== undefined ? '政府案' : '現額'} />
        </div>
        {use && (
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-neutral-600 dark:text-neutral-300">歳出予算現額の使われ方</p>
            <UseChart parts={use.parts} total={use.total} />
          </div>
        )}
        <p className="text-[11px] text-neutral-500">グラフの値は、下の表の値と同じです（グラフは見やすさのためで、正は表）。概算要求から決算までを 1 本の帯（サンキー）にしないのは、概算要求 → 政府案の変化は査定による増減で、お金の移動ではないためです。</p>
      </section>

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
  );
}
