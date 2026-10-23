import { describe, expect, it } from 'vitest';
import type { LifecycleEventRow, LifecycleMeasure } from './lifecycle.ts';
import { lifecycleChanges, lifecycleLevels, lifecycleTotals, lifecycleUse, lifecycleValues } from './lifecycle-view.ts';

const row = (measure: LifecycleMeasure, yen: number, part = ''): LifecycleEventRow => [0, 'budget', '', '', part, measure, String(yen), '円', yen, 'derived', '', ''];
// FY2024 消費者庁共通費（円）
const events = [
  row('request_amount', 4_991_087_000), row('budget_amount', 5_028_079_000), row('enacted_amount', 5_028_079_000), row('supp_net', -63_381_000), row('revised_amount', 4_964_698_000),
  row('appropriation', 4_964_698_000), row('carryover_in', 0), row('reserve_use', 0), row('fungible', 0), row('transfer', 0), row('current_amount', 4_964_698_000),
  row('spent', 4_549_176_935), row('carryover_out', 0), row('unused', 415_521_065),
];

describe('lifecycle-view', () => {
  const v = lifecycleValues(events);
  it('lists the amounts of the stages that have a value, in order', () => {
    expect(lifecycleLevels(v).map(l => [l.label, l.yen])).toEqual([
      ['概算要求', 4_991_087_000], ['政府案', 5_028_079_000], ['補正後', 4_964_698_000], ['決算の歳出予算額', 4_964_698_000], ['歳出予算現額', 4_964_698_000], ['支出済', 4_549_176_935],
    ]);
    expect(lifecycleLevels({ appropriation: 5 }).map(l => l.label)).toEqual(['決算の歳出予算額']);
  });
  it('computes the change of each step and leaves out zero changes (naming them)', () => {
    const { changes, zero } = lifecycleChanges(v);
    expect(changes.map(c => [c.key, c.yen])).toEqual([['assessment', 36_992_000], ['supp', -63_381_000]]);
    expect(zero).toEqual(['組み替え等（原因未確認）', '前年度繰越', '予備費使用', '流用等', '予算決定後の移替']);
  });
  it('marks the gap between the settlement and the revised amount as unexplained', () => {
    const { changes } = lifecycleChanges({ ...v, appropriation: 1_000 });
    expect(changes.find(c => c.key === 'rearrange')).toMatchObject({ unexplained: true, yen: 1_000 - 4_964_698_000 });
    // 補正が無ければ政府案と比べる
    expect(lifecycleChanges({ budget_amount: 100, appropriation: 150 }).changes).toMatchObject([{ key: 'rearrange', yen: 50 }]);
  });
  it('splits the current amount into spent, carried over and unused, and the parts add up to it', () => {
    const use = lifecycleUse(v)!;
    expect(use.total).toBe(v.current_amount);
    expect(lifecycleUse({ spent: 1 })).toBeNull();
  });
  it('adds the rows of a 項 settled in several parts (co-managing organisations)', () => {
    expect(lifecycleValues([row('appropriation', 6000, 'a'), row('appropriation', 4000, 'b')]).appropriation).toBe(10000);
  });
  it('totals each stage over the 項 that have a 政府案 (a 項 without a supplementary row counts as unchanged), with the number of 項', () => {
    const noBudget = [row('appropriation', 7)]; // 政府案が無い項（決算にだけある）は数えない
    const t = lifecycleTotals([events, [row('budget_amount', 100), row('current_amount', 90)], noBudget]);
    expect(t.map(x => [x.level.label, x.level.yen, x.kou])).toEqual([
      ['概算要求', 4_991_087_000, 1], ['政府案', 5_028_079_100, 2], ['補正後', 4_964_698_100, 2], ['決算の歳出予算額', 4_964_698_000, 1], ['歳出予算現額', 4_964_698_090, 2], ['支出済', 4_549_176_935, 1],
    ]);
  });
});
