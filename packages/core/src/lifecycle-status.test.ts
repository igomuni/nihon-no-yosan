import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { LIFECYCLE_PATTERNS, lifecyclePatternCounts, lifecyclePatternMatches } from './lifecycle-status.ts';

const kou = (id: string, seenIn: LifecycleKou['seenIn'], o: Partial<LifecycleKou> = {}): LifecycleKou => ({
  id, year: 2024, account: 'general', ministry: '内閣府', org: '本府', specialAccount: '', subAccount: '', code: '001', name: id, seenIn, ...o,
});

// 内閣府: 4 段階そろう項、決算にだけある項、政府案はあるが概算要求に突合できなかった項。法務省は概算要求の項が 1 件も突合できていない
const full = kou('full', ['request', 'budget', 'supp', 'settle']);
const settleOnly = kou('settleOnly', ['settle']);
const noRequest = kou('noRequest', ['budget', 'supp', 'settle']);
const noSupp = kou('noSupp', ['request', 'budget', 'settle']);
const moj = kou('moj', ['budget', 'settle'], { ministry: '法務省' });
const mojOther = kou('mojOther', ['budget'], { ministry: '法務省' });
const all = [full, settleOnly, noRequest, noSupp, moj, mojOther];

describe('filters by the pattern of missing stages', () => {
  it('counts each pattern and keeps the 項 with a stage missing out of "all stages"', () => {
    const c = lifecyclePatternCounts(all);
    expect(c).toEqual({ all: 6, all_stages: 1, partial: 5, no_budget: 1, request_only: 0, settle_only: 1 });
    expect(lifecyclePatternMatches(noRequest, 'all_stages')).toBe(false);
    expect(lifecyclePatternMatches(noRequest, 'partial')).toBe(true);
    expect(all.filter(k => lifecyclePatternMatches(k, 'settle_only')).map(k => k.id)).toEqual(['settleOnly']);
    expect(LIFECYCLE_PATTERNS.every(p => p.id === 'all' || p.definition.length > 0)).toBe(true);
  });

  it('a 項 only in the request document matches request_only and no_budget', () => {
    const ro = kou('ro', ['request'], { requestOnly: 'reqOnly' });
    expect(lifecyclePatternMatches(ro, 'request_only')).toBe(true);
    expect(lifecyclePatternMatches(ro, 'no_budget')).toBe(true);
    expect(lifecyclePatternMatches(full, 'request_only')).toBe(false);
  });
});
