import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { lifecycleChains, lifecycleChainSpan } from './lifecycle-chain.ts';
import type { LifecycleLink } from './lifecycle-links.ts';

const kou = (year: number, name: string): LifecycleKou => ({ id: `${year}:${name}`, year, account: 'general', ministry: 'm', org: 'o', specialAccount: '', subAccount: '', code: '001', name, seenIn: ['budget'] });
const link = (from: number, to: number, status: LifecycleLink['status']): LifecycleLink => ({ from, to, evidence: ['same_key'], amount: 'n/a', status });
const years = [2020, 2021, 2022, 2023];

describe('lifecycleChains', () => {
  // 0: 2020, 1: 2021, 2: 2022, 3: 2023（A）。4: 2021（B。2022 とは未確定）、5: 2022（B'）
  const kous = [kou(2020, 'A'), kou(2021, 'A'), kou(2022, 'A'), kou(2023, 'A'), kou(2021, 'B'), kou(2022, 'B')];
  const links = [link(0, 1, 'RESOLVED'), link(1, 2, 'RESOLVED'), link(2, 3, 'RESOLVED'), link(4, 5, 'AMBIGUOUS'), link(-1, 4, 'UNRESOLVED')];
  const chainOf = lifecycleChains(kous, links, years);

  it('follows resolved links both ways, from any member, and returns the years oldest first', () => {
    for (const i of [0, 1, 2, 3]) expect(chainOf(i).members).toEqual([0, 1, 2, 3]);
    const c = chainOf(2);
    expect([c.before, c.after]).toEqual(['edge', 'edge']);
    expect(lifecycleChainSpan(kous, c)).toEqual({ from: 2020, to: 2023, years: 4 });
  });

  it('does not go through an ambiguous or missing counterpart, and says why it stopped', () => {
    expect(chainOf(4)).toEqual({ members: [4], before: 'none', after: 'ambiguous' });
    expect(chainOf(5)).toEqual({ members: [5], before: 'ambiguous', after: 'none' });
  });

  it('stops at a resolved counterpart that is not unique', () => {
    const k = [kou(2020, 'A'), kou(2021, 'A'), kou(2021, 'A2')];
    const c = lifecycleChains(k, [link(0, 1, 'RESOLVED'), link(0, 2, 'RESOLVED')], [2020, 2021])(0);
    expect(c).toEqual({ members: [0], before: 'edge', after: 'multiple' });
  });
});
