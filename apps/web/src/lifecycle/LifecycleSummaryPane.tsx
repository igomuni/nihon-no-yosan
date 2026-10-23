import { useState } from 'react';
import {
  LIFECYCLE_MEASURES,
  LIFECYCLE_PAIRS,
  formatRate,
  formatSenSigned,
  lifecycleAllStages,
  lifecycleObserved,
  lifecyclePair,
  lifecycleStageStatuses,
  type LifecycleCoverage,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecycleKou,
  type LifecycleMeasure,
  type LifecycleStage,
  type LifecycleValues,
} from '@nihon-no-yosan/core';
import { LevelsChart } from './charts.tsx';
import { num, td, th, yen } from './shared.ts';

const STAGE_OF_MEASURE: Partial<Record<LifecycleMeasure, LifecycleStage>> = { request_amount: 'request', budget_amount: 'budget', revised_amount: 'supp', appropriation: 'settle', current_amount: 'settle', spent: 'settle' };

/** 集計: 対象範囲、観測額（全体）、比較できる項、検算の結果（一覧の絞り込みに連動） */
export function LifecycleSummaryPane({ checks, scope, stageNote, kous, values, events, coverage }: { checks: LifecycleData['checks']; scope: string; stageNote: string; kous: LifecycleKou[]; values: LifecycleValues[]; events: LifecycleEventRow[][]; coverage: LifecycleCoverage }) {
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
    <div className="flex flex-col gap-4 p-4 text-xs">
      <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/40">
        <p className="font-semibold">集計の対象</p>
        <p className="text-neutral-600 dark:text-neutral-300">{scope} · 対象 {kous.length.toLocaleString()} 項（一覧の項。フィルタに連動）</p>
        <p className="mt-0.5 text-neutral-500">この年度に、基準データで値のある段階 — {stageNote}。無い段階の項は、「値なし」（0 ではない）。</p>
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
