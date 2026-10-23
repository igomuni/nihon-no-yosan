import { describe, expect, it } from 'vitest';
import type { LifecycleEventRow, LifecycleKou, LifecycleMeasure } from './lifecycle.ts';
import { LIFECYCLE_PATTERNS, lifecycleCoverage, lifecyclePatternCounts, lifecyclePatternMatches, lifecycleStageStatuses } from './lifecycle-status.ts';

const kou = (id: string, seenIn: LifecycleKou['seenIn'], o: Partial<LifecycleKou> = {}): LifecycleKou => ({
  id, year: 2024, account: 'general', ministry: '内閣府', org: '本府', specialAccount: '', subAccount: '', code: '001', name: id, seenIn, ...o,
});
const ev = (type: LifecycleEventRow[1], measure: LifecycleMeasure, yen: number, state: 'original' | 'derived' = 'derived', note = ''): LifecycleEventRow => [0, type, '', '', '', measure, String(yen), '円', yen, state, '', note];

// 内閣府: 4 段階そろう項、決算にだけある項、政府案はあるが概算要求に突合できなかった項。法務省は概算要求の項が 1 件も突合できていない
const full = kou('full', ['request', 'budget', 'supp', 'settle']);
const settleOnly = kou('settleOnly', ['settle']);
const noRequest = kou('noRequest', ['budget', 'supp', 'settle']);
const noSupp = kou('noSupp', ['request', 'budget', 'settle']);
const moj = kou('moj', ['budget', 'settle'], { ministry: '法務省' });
const mojOther = kou('mojOther', ['budget'], { ministry: '法務省' });
const all = [full, settleOnly, noRequest, noSupp, moj, mojOther];
const cov = lifecycleCoverage(all);
const fullEvents = [ev('request', 'request_amount', 100, 'original', '概算要求書（MOF 突合）'), ev('budget', 'budget_amount', 110, 'derived', '目の合計'), ev('supp', 'revised_amount', 105), ev('supp', 'supp_net', -5), ev('settle', 'appropriation', 105), ev('settle', 'current_amount', 105), ev('settle', 'spent', 100)];
const statuses = (k: LifecycleKou, es: LifecycleEventRow[]) => Object.fromEntries(lifecycleStageStatuses(k, es, cov).map(s => [s.stage, s]));

describe('lifecycleStageStatuses', () => {
  it('always returns the four stages in the same order, with a representative amount for each stage that has a value', () => {
    const s = lifecycleStageStatuses(full, fullEvents, cov);
    expect(s.map(x => x.stage)).toEqual(['request', 'budget', 'supp', 'settle']);
    expect(s.every(x => x.observed)).toBe(true);
    expect(s.map(x => [x.headline!.label, x.headline!.yen])).toEqual([['要求額', 100], ['政府案の額', 110], ['改予算額（補正後）', 105], ['支出済額', 100]]);
    // 決算の歳出予算額・歳出予算現額は、支出済額と取り替えず補助の額に置く
    expect(s[3]!.extras.map(x => [x.label, x.yen])).toEqual([['歳出予算額', 105], ['歳出予算現額', 105]]);
  });
  it('keeps the state (original / derived) of each amount, so it can be checked from the detail', () => {
    const s = statuses(full, fullEvents);
    expect(s['request']!.headline).toMatchObject({ state: 'original', note: '概算要求書（MOF 突合）' });
    expect(s['budget']!.headline).toMatchObject({ state: 'derived', note: '目の合計' });
  });
  it('shows a 項 that has only a settlement: the other stages have no value (not 0), each with a reason the data can support', () => {
    const s = statuses(settleOnly, [ev('settle', 'spent', 5), ev('settle', 'appropriation', 5)]);
    expect(s['settle']!.observed).toBe(true);
    for (const st of ['request', 'budget', 'supp'] as const) expect(s[st]).toMatchObject({ observed: false, headline: null });
    expect(s['request']).toMatchObject({ reason: 'not_compared', badge: '未照合（突合の対象外）' });
    expect(s['budget']).toMatchObject({ reason: 'no_row', badge: '政府案の CSV に行なし' });
    expect(s['budget']!.detail).toContain('公式の資料に項が無かったことまでは分からない');
  });
  it('tells an explicit 0 from a missing record', () => {
    const zero = statuses(full, [ev('request', 'request_amount', 0, 'original'), ev('budget', 'budget_amount', 0)]);
    expect(zero['request']).toMatchObject({ observed: true, headline: { yen: 0 } });
    expect(zero['supp']).toMatchObject({ observed: false, headline: null, reason: 'no_row', badge: '補正の記録なし' });
  });
  it('does not turn the 政府案 into an observed amount of the supplementary stage when there is no supplementary record', () => {
    const s = statuses(noSupp, [ev('request', 'request_amount', 10, 'original'), ev('budget', 'budget_amount', 11), ev('settle', 'spent', 11)]);
    expect(s['supp']).toMatchObject({ observed: false, headline: null });
    expect(s['supp']!.detail).toContain('導出・表示用');
  });
  it('separates why the 概算要求 has no value: no counterpart, an empty ministry, or not compared', () => {
    const a = statuses(noRequest, [ev('budget', 'budget_amount', 1)]);
    expect(a['request']).toMatchObject({ reason: 'no_counterpart', badge: '突合で対応なし' });
    expect(a['request']!.detail).toContain('この所管の他の項は');
    const b = statuses(moj, [ev('budget', 'budget_amount', 1)]);
    expect(b['request']).toMatchObject({ reason: 'scope_empty', badge: '未収録の可能性' });
    expect(b['request']!.detail).toContain('0 件');
  });
  it('falls back to "reason not fixed" when the data cannot tell (the stage is missing for the whole year and account)', () => {
    const lonely = [kou('x', ['budget'])];
    const s = lifecycleStageStatuses(lonely[0]!, [ev('budget', 'budget_amount', 1)], lifecycleCoverage(lonely));
    expect(s.find(x => x.stage === 'settle')).toMatchObject({ reason: 'unknown', badge: '現行データに値なし（理由未確定）' });
  });
});

describe('filters by the pattern of missing stages', () => {
  it('counts each pattern and keeps the 項 with a stage missing out of "all stages"', () => {
    const c = lifecyclePatternCounts(all);
    expect(c).toEqual({ all: 6, all_stages: 1, partial: 5, no_budget: 1, request_only: 0, settle_only: 1 });
    expect(lifecyclePatternMatches(noRequest, 'all_stages')).toBe(false);
    expect(lifecyclePatternMatches(noRequest, 'partial')).toBe(true);
    expect(all.filter(k => lifecyclePatternMatches(k, 'settle_only')).map(k => k.id)).toEqual(['settleOnly']);
    expect(LIFECYCLE_PATTERNS.every(p => p.id === 'all' || p.definition.length > 0)).toBe(true);
  });

  it('a 項 only in the request document: matches request_only and no_budget, and the other stages say it is not linked to the 予算書 (not 0)', () => {
    const ro = kou('ro', ['request'], { requestOnly: 'reqOnly' });
    expect(lifecyclePatternMatches(ro, 'request_only')).toBe(true);
    expect(lifecyclePatternMatches(ro, 'no_budget')).toBe(true);
    expect(lifecyclePatternMatches(full, 'request_only')).toBe(false);
    const s = statuses(ro, [ev('request', 'request_amount', 5, 'original')]);
    expect(s['request']!.observed).toBe(true);
    for (const st of ['budget', 'supp', 'settle'] as const) expect(s[st]).toMatchObject({ observed: false, reason: 'request_only', badge: '予算書に対応なし（概算要求のみ）' });
  });
});
