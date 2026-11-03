import { describe, expect, it } from 'vitest';
import { aggregateYears, sumByYear } from './lifecycle-aggregate.ts';

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
  it('years の年度は、行が 0 でも出す', () => {
    expect(sumByYear([{ year: 2024, values: { budget: 1 } }], [2023, 2024, 2025])).toEqual([
      { year: 2023, count: 0, values: {} },
      { year: 2024, count: 1, values: { budget: 1 } },
      { year: 2025, count: 0, values: {} },
    ]);
  });
});

describe('aggregateYears', () => {
  it('年度ごとの一覧の行を足す。条件に合う行が無い年度は 0 行', () => {
    const rows: Record<number, { b: number | null }[]> = { 2023: [{ b: 1 }, { b: null }], 2024: [{ b: 2 }], 2025: [] };
    const out = aggregateYears([2023, 2024, 2025], y => rows[y]!, r => ({ budget: r.b }));
    expect(out).toEqual([
      { year: 2023, count: 2, values: { budget: 1 } },
      { year: 2024, count: 1, values: { budget: 2 } },
      { year: 2025, count: 0, values: {} },
    ]);
  });
});
