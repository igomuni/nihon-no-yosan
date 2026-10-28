import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { INITIAL_LIFECYCLE_FILTERS } from './lifecycle-list.ts';
import { MOKU_FLAG, MOKU_MEASURES, filterMokuRows, isSettleMeasure, kouIdsWithMoku, mokuChartSum, mokuCodeCounts, mokuCounts, mokuFlow, mokuIndex, mokuKouTable, mokuListRows, mokuSelectionKey, mokuSpan, mokuSettleNote, mokuSuppNote, mokuValue, sortMokuRows, type LifecycleMokuData, type LifecycleMokuNode } from './lifecycle-moku.ts';

const kou = (id: string, o: Partial<LifecycleKou> = {}): LifecycleKou => ({ id, year: 2024, account: 'general', ministry: '財務省', org: '財務本省', specialAccount: '', subAccount: '', code: '001', name: id, seenIn: ['budget'], ...o });
const A23 = kou('2023:general:A', { year: 2023, name: '項A' }), A24 = kou('2024:general:A', { name: '項A' }), B24 = kou('2024:general:B', { name: '項B', ministry: '法務省', org: '法務本省' });
const kouById = new Map([A23, A24, B24].map(k => [k.id, k]));
type V = [number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null];
const none: V = [null, null, null, null, null, null, null, null];
const n = (k: number, year: number, name: string, codes: string, v: Partial<Record<'budget' | 'revised' | 'current' | 'request' | 'carried' | 'carriedIn', number>>, flags = 0, part = ''): LifecycleMokuNode => {
  const x: V = [...none];
  if (v.budget !== undefined) x[0] = v.budget;
  if (v.revised !== undefined) x[1] = v.revised;
  if (v.current !== undefined) x[3] = v.current;
  if (v.carried !== undefined) x[5] = v.carried;
  if (v.request !== undefined) x[7] = v.request;
  return [k, year, name, codes, part, ...x, flags, v.carriedIn ?? null];
};
const data: LifecycleMokuData = {
  years: [2023, 2024],
  suppYears: [2023, 2024],
  settleYears: [2023],
  requestYears: [2024],
  kous: [A23.id, A24.id, B24.id],
  nodes: [
    n(0, 2023, '庁費', '1|2', { budget: 100, current: 90 }, MOKU_FLAG.suppAggregated), //  0
    n(0, 2023, '委託費', '1|3', { budget: 50, revised: 70, current: 70, carried: 8, carriedIn: 5 }, MOKU_FLAG.suppItem), //  1
    n(1, 2024, '庁費', '1|9', { budget: 120, request: 130 }, MOKU_FLAG.suppKouOnly), //  2（分類コードが変わる）
    n(1, 2024, '委託費', '1|3', { budget: 60 }), //  3
    n(2, 2024, '施設整備費', '2|4', { revised: 300 }, MOKU_FLAG.suppItem), //  4（補正で出る目）
    n(2, 2024, '調査費', '', { request: 40 }, MOKU_FLAG.requestOnly), //  5
  ],
  requestCoverage: [[1, 'full'], [2, 'partial']],
};
const index = mokuIndex(data);

describe('mokuListRows', () => {
  const rows = mokuListRows(index, kouById, 2024, id => (id.endsWith(':A') ? [A23.id, A24.id] : [id]));
  it('makes a row of each 目 of the year, with null for missing values, and the size as the largest of request, 政府案, 補正後 and 現額', () => {
    expect(rows.map(r => r.name)).toEqual(['庁費', '委託費', '施設整備費', '調査費']);
    expect(rows[0]).toMatchObject({ k: A24, budget: 120, request: 130, revised: null, current: null, size: 130 });
    expect(rows[2]).toMatchObject({ budget: null, revised: 300, size: 300 });
  });
});

describe('filterMokuRows and sortMokuRows', () => {
  const rows = mokuListRows(index, kouById, 2024, id => [id]);
  it('filters by the 項 filters and the 目名', () => {
    expect(filterMokuRows(rows, { ...INITIAL_LIFECYCLE_FILTERS, mokuName: '費' }, 2024).length).toBe(4);
    expect(filterMokuRows(rows, { ...INITIAL_LIFECYCLE_FILTERS, mokuName: '^庁費$', mokuNameRegex: true }, 2024).map(r => r.name)).toEqual(['庁費']);
    expect(filterMokuRows(rows, { ...INITIAL_LIFECYCLE_FILTERS, groups: ['法務省'] }, 2024).map(r => r.name)).toEqual(['施設整備費', '調査費']);
  });
  it('puts the rows without a value last, in both directions', () => {
    expect(sortMokuRows(rows, 'budget', -1).map(r => r.name)).toEqual(['庁費', '委託費', '施設整備費', '調査費']);
    expect(sortMokuRows(rows, 'budget', 1).map(r => r.name)).toEqual(['委託費', '庁費', '施設整備費', '調査費']);
  });
});

describe('kouIdsWithMoku', () => {
  it('returns the 項 that have a matching 目 in the year, or null without a query', () => {
    expect(kouIdsWithMoku(index, 2024, '', false)).toBeNull();
    expect([...kouIdsWithMoku(index, 2024, '調査', false)!]).toEqual([B24.id]);
  });
});

describe('mokuFlow', () => {
  it('finds the same 目 in the chained 項 by name and codes, and by the name alone when it is the only one', () => {
    expect(mokuFlow(index, 3, [A23.id, A24.id])).toEqual([{ kouId: A23.id, node: 1, byName: false }, { kouId: A24.id, node: 3, byName: false }]);
    expect(mokuFlow(index, 2, [A23.id, A24.id])).toEqual([{ kouId: A23.id, node: 0, byName: true }, { kouId: A24.id, node: 2, byName: false }]);
  });
  it('gives null for a 項 without the 目 or without 目 data', () => {
    expect(mokuFlow(index, 4, [B24.id, '2025:general:B'])).toEqual([{ kouId: B24.id, node: 4, byName: false }, { kouId: '2025:general:B', node: null, byName: false }]);
  });
});

describe('notes and keys', () => {
  it('explains why the 補正 and the 決算 have no value', () => {
    expect(mokuSuppNote(data, data.nodes[0]!)).toContain('外N目');
    expect(mokuSuppNote(data, data.nodes[2]!)).toContain('項の行');
    expect(mokuSuppNote(data, data.nodes[3]!)).toContain('補正の無い項');
    expect(mokuSuppNote(data, data.nodes[1]!)).toBeNull();
    expect(mokuSettleNote(data, data.nodes[3]!)).toContain('決算の書は、データに無い');
    expect(mokuSettleNote(data, data.nodes[0]!)).toBeNull();
  });
  it('keys a selection by the 項 and the 目 identity', () => {
    expect(mokuSelectionKey(index, 2)).toBe(`${A24.id}|庁費|1|9|`);
    expect(index.nodeByKey.get(mokuSelectionKey(index, 2))).toBe(2);
    expect(index.coverageOf.get(B24.id)).toBe('partial');
  });
});

describe('mokuKouTable', () => {
  it('aligns the 目 of the chained 項 by name when the name is unique in every year, and marks a change of the codes', () => {
    const rows = mokuKouTable(index, [{ id: A23.id, year: 2023 }, { id: A24.id, year: 2024 }]);
    expect(rows.map(r => [r.name, [...r.cells], r.byName])).toEqual([['庁費', [[2023, 0], [2024, 2]], true], ['委託費', [[2023, 1], [2024, 3]], false]]);
  });
  it('aligns by the name and the codes when a year has two 目 of the same name, and keeps the 共管 parts apart', () => {
    const d: LifecycleMokuData = {
      ...data,
      kous: [A23.id, A24.id],
      nodes: [
        n(0, 2023, '庁費', '1|2', { budget: 1 }),
        n(1, 2024, '庁費', '1|2', { budget: 2 }),
        n(1, 2024, '庁費', '1|3', { budget: 3 }),
        n(1, 2024, '庁費', '1|2', { current: 4 }, MOKU_FLAG.settlePart, '内閣府|内閣本府'),
      ],
      requestCoverage: [],
    };
    const rows = mokuKouTable(mokuIndex(d), [{ id: A23.id, year: 2023 }, { id: A24.id, year: 2024 }]);
    expect(rows.map(r => [r.part, [...r.cells]])).toEqual([['', [[2023, 0], [2024, 1]]], ['', [[2024, 2]]], ['内閣府|内閣本府', [[2024, 3]]]]);
  });
});

describe('mokuSpan', () => {
  it('counts the years in which the same 目 is found in a row of the chained 項', () => {
    expect(mokuSpan(index, 3, [A23.id, A24.id])).toEqual({ from: 2023, to: 2024, years: 2 });
    expect(mokuSpan(index, 2, [A23.id, A24.id])).toEqual({ from: 2023, to: 2024, years: 2 });
  });
  it('stops at a year without the 目, and is the year alone for a 項 without a chain', () => {
    expect(mokuSpan(index, 3, [A23.id, '2025:general:A', A24.id])).toEqual({ from: 2024, to: 2024, years: 1 });
    expect(mokuSpan(index, 4, [B24.id])).toEqual({ from: 2024, to: 2024, years: 1 });
  });
});

describe('carry-over measures', () => {
  it('reads the 翌年度繰越額 and the 前年度繰越額 of a 目, and null where the 決算 has none', () => {
    expect(mokuValue(data.nodes[1]!, 'carried')).toBe(8);
    expect(mokuValue(data.nodes[1]!, 'carriedIn')).toBe(5);
    expect(mokuValue(data.nodes[0]!, 'carried')).toBeNull();
    expect(mokuValue(data.nodes[0]!, 'carriedIn')).toBeNull();
  });

  it('treats them as values of the 決算 (the other stages do not have them) and ties them to the 項 values', () => {
    expect(isSettleMeasure('carried') && isSettleMeasure('carriedIn') && isSettleMeasure('current')).toBe(true);
    expect(isSettleMeasure('budget') || isSettleMeasure('request') || isSettleMeasure('revised')).toBe(false);
    expect(MOKU_MEASURES.filter(m => m.key.startsWith('carried')).map(m => m.kou)).toEqual(['carryover_in', 'carryover_out']);
  });
});

describe('mokuChartSum', () => {
  it('adds the values, and does not add up a 目 whose value is not known (補正後 of a 目 in a 外N目 row)', () => {
    expect(mokuChartSum(data, [2, 3], 'budget', false)).toBe(180);
    expect(mokuChartSum(data, [0, 1], 'revised', false)).toBeNull(); // 0 は外N目の行にまとめられた目で、補正後が分からない
  });

  it('skips a 目 that is not in the stage (a 目 only in the 概算要求書 has no 政府案), and adds every 目 of the 概算要求 when all of them are chosen', () => {
    expect(mokuChartSum(data, [2, 5], 'budget', false)).toBe(120); // 調査費は概算要求書にだけある目
    expect(mokuChartSum(data, [2, 5], 'request', true)).toBe(170);
  });
});

describe('mokuCounts', () => {
  it('counts the 目 of each 項 by name and codes, and counts the 目 only in the 概算要求書 apart', () => {
    const c = mokuCounts(data);
    expect(c.get(A23.id)).toEqual({ total: 2, requestOnly: 0 });
    expect(c.get(B24.id)).toEqual({ total: 2, requestOnly: 1 }); // 調査費は概算要求書にだけある目
    expect(c.has('2099:general:none')).toBe(false); // 目の無い項は入らない
  });

  it('does not count a 共管 row of the 決算 as another 目', () => {
    const d: LifecycleMokuData = { ...data, nodes: [n(0, 2023, '庁費', '1|2', { budget: 1 }), n(0, 2023, '庁費', '1|2', { current: 2 }, MOKU_FLAG.settlePart, '内閣府|内閣本府'), n(0, 2023, '庁費', '1|2', { current: 3 }, MOKU_FLAG.settlePart, '法務省|法務本省')] };
    expect(mokuCounts(d).get(A23.id)).toEqual({ total: 1, requestOnly: 0 });
  });
});

describe('分類コード（主要経費別・使途別）', () => {
  // 一般会計の目は 主要経費別|目的別|財政法|経済性質別|使途別
  const d: LifecycleMokuData = {
    ...data,
    nodes: [
      n(0, 2023, '職員基本給', '95|016|2|11|1', { budget: 10 }),
      n(0, 2023, '庁費', '95|016|2|12|3', { budget: 20 }),
      n(0, 2023, '防衛費', '35|030|2|12|3', { budget: 30 }),
      n(0, 2023, '共管分', '35|030|2|12|3', { current: 1 }, MOKU_FLAG.settlePart, '内閣府|内閣本府'),
      n(0, 2023, '調査費', '', { request: 5 }, MOKU_FLAG.requestOnly),
    ],
    requestCoverage: [],
  };
  const idx = mokuIndex(d);
  const rows = mokuListRows(idx, kouById, 2023, id => [id]);

  it('puts the codes of the 目 in the rows of the list (blank when the 目 has none)', () => {
    expect(rows.map(r => [r.name, r.major, r.use])).toEqual([['職員基本給', '95', '1'], ['庁費', '95', '3'], ['防衛費', '35', '3'], ['共管分', '35', '3'], ['調査費', '', '']]);
  });

  it('filters the 目 by the codes: empty means all, the codes of both are ANDed, and a 目 without the code is out', () => {
    const f = (o: Partial<typeof INITIAL_LIFECYCLE_FILTERS>) => filterMokuRows(rows, { ...INITIAL_LIFECYCLE_FILTERS, ...o }, 2023).map(r => r.name);
    expect(f({})).toHaveLength(5);
    expect(f({ majors: ['95'] })).toEqual(['職員基本給', '庁費']);
    expect(f({ uses: ['3'] })).toEqual(['庁費', '防衛費', '共管分']);
    expect(f({ majors: ['95'], uses: ['3'] })).toEqual(['庁費']);
    expect(f({ majors: ['__none__'] })).toEqual([]);
  });

  it('finds the 項 that have a 目 with the codes (of the same 目), and counts the codes of the year without the 共管 rows', () => {
    expect([...kouIdsWithMoku(idx, 2023, '', false, { majors: ['35'], uses: [] })!]).toEqual([A23.id]);
    expect(kouIdsWithMoku(idx, 2023, '', false, { majors: ['35'], uses: ['1'] })!.size).toBe(0); // 35 で使途別 1 の目は無い
    expect(kouIdsWithMoku(idx, 2023, '', false)).toBeNull();
    const c = mokuCodeCounts(d, 2023);
    expect([...c.major]).toEqual([['95', 2], ['35', 1]]);
    expect([...c.use]).toEqual([['1', 1], ['3', 2]]);
  });

  it('sorts by the code', () => {
    expect(sortMokuRows(rows, 'major', 1).map(r => r.name)).toEqual(['調査費', '共管分', '防衛費', '職員基本給', '庁費']); // 空は先頭、同じコードは名前の順
  });
});
