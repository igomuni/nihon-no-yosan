import { describe, expect, it } from 'vitest';
import { aggregateKous, sumByYear } from './lifecycle-aggregate.ts';

describe('sumByYear', () => {
  it('年度ごとに値のある行だけを足し、値が 1 つも無い段階は値なし、0 は値', () => {
    const out = sumByYear([
      { year: 2024, values: { budget: 10, spent: null } },
      { year: 2023, values: { budget: 5 } },
      { year: 2024, values: { budget: 0, spent: undefined, request: 3 } },
    ]);
    expect(out).toEqual([
      { year: 2023, count: 1, values: { budget: 5 } },
      { year: 2024, count: 2, values: { budget: 10, request: 3 } },
    ]);
  });
});

describe('aggregateKous', () => {
  it('各項の流れの年度ごとの額を足す', () => {
    const kous = [{ year: 2023 }, { year: 2024 }, { year: 2023 }, { year: 2024 }];
    const valuesOf = new Map([[0, { budget_amount: 1 }], [1, { budget_amount: 2, carryover_out: 7 }], [2, { budget_amount: 10 }], [3, { budget_amount: 20 }]]);
    const out = aggregateKous([[0, 1], [2, 3]], kous, valuesOf as never);
    expect(out).toEqual([{ year: 2023, count: 2, values: { budget: 11 } }, { year: 2024, count: 2, values: { budget: 22, carried: 7 } }]);
  });
});
