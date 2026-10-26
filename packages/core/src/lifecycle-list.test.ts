import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { INITIAL_LIFECYCLE_FILTERS, LIFECYCLE_JOINT, filterLifecycleKous, lifecycleGroupOf, lifecycleGroupsOf, lifecycleRowAmounts, sortLifecycleRows } from './lifecycle-list.ts';

const kou = (id: string, o: Partial<LifecycleKou> = {}): LifecycleKou => ({ id, year: 2024, account: 'general', ministry: '内閣府', org: '本府', specialAccount: '', subAccount: '', code: '001', name: id, seenIn: ['budget'], ...o });
const a = kou('a');
const b = kou('b', { ministry: '法務省', org: '法務本省' });
const s = kou('s', { account: 'special', ministry: '内閣府、総務省及び財務省', org: '', specialAccount: '年金', subAccount: '基礎年金勘定' });
const old = kou('old', { year: 2023 });
const items = [a, b, s, old].map(k => ({ k }));

describe('filterLifecycleKous', () => {
  const f = (p: Partial<typeof INITIAL_LIFECYCLE_FILTERS>) => filterLifecycleKous(items, { ...INITIAL_LIFECYCLE_FILTERS, ...p }, 2024).map(x => x.k.id);
  it('keeps only the year, and everything else when no filter is set', () => expect(f({})).toEqual(['a', 'b', 's']));
  it('filters by group; a special account with several ministries matches each of them', () => {
    expect(f({ groups: ['法務省'] })).toEqual(['b']);
    expect(f({ groups: ['総務省'] })).toEqual(['s']);
    expect(f({ groups: ['内閣府'] })).toEqual(['a', 's']);
    expect(f({ groups: [LIFECYCLE_JOINT] })).toEqual(['s']);
    expect(f({ groups: [LIFECYCLE_JOINT, '法務省'] })).toEqual(['b', 's']);
  });
  it('splits the original 所管 text at 、 and 及び, and shows N所管 for several', () => {
    expect(lifecycleGroupsOf(s)).toEqual(['内閣府', '総務省', '財務省']);
    expect(lifecycleGroupOf(s)).toBe('3所管');
    expect(lifecycleGroupsOf(kou('t', { ministry: '財務省及び国土交通省' }))).toEqual(['財務省', '国土交通省']);
    expect(lifecycleGroupOf(a)).toBe('内閣府');
  });
  it('filters by account label', () => {
    expect(f({ accts: ['年金特別会計'] })).toEqual(['s']);
    expect(f({ accts: ['一般会計'] })).toEqual(['a', 'b']);
  });
  it('filters by 組織／勘定 and 項名, with a regex option', () => {
    expect(f({ org: '基礎年金' })).toEqual(['s']);
    expect(f({ name: '^[ab]$', nameRegex: true })).toEqual(['a', 'b']);
    expect(f({ name: '[', nameRegex: true })).toEqual([]);
  });
});

describe('sortLifecycleRows', () => {
  const row = (id: string, v: Parameters<typeof lifecycleRowAmounts>[0]) => ({ k: kou(id), a: lifecycleRowAmounts(v) });
  const rows = [row('x', { budget_amount: 5 }), row('y', {}), row('z', { budget_amount: 0 }), row('w', { budget_amount: 9 })];
  it('puts rows without a value last in both directions, and treats 0 as a value', () => {
    expect(sortLifecycleRows(rows, 'budget', -1).map(r => r.k.id)).toEqual(['w', 'x', 'z', 'y']);
    expect(sortLifecycleRows(rows, 'budget', 1).map(r => r.k.id)).toEqual(['z', 'x', 'w', 'y']);
  });
  it('sorts by the number of years confirmed (years), the ones with a longer run first when descending', () => {
    const withYears = [{ ...row('a', {}), years: 3 }, { ...row('b', {}), years: 10 }, { ...row('c', {}), years: 1 }];
    expect(sortLifecycleRows(withYears, 'span', -1).map(r => r.k.id)).toEqual(['b', 'a', 'c']);
    expect(sortLifecycleRows(withYears, 'span', 1).map(r => r.k.id)).toEqual(['c', 'a', 'b']);
  });
  it('sorts by the number of 事項, with the ones that have none (or not loaded yet) last in both directions', () => {
    const withJikou = [{ ...row('a', {}), jikou: { total: 3 } }, { ...row('b', {}), jikou: null }, { ...row('c', {}), jikou: { total: 12 } }, { ...row('d', {}) }];
    expect(sortLifecycleRows(withJikou, 'jikou', -1).map(r => r.k.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(sortLifecycleRows(withJikou, 'jikou', 1).map(r => r.k.id)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('size is the largest of the current, budget and request amounts', () => {
    expect(lifecycleRowAmounts({ request_amount: 3, budget_amount: 5, current_amount: 4 }).size).toBe(5);
    expect(lifecycleRowAmounts({}).size).toBe(0);
  });
});
