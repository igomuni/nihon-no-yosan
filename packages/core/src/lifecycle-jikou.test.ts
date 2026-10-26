import { describe, expect, it } from 'vitest';
import { jikouAmount, jikouCounts, jikouEvidenceMask, jikouEvidenceOf, jikouIndex, jikouRequestOnly, jikouTable, jikouTotals, type LifecycleJikouData, type LifecycleJikouNode } from './lifecycle-jikou.ts';

// 項 A（添字 0: FY2023、1: FY2024）、項 B（添字 2: FY2024、別の項）
const n = (k: number, year: number, name: string, budget: number | null, revised: number | null = null, request: number | null = null): LifecycleJikouNode => [k, year, name, budget, null, revised, revised === null || budget === null ? null : revised - budget, request];
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
  requestRead: [],
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
    nodes: [n(0, 2020, '当初の事項', 100, 150), [0, 2020, '補正で新しい事項', null, null, 900, 900, null]],
    links: [],
    requestRead: [],
  };
  const idx = jikouIndex(only);
  const t = jikouTable(idx, ['2020:general:A']);
  it('is left out of the 政府案 total (and its row count), and counted in the 補正後 total', () => {
    expect(jikouTotals(idx, t, 'budget')).toEqual([{ year: 2020, rows: 1, withValue: 1, sum: 100 }]);
    expect(jikouTotals(idx, t, 'revised')).toEqual([{ year: 2020, rows: 2, withValue: 2, sum: 1050 }]);
  });
});

describe('概算要求の事項', () => {
  // 項 0: 当初の事項 P（要求 90）、予算のみの事項 Q、要求のみの事項 R（要求 40）。項 1: 要求の事項を読めていない項
  const d: LifecycleJikouData = {
    years: [2024],
    kous: ['2024:general:A', '2024:general:B'],
    nodes: [n(0, 2024, 'P', 100, null, 90), n(0, 2024, 'Q', 50), n(0, 2024, 'R', null, null, 40), n(1, 2024, 'S', 70)],
    links: [],
    requestRead: [0],
  };
  const idx = jikouIndex(d);
  it('counts a 事項 in the 概算要求 total only when it has a requested amount, and leaves request-only ones out of the 政府案 total', () => {
    const t = jikouTable(idx, ['2024:general:A']);
    expect(jikouTotals(idx, t, 'request')).toEqual([{ year: 2024, rows: 2, withValue: 2, sum: 130 }]);
    expect(jikouTotals(idx, t, 'budget')).toEqual([{ year: 2024, rows: 2, withValue: 2, sum: 150 }]);
    expect(jikouTotals(idx, t, 'revised')).toEqual([{ year: 2024, rows: 2, withValue: 0, sum: null }]);
  });
  it('knows which 項 had their requested 事項 read, and tells the kinds of node apart', () => {
    expect(idx.requestRead.has(0)).toBe(true);
    expect(idx.requestRead.has(1)).toBe(false);
    expect(d.nodes.map(x => jikouRequestOnly(x))).toEqual([false, false, true, false]);
  });
});

describe('jikouCounts', () => {
  it('counts the 事項 of each 項 (one year), telling the ones only in the supplementary budget and only in the 概算要求', () => {
    const d: LifecycleJikouData = {
      years: [2024],
      kous: ['2024:general:A', '2024:general:B'],
      nodes: [n(0, 2024, 'P', 100, null, 90), n(0, 2024, 'Q', 50), n(0, 2024, 'R', null, null, 40), n(0, 2024, 'S', null, 900), n(1, 2024, 'T', 7)],
      links: [],
      requestRead: [0],
    };
    expect(jikouCounts(jikouIndex(d))).toEqual(new Map([
      ['2024:general:A', { total: 4, suppOnly: 1, requestOnly: 1 }],
      ['2024:general:B', { total: 1, suppOnly: 0, requestOnly: 0 }],
    ]));
  });
});
