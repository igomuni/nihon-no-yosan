/**
 * 予算の一生の表の出来事（`events`）から、項目ごとの額を作る。純粋な関数。金額は円。段階の定義もここに置く。
 */
import type { LifecycleEventRow, LifecycleMeasure } from './lifecycle.ts';

/** 項目ごとの合計（円）。決算の共管で行が複数あるときは足す。無い項目は含まない */
export type LifecycleValues = Partial<Record<LifecycleMeasure, number>>;

export function lifecycleValues(events: readonly LifecycleEventRow[]): LifecycleValues {
  const v: LifecycleValues = {};
  for (const e of events) v[e[5]] = (v[e[5]] ?? 0) + e[8];
  return v;
}

/** 段階（概算要求・政府案・補正・決算）。画面は、この順・この位置で固定して見せる */
export type LifecycleStage = 'request' | 'budget' | 'supp' | 'settle';
export const LIFECYCLE_STAGES: readonly LifecycleStage[] = ['request', 'budget', 'supp', 'settle'];
export const LIFECYCLE_STAGE_LABEL: Record<LifecycleStage, string> = { request: '概算要求', budget: '政府案', supp: '補正', settle: '決算' };
