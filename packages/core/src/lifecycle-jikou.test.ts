import { describe, expect, it } from 'vitest';
import { jikouAmount, jikouEvidenceMask, jikouEvidenceOf, jikouIndex, jikouTable, jikouTotals, type LifecycleJikouData, type LifecycleJikouNode } from './lifecycle-jikou.ts';

// 項 A（添字 0: FY2023、1: FY2024）、項 B（添字 2: FY2024、別の項）
const n = (k: number, year: number, name: string, budget: number | null, revised: number | null = null): LifecycleJikouNode => [k, year, name, budget, null, revised, revised === null || budget === null ? null : revised - budget];
const data: LifecycleJikouData = {
  years: [2023, 2024],
  kous: ['2023:general:A', '2024:general:A', '2024:general:B'],
  nodes: [
    n(0, 2023, '事項 X', 100, 110), //  0
    n(0, 2023, '事項 Y', 300, null), //  1
    n(0, 2023, '事項 Z', 50), //  2（FY2024 に続かない）
    n(1, 2024, '事項 X', 120), //  3
    n(1, 2024, '事項 Y 改', 280), //  4（改称）
    n(1, 2024, '事項 W', 10), //  5（新しい）
    n(2, 2024, '別の項の事項', 999), //  6
  ],
  links: [
    [0, 3, jikouEvidenceMask(['same_key']), 0],
    [1, 4, jikouEvidenceMask(['same_item_other_name', 'prev_amount_eq_budget']), 1],
    [2, 6, jikouEvidenceMask(['same_name_other_item']), 4], // 項をまたぐ対応（選んだ項の外）
  ],
};
const index = jikouIndex(data);

describe('jikouTable', () => {
  const table = jikouTable(index, ['2023:general:A', '2024:general:A']);
  it('lines up the 事項 by the resolved links, newest year first (largest 政府案 first), then rows that end earlier', () => {
    expect(table.years).toEqual([2023, 2024]);
    expect(table.rows.map(r => r.name)).toEqual(['事項 Y 改', '事項 X', '事項 W', '事項 Z']);
  });
  it('keeps a renamed row as one row and says so', () => {
    const y = table.rows[0]!;
    expect([...y.cells.keys()]).toEqual([2024, 2023]);
    expect(y.renamed).toBe(true);
    expect(y.cells.get(2024)?.link).toBe(1);
    expect(y.cells.get(2023)?.link).toBeUndefined();
  });
  it('does not join a link whose other end is outside the chosen 項', () => {
    const only = jikouTable(index, ['2023:general:A']);
    expect(only.rows).toHaveLength(3);
    expect(only.rows.every(r => r.cells.size === 1)).toBe(true);
  });
  it('totals a year without counting the missing values as 0', () => {
    expect(jikouTotals(index, table, 'budget')).toEqual([
      { year: 2023, rows: 3, withValue: 3, sum: 450 },
      { year: 2024, rows: 3, withValue: 3, sum: 410 },
    ]);
    // 補正後は、FY2023 の事項 X だけ（記録の無い事項は足さない）。FY2024 は 1 件も無い
    expect(jikouTotals(index, table, 'revised')).toEqual([
      { year: 2023, rows: 3, withValue: 1, sum: 110 },
      { year: 2024, rows: 3, withValue: 0, sum: null },
    ]);
    expect(jikouAmount(index, table.rows[1]!.cells.get(2023), 'revised')).toBe(110);
    expect(jikouAmount(index, table.rows[0]!.cells.get(2023), 'revised')).toBeNull();
  });
  it('ignores a node that has two incoming resolved links', () => {
    const dup: LifecycleJikouData = { ...data, links: [...data.links, [2, 3, 1, 0]] };
    const t = jikouTable(jikouIndex(dup), ['2023:general:A', '2024:general:A']);
    // 事項 X（FY2024）に 2 つ入るので、どちらの辺も使わない。FY2023 の事項 X と FY2024 の事項 X は別の行
    expect(t.rows.filter(r => r.name === '事項 X')).toHaveLength(2);
  });
});

describe('evidence mask', () => {
  it('round-trips', () => {
    expect(jikouEvidenceOf(jikouEvidenceMask(['same_key', 'prev_amount_eq_revised']))).toEqual(['same_key', 'prev_amount_eq_revised']);
  });
});

describe('事項 that exist only in the supplementary budget', () => {
  const only: LifecycleJikouData = {
    years: [2020],
    kous: ['2020:general:A'],
    nodes: [n(0, 2020, '当初の事項', 100, 150), [0, 2020, '補正で新しい事項', null, null, 900, 900]],
    links: [],
  };
  const idx = jikouIndex(only);
  const t = jikouTable(idx, ['2020:general:A']);
  it('is left out of the 政府案 total (and its row count), and counted in the 補正後 total', () => {
    expect(jikouTotals(idx, t, 'budget')).toEqual([{ year: 2020, rows: 1, withValue: 1, sum: 100 }]);
    expect(jikouTotals(idx, t, 'revised')).toEqual([{ year: 2020, rows: 2, withValue: 2, sum: 1050 }]);
  });
});
