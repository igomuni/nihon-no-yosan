import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { INITIAL_LIFECYCLE_FILTERS, LIFECYCLE_JOINT, filterLifecycleKous, lifecycleGroupOf, lifecyclePublisherOf, lifecycleGroupsOf, lifecycleRowAmounts, sortLifecycleRows, stepSelection } from './lifecycle-list.ts';

const kou = (id: string, o: Partial<LifecycleKou> = {}): LifecycleKou => ({ id, year: 2024, account: 'general', ministry: '内閣府', org: '本府', specialAccount: '', subAccount: '', code: '001', name: id, seenIn: ['budget'], ...o });
const a = kou('a');
const b = kou('b', { ministry: '法務省', org: '法務本省' });
const s = kou('s', { account: 'special', ministry: '内閣府、総務省及び財務省', org: '', specialAccount: '年金', subAccount: '基礎年金勘定' });
const old = kou('old', { year: 2023 });
const cfa = kou('cfa', { ministry: '内閣府', org: 'こども家庭庁' });
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
  it('counts an agency of the Cabinet Office (the 組織) as its own 所管, like the other screens; the Cabinet Office itself keeps its own', () => {
    expect(lifecycleGroupsOf(cfa)).toEqual(['こども家庭庁']);
    expect(lifecycleGroupOf(cfa)).toBe('こども家庭庁');
    expect(lifecycleGroupsOf(kou('h', { ministry: '内閣府', org: '内閣本府' }))).toEqual(['内閣府']);
    expect(lifecycleGroupsOf(kou('h2', { ministry: '法務省', org: 'こども家庭庁' }))).toEqual(['法務省']); // 内閣府以外の所管は、組織が同じ名前でも変えない
    const fc = filterLifecycleKous([a, cfa].map(k => ({ k })), { ...INITIAL_LIFECYCLE_FILTERS, groups: ['こども家庭庁'] }, 2024).map(x => x.k.id);
    expect(fc).toEqual(['cfa']);
    expect(filterLifecycleKous([a, cfa].map(k => ({ k })), { ...INITIAL_LIFECYCLE_FILTERS, groups: ['内閣府'] }, 2024).map(x => x.k.id)).toEqual(['a']);
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

describe('要求所管', () => {
  const k = (publishers?: string[]): LifecycleKou => kou('x', publishers ? { publishers } : {});
  it('shows one ministry by name, several as a count, none as empty', () => {
    expect([lifecyclePublisherOf(k(['消費者庁'])), lifecyclePublisherOf(k(['内閣府', '厚生労働省'])), lifecyclePublisherOf(k())]).toEqual(['消費者庁', '2所管', '']);
  });
  it('filters by any of the 要求所管, and drops the 項 with no 概算要求書', () => {
    const items = [k(['消費者庁']), k(['内閣府', '厚生労働省']), k()].map(x => ({ k: x }));
    const ids = (publishers: string[]): number => filterLifecycleKous(items, { ...INITIAL_LIFECYCLE_FILTERS, publishers }, 2024).length;
    expect([ids([]), ids(['厚生労働省']), ids(['消費者庁', '内閣府']), ids(['財務省']), ids(['複数所管'])]).toEqual([3, 1, 2, 0, 1]);
  });
});

describe('stepSelection', () => {
  it('moves to the next or previous row, and stops at the ends (no wrap-around)', () => {
    expect(stepSelection(5, 2, 1)).toBe(3);
    expect(stepSelection(5, 2, -1)).toBe(1);
    expect(stepSelection(5, 4, 1)).toBe(4);
    expect(stepSelection(5, 0, -1)).toBe(0);
  });

  it('selects the first row when nothing is selected, and returns null for an empty list', () => {
    expect(stepSelection(5, -1, 1)).toBe(0);
    expect(stepSelection(5, -1, -1)).toBe(0);
    expect(stepSelection(0, -1, 1)).toBeNull();
  });
});
