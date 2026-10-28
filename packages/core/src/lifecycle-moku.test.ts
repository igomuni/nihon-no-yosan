import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { INITIAL_LIFECYCLE_FILTERS } from './lifecycle-list.ts';
import { MOKU_FLAG, MOKU_MEASURES, filterMokuRows, isSettleMeasure, kouIdsWithMoku, mokuFlow, mokuIndex, mokuListRows, mokuSelectionKey, mokuSpan, mokuSettleNote, mokuSuppNote, mokuValue, sortMokuRows, type LifecycleMokuData, type LifecycleMokuNode } from './lifecycle-moku.ts';

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
