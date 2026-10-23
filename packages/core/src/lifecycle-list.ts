import type { LifecycleKou } from './lifecycle.ts';
import type { LifecycleValues } from './lifecycle-view.ts';
import { lifecyclePatternMatches, type LifecyclePattern } from './lifecycle-status.ts';
import { textMatches } from './trend-view.ts';

/**
 * 予算の一生の一覧: フィルタ・列・並べ替え（純粋な関数）。
 * 所管と組織は一般会計だけの値（特別会計は、特別会計の名称と勘定で識別する）。特別会計の所管は、データに無いので持たせない（推測で府省を割り当てない）。
 */

export const LIFECYCLE_NO_GROUP = '（特別会計）';

export interface LifecycleFilters {
  /** 所管（空 = すべて）。選べるのは一般会計の所管と、特別会計をまとめた `LIFECYCLE_NO_GROUP` */
  groups: string[];
  /** 会計（空 = すべて）。「一般会計」と「〇〇特別会計」 */
  accts: string[];
  org: string;
  orgRegex: boolean;
  name: string;
  nameRegex: boolean;
  pattern: LifecyclePattern;
}

export const INITIAL_LIFECYCLE_FILTERS: LifecycleFilters = { groups: [], accts: [], org: '', orgRegex: false, name: '', nameRegex: false, pattern: 'all' };

export const lifecycleGroupOf = (k: LifecycleKou): string => (k.account === 'general' ? k.ministry : LIFECYCLE_NO_GROUP);
export const lifecycleAcctOf = (k: LifecycleKou): string => (k.account === 'general' ? '一般会計' : `${k.specialAccount}特別会計`);
/** 組織（一般会計）または勘定（特別会計） */
export const lifecycleOrgOf = (k: LifecycleKou): string => (k.account === 'general' ? k.org : k.subAccount);

/** 年度・所管・会計・組織／勘定・項名で絞る（値のある段階では絞らない。段階ごとの件数は、この結果で数える） */
export function filterLifecycleKous<T extends { k: LifecycleKou }>(items: readonly T[], f: LifecycleFilters, year: number): T[] {
  return items.filter(({ k }) =>
    k.year === year &&
    (f.groups.length === 0 || f.groups.includes(lifecycleGroupOf(k))) &&
    (f.accts.length === 0 || f.accts.includes(lifecycleAcctOf(k))) &&
    textMatches(lifecycleOrgOf(k), f.org, f.orgRegex) &&
    textMatches(k.name, f.name, f.nameRegex));
}

export const matchesLifecyclePattern = (k: LifecycleKou, f: LifecycleFilters): boolean => lifecyclePatternMatches(k, f.pattern);

export type LifecycleSortKey = 'group' | 'acct' | 'org' | 'name' | 'stages' | 'request' | 'budget' | 'revised' | 'spent' | 'size';
export type LifecycleSortDir = 1 | -1;

/** 一覧の行の額（円）。代表の額は、概算要求 = 要求額、政府案 = 政府案の額、補正 = 改予算額、決算 = 支出済額（画面の段階カードと同じ）。値が無いときは undefined */
export interface LifecycleRowAmounts { request: number | undefined; budget: number | undefined; revised: number | undefined; spent: number | undefined; size: number }
export function lifecycleRowAmounts(v: LifecycleValues): LifecycleRowAmounts {
  return { request: v.request_amount, budget: v.budget_amount, revised: v.revised_amount, spent: v.spent, size: Math.max(0, v.current_amount ?? 0, v.budget_amount ?? 0, v.request_amount ?? 0) };
}

/** 並べ替え。額の列は、値が無い項を、向きによらず末尾に置く（0 とは別） */
export function sortLifecycleRows<T extends { k: LifecycleKou; a: LifecycleRowAmounts }>(rows: readonly T[], key: LifecycleSortKey, dir: LifecycleSortDir): T[] {
  const text = (r: T): string => (key === 'group' ? lifecycleGroupOf(r.k) : key === 'acct' ? lifecycleAcctOf(r.k) : key === 'org' ? lifecycleOrgOf(r.k) : r.k.name);
  return [...rows].sort((x, y) => {
    if (key === 'group' || key === 'acct' || key === 'org' || key === 'name') return dir * text(x).localeCompare(text(y), 'ja') || x.k.id.localeCompare(y.k.id);
    if (key === 'stages') return dir * (x.k.seenIn.length - y.k.seenIn.length) || x.k.id.localeCompare(y.k.id);
    const a = x.a[key], b = y.a[key];
    if (a === undefined || b === undefined) return a === b ? x.k.id.localeCompare(y.k.id) : a === undefined ? 1 : -1;
    return dir * (a - b) || x.k.id.localeCompare(y.k.id);
  });
}
