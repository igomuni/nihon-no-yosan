/**
 * 予算の一生の表の項の「値のある段階」（概算要求・政府案・補正・決算のどれに値があるか）による絞り込みと、所管の鍵。純粋な関数。
 * 判定は、現行データから確かめられることだけを使う。定義は docs/guides/lifecycle-status.md。
 */
import type { LifecycleKou } from './lifecycle.ts';
import { LIFECYCLE_STAGES, type LifecycleStage } from './lifecycle-view.ts';

export const scopeOf = (k: LifecycleKou): string => `${k.year}|${k.account}|${k.account === 'general' ? k.ministry : k.specialAccount}`;

/** 一覧の絞り込み（欠落パターン）。定義は `LIFECYCLE_PATTERNS` */
export type LifecyclePattern = 'all' | 'all_stages' | 'partial' | 'no_budget' | 'request_only' | 'settle_only';

export const LIFECYCLE_PATTERNS: { id: LifecyclePattern; label: string; definition: string }[] = [
  { id: 'all', label: 'すべて', definition: '' },
  { id: 'all_stages', label: '全段階に値あり', definition: '概算要求・政府案・補正・決算のすべてに、この項の値がある' },
  { id: 'partial', label: '一部の段階に値なし', definition: 'どれかの段階に、この項の値が無い（理由は問わない）' },
  { id: 'no_budget', label: '政府案の値なし', definition: '政府案に値が無い（補正・決算にだけある項、概算要求書にだけある項など）' },
  { id: 'request_only', label: '概算要求のみ', definition: '概算要求書にだけある項（予算書の項に結べていない。予算書が基準データに無い年度の項を含む）' },
  { id: 'settle_only', label: '決算の値のみ', definition: '決算にだけ値があり、概算要求・政府案・補正のどれにも値が無い' },
];

export function lifecyclePatternMatches(kou: LifecycleKou, p: LifecyclePattern): boolean {
  const has = (s: LifecycleStage) => kou.seenIn.includes(s);
  switch (p) {
    case 'all': return true;
    case 'all_stages': return LIFECYCLE_STAGES.every(has);
    case 'partial': return !LIFECYCLE_STAGES.every(has);
    case 'no_budget': return !has('budget');
    case 'request_only': return kou.requestOnly !== undefined;
    case 'settle_only': return has('settle') && !has('request') && !has('budget') && !has('supp');
  }
}

export function lifecyclePatternCounts(kous: readonly LifecycleKou[]): Record<LifecyclePattern, number> {
  const out = { all: 0, all_stages: 0, partial: 0, no_budget: 0, request_only: 0, settle_only: 0 } as Record<LifecyclePattern, number>;
  for (const k of kous) for (const p of LIFECYCLE_PATTERNS) if (lifecyclePatternMatches(k, p.id)) out[p.id]++;
  return out;
}
