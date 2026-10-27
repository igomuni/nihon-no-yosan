import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { lifecycleLinkGap, lifecycleNoDataNeighbor, lifecycleSourceOf, lifecycleSourcePresence } from './lifecycle-gap.ts';
import type { LifecycleLink } from './lifecycle-links.ts';

const kou = (year: number, name: string, o: Partial<LifecycleKou> = {}): LifecycleKou => ({ id: `${year}:${name}`, year, account: 'general', ministry: '厚生労働省', org: '本省', specialAccount: '', subAccount: '', code: '001', name, seenIn: ['budget'], ...o });
const link = (from: number, to: number, status: LifecycleLink['status']): LifecycleLink => ({ from, to, evidence: [], amount: 'n/a', status });
const years = [2025, 2026, 2027];
// FY2025・FY2026 に厚生労働省と労働保険特別会計の項、FY2027 には国土交通省の項だけ（厚生労働省の書が無い）
const kous = [
  kou(2025, 'A'), kou(2026, 'A'), kou(2026, 'B'), //  0, 1, 2
  kou(2025, 'S', { account: 'special', ministry: '厚生労働省', specialAccount: '労働保険' }), kou(2026, 'S', { account: 'special', ministry: '厚生労働省', specialAccount: '労働保険' }), //  3, 4
  kou(2027, 'X', { ministry: '国土交通省' }), //  5
  kou(2026, 'Y', { ministry: '国土交通省' }), //  6
];
const presence = lifecycleSourcePresence(kous);

describe('lifecycleNoDataNeighbor', () => {
  it('is true when the next (or previous) year is in the data but has no 項 of the same ministry (general) or special account', () => {
    expect(lifecycleNoDataNeighbor(presence, years, kous[1]!, 1)).toBe(true); // 厚生労働省: FY2027 に無い
    expect(lifecycleNoDataNeighbor(presence, years, kous[4]!, 1)).toBe(true); // 労働保険: FY2027 に無い
    expect(lifecycleNoDataNeighbor(presence, years, kous[6]!, 1)).toBe(false); // 国土交通省: FY2027 にある
    expect(lifecycleNoDataNeighbor(presence, years, kous[5]!, -1)).toBe(false); // 国土交通省: FY2026 にある
  });
  it('is false at the ends of the data (the neighbor year is not in the data)', () => {
    expect(lifecycleNoDataNeighbor(presence, years, kous[0]!, -1)).toBe(false); // FY2024 は、データの外
    expect(lifecycleNoDataNeighbor(presence, years, kous[5]!, 1)).toBe(false); // FY2028 は、データの外
  });
  it('tells the general account and a special account of the same ministry apart', () => {
    expect(lifecycleSourceOf(kous[0]!)).not.toBe(lifecycleSourceOf(kous[3]!));
  });
});

describe('lifecycleLinkGap', () => {
  const links = [link(1, -1, 'UNRESOLVED')];
  it('is true when every link of the 項 is a missing counterpart in a year that has no data for the ministry', () => {
    expect(lifecycleLinkGap(presence, years, kous, 1, links)).toBe(true);
  });
  it('is false for a missing counterpart in a year that has data for the ministry, and for resolved or ambiguous links', () => {
    expect(lifecycleLinkGap(presence, years, kous, 6, [link(6, -1, 'UNRESOLVED')])).toBe(false);
    expect(lifecycleLinkGap(presence, years, kous, 1, [link(0, 1, 'RESOLVED'), link(1, -1, 'UNRESOLVED')])).toBe(false);
    expect(lifecycleLinkGap(presence, years, kous, 1, [link(1, 5, 'AMBIGUOUS')])).toBe(false);
    expect(lifecycleLinkGap(presence, years, kous, 1, undefined)).toBe(false);
  });
});
