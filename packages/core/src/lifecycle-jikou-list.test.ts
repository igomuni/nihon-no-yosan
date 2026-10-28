import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { jikouIndex, type LifecycleJikouData, type LifecycleJikouNode } from './lifecycle-jikou.ts';
import { filterJikouRows, jikouListRows, kouIdsWithJikou, sortJikouRows } from './lifecycle-jikou-list.ts';
import { INITIAL_LIFECYCLE_FILTERS } from './lifecycle-list.ts';

const kou = (id: string, o: Partial<LifecycleKou> = {}): LifecycleKou => ({ id, year: 2024, account: 'general', ministry: '財務省', org: '財務本省', specialAccount: '', subAccount: '', code: '001', name: id, seenIn: ['budget'], ...o });
const A = kou('2024:general:A', { name: '項A' }), B = kou('2024:general:B', { name: '項B', ministry: '法務省', org: '法務本省' });
const kouById = new Map([[A.id, A], [B.id, B], ['2023:general:A', kou('2023:general:A', { year: 2023, name: '項A' })]]);
const n = (k: number, year: number, name: string, budget: number | null, revised: number | null = null, request: number | null = null, major = ''): LifecycleJikouNode => [k, year, name, budget, null, revised, null, request, major];
const data: LifecycleJikouData = {
  years: [2023, 2024],
  kous: ['2023:general:A', '2024:general:A', '2024:general:B'],
  nodes: [
    n(0, 2023, '研究費', 100), //  0 → 3（名称が変わる）
    n(1, 2024, '研究費の推進', 300, 320, 280, '12'), //  3
    n(1, 2024, '施設費', 50, null, null, '95'), //  2（前の年度に対応なし）
    n(2, 2024, '研究費の調査', null, null, 40), //  要求のみ
    n(2, 2024, '補正で新しい', null, 900), //  補正のみ
  ],
  links: [[0, 1, 1, 4]],
  requestRead: [1, 2],
};
const index = jikouIndex(data);

describe('jikouListRows', () => {
  const rows = jikouListRows(index, kouById, 2024);
  it('makes a row of each 事項 of the year, with its 項, its values (null when missing) and the length of its flow', () => {
    expect(rows.map(r => r.name)).toEqual(['研究費の推進', '施設費', '研究費の調査', '補正で新しい']);
    expect(rows[0]).toMatchObject({ k: A, budget: 300, revised: 320, request: 280, suppNet: null, span: { from: 2023, to: 2024, years: 2 }, size: 320 });
    expect(rows[1]).toMatchObject({ span: { from: 2024, to: 2024, years: 1 } });
    expect(rows[2]).toMatchObject({ budget: null, request: 40, size: 40 }); // 大きさは、概算要求・政府案・補正後のうち最大
    expect(rows[3]).toMatchObject({ budget: null, revised: 900, size: 900 });
  });
  it('is empty for a year without 事項', () => {
    expect(jikouListRows(index, kouById, 2025)).toEqual([]);
  });
});

describe('filterJikouRows', () => {
  const rows = jikouListRows(index, kouById, 2024);
  const f = (p: Partial<typeof INITIAL_LIFECYCLE_FILTERS>) => filterJikouRows(rows, { ...INITIAL_LIFECYCLE_FILTERS, ...p }, 2024).map(r => r.name);
  it('uses the 項 filters (所管, 項名) and the 事項名 search', () => {
    expect(f({})).toHaveLength(4);
    expect(f({ groups: ['法務省'] })).toEqual(['研究費の調査', '補正で新しい']);
    expect(f({ name: '項A' })).toEqual(['研究費の推進', '施設費']);
    expect(f({ jikouName: '研究費' })).toEqual(['研究費の推進', '研究費の調査']);
    expect(f({ jikouName: '^研究費の(推進|調査)$', jikouNameRegex: true })).toEqual(['研究費の推進', '研究費の調査']);
  });
});

describe('主要経費別・使途別の絞り込み（事項）', () => {
  const rows = jikouListRows(index, kouById, 2024);
  const f = (o: Partial<typeof INITIAL_LIFECYCLE_FILTERS>, uses: ReadonlySet<string> | null = null) => filterJikouRows(rows, { ...INITIAL_LIFECYCLE_FILTERS, ...o }, 2024, uses).map(r => r.name);
  it('puts the 主要経費別 code of the 事項 in the row, and filters by it (a 事項 without the code is out)', () => {
    expect(rows.map(r => r.major)).toEqual(['12', '95', '', '']);
    expect(f({ majors: ['95'] })).toEqual(['施設費']);
    expect(f({ majors: ['12', '95'] })).toEqual(['研究費の推進', '施設費']);
    expect(f({ majors: ['__none__'] })).toEqual([]);
  });

  it('filters by the 使途別 through the 項 that have a 目 with it (the 事項 have no 使途別), and the two filters are ANDed', () => {
    expect(f({}, new Set([A.id]))).toEqual(['研究費の推進', '施設費']);
    expect(f({ majors: ['95'] }, new Set([A.id]))).toEqual(['施設費']);
    expect(f({}, new Set())).toEqual([]);
  });

  it('sorts by the code', () => {
    expect(sortJikouRows(rows, 'major', 1).map(r => r.name)).toEqual(['研究費の調査', '補正で新しい', '研究費の推進', '施設費']);
  });
});

describe('sortJikouRows', () => {
  const rows = jikouListRows(index, kouById, 2024);
  it('puts the 事項 without a value last in both directions (0 is a value), and sorts by size and by years', () => {
    expect(sortJikouRows(rows, 'budget', -1).map(r => r.name)).toEqual(['研究費の推進', '施設費', '研究費の調査', '補正で新しい']);
    expect(sortJikouRows(rows, 'budget', 1).map(r => r.name).slice(0, 2)).toEqual(['施設費', '研究費の推進']);
    expect(sortJikouRows(rows, 'size', -1).map(r => r.name)).toEqual(['補正で新しい', '研究費の推進', '施設費', '研究費の調査']);
    expect(sortJikouRows(rows, 'span', -1)[0]!.name).toBe('研究費の推進');
    const names = rows.map(r => r.name);
    expect(sortJikouRows(rows, 'name', 1).map(r => r.name)).toEqual([...names].sort((x, y) => x.localeCompare(y, 'ja')));
  });
});

describe('kouIdsWithJikou', () => {
  it('lists the 項 that have a 事項 of the year matching the search; null when the search is empty', () => {
    expect(kouIdsWithJikou(index, 2024, '', false)).toBeNull();
    expect(kouIdsWithJikou(index, 2024, '  ', false)).toBeNull();
    expect(kouIdsWithJikou(index, 2024, '施設', false)).toEqual(new Set(['2024:general:A']));
    expect(kouIdsWithJikou(index, 2024, '研究費', false)).toEqual(new Set(['2024:general:A', '2024:general:B']));
    expect(kouIdsWithJikou(index, 2024, '^研究費$', true)).toEqual(new Set()); // 2023 の事項は、2024 の項に数えない
    expect(kouIdsWithJikou(index, 2023, '^研究費$', true)).toEqual(new Set(['2023:general:A']));
  });
});
