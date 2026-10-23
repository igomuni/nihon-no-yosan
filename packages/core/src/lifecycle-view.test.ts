import { describe, expect, it } from 'vitest';
import type { LifecycleEventRow, LifecycleMeasure } from './lifecycle.ts';
import { LIFECYCLE_PAIRS, lifecycleAllStages, lifecycleChanges, lifecycleLevels, lifecycleObserved, lifecyclePair, lifecycleUse, lifecycleValues } from './lifecycle-view.ts';

const row = (measure: LifecycleMeasure, yen: number, part = ''): LifecycleEventRow => [0, 'budget', '', '', part, measure, String(yen), '円', yen, 'derived', '', ''];
// FY2024 消費者庁共通費（円）
const events = [
  row('request_amount', 4_991_087_000), row('budget_amount', 5_028_079_000), row('enacted_amount', 5_028_079_000), row('supp_net', -63_381_000), row('revised_amount', 4_964_698_000),
  row('appropriation', 4_964_698_000), row('carryover_in', 0), row('reserve_use', 0), row('fungible', 0), row('transfer', 0), row('current_amount', 4_964_698_000),
  row('spent', 4_549_176_935), row('carryover_out', 0), row('unused', 415_521_065),
];
const pair = (id: string) => LIFECYCLE_PAIRS.find(p => p.id === id)!;

describe('lifecycle-view', () => {
  const v = lifecycleValues(events);
  it('lists the amounts of the stages in order', () => {
    expect(lifecycleLevels(v).map(l => [l.label, l.yen])).toEqual([
      ['概算要求', 4_991_087_000], ['政府案', 5_028_079_000], ['補正後', 4_964_698_000], ['決算の歳出予算額', 4_964_698_000], ['歳出予算現額', 4_964_698_000], ['支出済', 4_549_176_935],
    ]);
  });
  it('puts a "no value" place (null, not 0) for a stage without a value, and never fills it', () => {
    // 決算にだけ値がある項
    const only = lifecycleLevels(lifecycleValues([row('appropriation', 5), row('current_amount', 5), row('spent', 4)]));
    expect(only.map(l => [l.stage, l.label, l.yen])).toEqual([
      ['request', '概算要求', null], ['budget', '政府案', null], ['supp', '補正', null], ['settle', '決算の歳出予算額', 5], ['settle', '歳出予算現額', 5], ['settle', '支出済', 4],
    ]);
    // 政府案はあるが補正の記録が無い項: 補正後に政府案の額を入れない
    const noSupp = lifecycleLevels(lifecycleValues([row('budget_amount', 100), row('appropriation', 100)]));
    expect(noSupp.find(l => l.stage === 'supp')!.yen).toBeNull();
  });
  it('keeps an explicit 0 as 0 and tells it from a missing value', () => {
    const levels = lifecycleLevels(lifecycleValues([row('budget_amount', 0)]));
    expect(levels.find(l => l.stage === 'budget')!.yen).toBe(0);
    expect(levels.find(l => l.stage === 'request')!.yen).toBeNull();
  });
  it('computes the change of each step and leaves out zero changes (naming them)', () => {
    const { changes, zero } = lifecycleChanges(v);
    expect(changes.map(c => [c.key, c.yen])).toEqual([['assessment', 36_992_000], ['supp', -63_381_000]]);
    expect(zero).toEqual(['組み替え等（原因未確認）', '前年度繰越', '予備費使用', '流用等', '予算決定後の移替']);
  });
  it('marks the gap between the settlement and the revised amount as unexplained, and says so when it is compared with the 政府案 (no supplementary record)', () => {
    const { changes } = lifecycleChanges({ ...v, appropriation: 1_000 });
    expect(changes.find(c => c.key === 'rearrange')).toMatchObject({ unexplained: true, yen: 1_000 - 4_964_698_000, label: '組み替え等（原因未確認）' });
    const noSupp = lifecycleChanges({ budget_amount: 100, appropriation: 150 }).changes;
    expect(noSupp).toMatchObject([{ key: 'rearrange', yen: 50, unexplained: true }]);
    expect(noSupp[0]!.label).toContain('補正の記録なし');
    expect(noSupp[0]!.note).toContain('導出');
  });
  it('splits the current amount into spent, carried over and unused, and the parts add up to it', () => {
    const use = lifecycleUse(v)!;
    expect(use.total).toBe(v.current_amount);
    expect(lifecycleUse({ spent: 1 })).toBeNull();
  });
  it('adds the rows of a 項 settled in several parts (co-managing organisations)', () => {
    expect(lifecycleValues([row('appropriation', 6000, 'a'), row('appropriation', 4000, 'b')]).appropriation).toBe(10000);
  });
  it('totals the observed amounts per stage with the number of 項 that have a value (no filling; each stage has its own set)', () => {
    const settleOnly = lifecycleValues([row('appropriation', 7)]);
    const budgetOnly = lifecycleValues([row('budget_amount', 100), row('current_amount', 90)]);
    const t = lifecycleObserved([v, budgetOnly, settleOnly]);
    expect(t.map(x => [x.level.label, x.level.yen, x.kou])).toEqual([
      ['概算要求', 4_991_087_000, 1], ['政府案', 5_028_079_100, 2], ['補正後（改予算額）', 4_964_698_000, 1], ['決算の歳出予算額', 4_964_698_007, 2], ['歳出予算現額', 4_964_698_090, 2], ['支出済', 4_549_176_935, 1],
    ]);
  });
  it('compares two items only over the 項 that have both, and counts the ones that cannot be compared', () => {
    const a = lifecycleValues([row('budget_amount', 100), row('appropriation', 90)]);
    const b = lifecycleValues([row('budget_amount', 50)]); // 決算なし
    const c = lifecycleValues([row('appropriation', 7)]); // 政府案なし
    const r = lifecyclePair([a, b, c], pair('budget-appropriation'));
    expect(r).toMatchObject({ both: 1, fromSum: 100, toSum: 90, diff: -10, fromOnly: 1, toOnly: 1 });
    expect(r.rate).toBeCloseTo(-0.1);
    // 両方がある項が無ければ、差は計算しない（rate = null）
    expect(lifecyclePair([b, c], pair('budget-appropriation'))).toMatchObject({ both: 0, diff: 0, rate: null });
  });
  it('totals the 項 that have all four stages, separately from the two-stage comparison', () => {
    const all = lifecycleAllStages([v, lifecycleValues([row('budget_amount', 10), row('appropriation', 10)])]);
    expect(all.kou).toBe(1);
    expect(all.levels.map(l => [l.label, l.yen])).toEqual([['概算要求', 4_991_087_000], ['政府案', 5_028_079_000], ['補正後（改予算額）', 4_964_698_000], ['決算の歳出予算額', 4_964_698_000]]);
  });
});
