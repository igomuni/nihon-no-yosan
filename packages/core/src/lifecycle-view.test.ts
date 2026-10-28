import { describe, expect, it } from 'vitest';
import type { LifecycleEventRow, LifecycleMeasure } from './lifecycle.ts';
import { lifecycleValues } from './lifecycle-view.ts';

const row = (measure: LifecycleMeasure, yen: number, part = ''): LifecycleEventRow => [0, 'budget', '', '', part, measure, String(yen), '円', yen, 'derived', '', ''];

describe('lifecycleValues', () => {
  it('adds the rows of a 項 settled in several parts (co-managing organisations)', () => {
    expect(lifecycleValues([row('appropriation', 6000, 'a'), row('appropriation', 4000, 'b')]).appropriation).toBe(10000);
  });

  it('has no key for an amount without a row (a missing value is not 0), and keeps an explicit 0', () => {
    const v = lifecycleValues([row('budget_amount', 0)]);
    expect(v.budget_amount).toBe(0);
    expect('spent' in v).toBe(false);
  });
});
