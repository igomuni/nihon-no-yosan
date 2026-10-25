import { useMemo } from 'react';
import {
  LIFECYCLE_MEASURES,
  formatSen,
  lifecycleChanges,
  lifecycleLevels,
  lifecycleStageStatuses,
  lifecycleUse,
  lifecycleValues,
  type LifecycleChain,
  type LifecycleCoverage,
  type LifecycleData,
  type LifecycleLink,
  type LifecycleLinkAmount,
  type LifecycleLinkEvidence,
  type LifecycleEventRow,
  type LifecycleEventType,
  type LifecycleKou,
  type LifecycleValues,
  type StageStatus,
} from '@nihon-no-yosan/core';
import { ChangesChart, LevelsChart, UseChart } from './charts.tsx';
import { kouTitle, num, td, th, yen } from './shared.ts';
import { LinkBadge } from './LifecycleListPane.tsx';
import { LifecycleTrendTab } from './LifecycleTrendTab.tsx';

const EVENT_LABEL: Record<LifecycleEventType, string> = { request: '概算要求', budget: '政府案', supp: '補正', settle: '決算', derived: '導出' };
const EVENT_ORDER: LifecycleEventType[] = ['request', 'budget', 'supp', 'settle', 'derived'];
const STATE_BADGE = { original: '原本', derived: '導出' } as const;

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

const EVIDENCE_LABEL: Record<LifecycleLinkEvidence, string> = {
  same_key: '同じ鍵（所管・組織・項コード・項名。特別会計は特別会計・勘定・項コード・項名。概算要求のみの項は、所属・項名）',
  same_name_other_code: '同じ所管・組織で項名が同じ（項コードが違う）',
  same_name_other_org: '項名が同じ（所管・組織が違う）',
  prev_amount_eq_revised: '次の年度の予算書の前年度予算額 = 前の年度の改予算額',
  prev_amount_eq_budget: '次の年度の前年度予算額 = 前の年度の政府案の額（補正が無い項。概算要求書の前年度予算額との比べ方も、これ）',
};
const AMOUNT_LABEL: Record<LifecycleLinkAmount, string> = {
  eq_revised: '前年度予算額が、前の年度の改予算額と一致',
  eq_budget: '前年度予算額が、前の年度の政府案の額と一致',
  ne: '前年度予算額が、前の年度の改予算額・政府案の額のどちらとも違う（組替え後の額の可能性があるが、確かめていない）',
  zero: '前年度予算額が 0（比べない）',
  'n/a': '比べられない（どちらかに値が無い）',
};

/** 年度をまたぐ対応。前の年度・次の年度の項との対応を、根拠と状態つきで並べる（対応先へ移れる） */
function LinksSection({ kou, data, links, selfIndex, onNavigate }: { kou: LifecycleKou; data: LifecycleData; links: readonly LifecycleLink[]; selfIndex: number; onNavigate: (id: string) => void }) {
  return (
    <section className="flex flex-col gap-2" aria-label="年度をまたぐ対応">
      <h3 className="font-semibold">年度をまたぐ対応</h3>
      {links.length === 0 && <p className="text-neutral-500">対応の行がありません。</p>}
      <ul className="flex flex-col gap-2">
        {links.map((l, n) => {
          const other = l.from === selfIndex ? l.to : l.from;
          const partner = other >= 0 ? data.kous[other] : undefined;
          const dir = l.from === selfIndex ? `→ FY${kou.year + 1}` : `← FY${kou.year - 1}`;
          return (
            <li key={n} className="flex flex-col gap-1 rounded border border-neutral-200 p-2 dark:border-neutral-700">
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-neutral-500">{dir}</span>
                <LinkBadge status={l.status} />
                {partner ? (
                  <button type="button" onClick={() => onNavigate(partner.id)} className="text-left font-medium text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-900 dark:text-blue-400">
                    {partner.name}
                  </button>
                ) : <span className="text-neutral-500">対応先の候補なし</span>}
              </p>
              {partner && <p className="text-[11px] text-neutral-500">{kouTitle(partner)} · {partner.requestOnly ? '概算要求のみ（予算書の項コードなし）' : `項コード ${partner.code}`}</p>}
              {l.evidence.length > 0 && (
                <ul className="list-disc pl-4 text-[11px] text-neutral-600 dark:text-neutral-300">
                  {l.evidence.map(e => <li key={e}>{EVIDENCE_LABEL[e]}</li>)}
                </ul>
              )}
              {partner && <p className="text-[11px] text-neutral-500">額の確認: {AMOUNT_LABEL[l.amount]}</p>}
              {l.status === 'AMBIGUOUS' && <p className="text-[11px] text-neutral-500">候補があるが、名前と額の根拠がそろわない、または候補が複数。同じ項と断定しない。</p>}
              {l.status === 'UNRESOLVED' && <p className="text-[11px] text-neutral-500">相手の年度に、名前・額が合う候補が無い。項が無くなった・新しくできたとは限らない（確かめていない）。</p>}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-neutral-500">「確定」は、同じ鍵、または名前と額の根拠がそろって 1 対 1 のとき。額の確認は状態を変えない。会計（一般・特別）をまたぐ対応は探していない。</p>
    </section>
  );
}

export type DetailTab = 'life' | 'trend';

/** 右ペインのタブ（項の一生 / 年度推移） */
function DetailTabs({ tab, onTab }: { tab: DetailTab; onTab: (t: DetailTab) => void }) {
  return (
    <div role="tablist" aria-label="項の表示" className="sticky top-0 z-10 flex gap-1 border-b border-neutral-200 bg-white px-3 pt-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      {([['life', '一生（段階）'], ['trend', '年度推移']] as const).map(([t, label]) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)} className={`rounded-t border-b-2 px-2.5 py-1 ${tab === t ? 'border-emerald-600 font-semibold text-neutral-900 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>{label}</button>
      ))}
    </div>
  );
}

export function LifecycleDetailPane({ kou, events: unsorted, coverage, data, links, selfIndex, onNavigate, tab, onTab, chain, valuesOf }: { kou: LifecycleKou | null; events: LifecycleEventRow[]; coverage: LifecycleCoverage; data: LifecycleData; links: readonly LifecycleLink[]; selfIndex: number; onNavigate: (id: string) => void; tab: DetailTab; onTab: (t: DetailTab) => void; chain: LifecycleChain | null; valuesOf: ReadonlyMap<number, LifecycleValues> }) {
  // 出来事の順（概算要求 → 政府案 → 補正 → 決算 → 導出）。同じ出来事の中は、元の並び
  const events = useMemo(() => [...unsorted].sort((a, b) => EVENT_ORDER.indexOf(a[1]) - EVENT_ORDER.indexOf(b[1])), [unsorted]);
  const observedEvents = useMemo(() => events.filter(e => e[1] !== 'derived'), [events]);
  const statuses = useMemo(() => (kou ? lifecycleStageStatuses(kou, observedEvents, coverage) : []), [kou, observedEvents, coverage]);
  const values = useMemo(() => lifecycleValues(observedEvents), [observedEvents]);
  if (!kou) return <p className="p-4 text-xs text-neutral-500">一覧から項を選ぶと、その項の概算要求 → 政府案 → 補正 → 決算を、段階ごとの状態・グラフ・表で見られます。値が無い段階は 0 ではなく「値なし」と表示し、補完しません。</p>;
  const levels = lifecycleLevels(values);
  const { changes, zero } = lifecycleChanges(values);
  const use = lifecycleUse(values);
  const base = values.budget_amount ?? values.current_amount ?? null;
  if (tab === 'trend' && chain) return <><DetailTabs tab={tab} onTab={onTab} /><LifecycleTrendTab kou={kou} chain={chain} kous={data.kous} valuesOf={valuesOf} links={data.links} onNavigate={onNavigate} /></>;
  return (
    <>
    <DetailTabs tab={tab} onTab={onTab} />
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · {kou.requestOnly ? '概算要求のみ（予算書の項コードなし）' : `項コード ${kou.code}`} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
      </div>

      <section className="flex flex-col gap-2" aria-label="段階ごとの状態">
        <h3 className="font-semibold">段階ごとの状態</h3>
        <div className="grid grid-cols-2 gap-2">
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

      <LinksSection kou={kou} data={data} links={links} selfIndex={selfIndex} onNavigate={onNavigate} />

      <details className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
        <summary className="cursor-pointer font-semibold">値と出典（{events.length} 行）</summary>
        <div className="mt-3 flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">値 1 つが 1 行（events の行そのもの）</h3>
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
    </>
  );
}
