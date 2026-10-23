/**
 * 予算の一生の表（項 × 出来事 × 項目）の型と項目の定義。仕様（案）: docs/guides/budget-lifecycle.md。
 * pipeline（`packages/pipeline/src/build/lifecycle.ts`）が作り、画面が読む。
 */

export type LifecycleEventType = 'request' | 'budget' | 'supp' | 'settle' | 'derived';
export type LifecycleState = 'original' | 'derived';

/** 項目の定義: 出来事、日本語の名前、原本の単位 */
export const LIFECYCLE_MEASURES = {
  request_amount: { event: 'request', label: '要求額', unit: '千円' },
  request_prev: { event: 'request', label: '前年度予算額（要求書）', unit: '千円' },
  budget_amount: { event: 'budget', label: '政府案の額', unit: '千円' },
  budget_prev: { event: 'budget', label: '前年度予算額（予算書）', unit: '千円' },
  enacted_amount: { event: 'supp', label: '成立予算額', unit: '千円' },
  supp_add: { event: 'supp', label: '補正の追加額', unit: '千円' },
  supp_reduce: { event: 'supp', label: '補正の修正減少額', unit: '千円' },
  supp_net: { event: 'supp', label: '補正の差引額', unit: '千円' },
  revised_amount: { event: 'supp', label: '改予算額（補正後）', unit: '千円' },
  appropriation: { event: 'settle', label: '歳出予算額', unit: '円' },
  carryover_in: { event: 'settle', label: '前年度繰越額', unit: '円' },
  reserve_use: { event: 'settle', label: '予備費使用額', unit: '円' },
  general_provision: { event: 'settle', label: '予算総則の規定による経費増額', unit: '円' },
  fungible: { event: 'settle', label: '流用等増△減額', unit: '円' },
  transfer: { event: 'settle', label: '予算決定後移替増△減額', unit: '円' },
  current_amount: { event: 'settle', label: '歳出予算現額', unit: '円' },
  spent: { event: 'settle', label: '支出済歳出額', unit: '円' },
  carryover_out: { event: 'settle', label: '翌年度繰越額', unit: '円' },
  unused: { event: 'settle', label: '不用額', unit: '円' },
  assessment_gap: { event: 'derived', label: '査定差（政府案 − 概算要求）', unit: '円' },
  settle_vs_revised: { event: 'derived', label: '決算の歳出予算額 − 改予算額', unit: '円' },
} as const;

export type LifecycleMeasure = keyof typeof LIFECYCLE_MEASURES;

/** 項の識別（1 年度・1 項） */
export interface LifecycleKou {
  id: string;
  year: number;
  account: 'general' | 'special';
  /** 一般会計の所管・組織。特別会計は空 */
  ministry: string;
  org: string;
  /** 特別会計の名称・勘定。一般会計は空 */
  specialAccount: string;
  subAccount: string;
  code: string;
  name: string;
  /** その項がある段階（`request` `budget` `supp` `settle`） */
  seenIn: LifecycleEventType[];
}

/**
 * 出来事の 1 行（値 1 つ）: [項の添字, 出来事, 版, 号, 組織（決算の共管）, 項目, 原本の値, 原本の単位, 円, 状態, 出典, 注]
 * 原本の値は文字列のまま。円は整数。
 */
export type LifecycleEventRow = [number, LifecycleEventType, string, string, string, LifecycleMeasure, string, string, number, LifecycleState, string, string];

/** 検算の結果（式ごと・年度ごと・会計ごと） */
export interface LifecycleCheck {
  year: number;
  account: 'general' | 'special';
  /** 式の名前 */
  name: string;
  ok: number;
  ng: number;
}

export interface LifecycleData {
  years: number[];
  kous: LifecycleKou[];
  events: LifecycleEventRow[];
  checks: LifecycleCheck[];
}
