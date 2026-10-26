import type { LifecycleKou } from './lifecycle.ts';
import type { LifecycleValues } from './lifecycle-view.ts';
import type { LifecycleLink, LifecycleLinkStatus } from './lifecycle-links.ts';
import { lifecyclePatternMatches, type LifecyclePattern } from './lifecycle-status.ts';
import { textMatches } from './trend-view.ts';

/**
 * 予算の一生の一覧: フィルタ・列・並べ替え（純粋な関数）。
 * 所管は予算書の原文。特別会計は複数の府省が所管することがあり、原文は「A、B及びC」の形（例: 内閣府、総務省及び財務省）。
 * 組織は一般会計だけの値（特別会計は、特別会計の名称と勘定で識別する）。
 */

/** 所管の原文を府省に分ける（区切りは「、」と「及び」。予算書の FY2023・FY2024 の特別会計で、分けた名前が一般会計の所管の名前と一致することを確かめた（例外は東日本大震災復興特別会計の「復興庁」だけ）） */
export const lifecycleGroupsOf = (k: LifecycleKou): string[] => k.ministry.split(/、|及び/).map(g => g.trim()).filter(g => g !== '');

/** 所管の選択肢「複数所管」: 複数の府省が所管する項 */
export const LIFECYCLE_JOINT = '複数所管';
export const lifecycleIsJoint = (k: LifecycleKou): boolean => lifecycleGroupsOf(k).length > 1;

export interface LifecycleFilters {
  /** 所管（空 = すべて）。選んだ府省が所管する項（複数の府省が所管する項も含む）。「複数所管」を選ぶと、複数の府省が所管する項 */
  groups: string[];
  /** 会計（空 = すべて）。「一般会計」と「〇〇特別会計」 */
  accts: string[];
  org: string;
  orgRegex: boolean;
  name: string;
  nameRegex: boolean;
  pattern: LifecyclePattern;
  /** 年度をまたぐ対応。`unsettled` = 対応が確定していない項（`lifecycleLinkState` が AMBIGUOUS または UNRESOLVED） */
  links: 'all' | 'unsettled';
}

export const INITIAL_LIFECYCLE_FILTERS: LifecycleFilters = { groups: [], accts: [], org: '', orgRegex: false, name: '', nameRegex: false, pattern: 'all', links: 'all' };

/** 所管の表示（一覧の列）。1 つの府省はその名前、複数は「N所管」（府省名の一覧は、ツールチップ・詳細に出す） */
export function lifecycleGroupOf(k: LifecycleKou): string {
  const g = lifecycleGroupsOf(k);
  return g.length <= 1 ? g[0] ?? '' : `${g.length}所管`;
}
export const lifecycleAcctOf = (k: LifecycleKou): string => (k.account === 'general' ? '一般会計' : `${k.specialAccount}特別会計`);
/** 組織（一般会計）または勘定（特別会計） */
export const lifecycleOrgOf = (k: LifecycleKou): string => (k.account === 'general' ? k.org : k.subAccount);

/** 年度・所管・会計・組織／勘定・項名で絞る（値のある段階では絞らない。段階ごとの件数は、この結果で数える） */
export function filterLifecycleKous<T extends { k: LifecycleKou }>(items: readonly T[], f: LifecycleFilters, year: number): T[] {
  return items.filter(({ k }) =>
    k.year === year &&
    (f.groups.length === 0 || lifecycleGroupsOf(k).some(g => f.groups.includes(g)) || (f.groups.includes(LIFECYCLE_JOINT) && lifecycleIsJoint(k))) &&
    (f.accts.length === 0 || f.accts.includes(lifecycleAcctOf(k))) &&
    textMatches(lifecycleOrgOf(k), f.org, f.orgRegex) &&
    textMatches(k.name, f.name, f.nameRegex));
}

export const matchesLifecyclePattern = (k: LifecycleKou, f: LifecycleFilters): boolean => lifecyclePatternMatches(k, f.pattern);

/** 項ごとの年度をまたぐ対応の行（添字 = `kous` の添字。前の年度の項としても、次の年度の項としても入れる） */
export function lifecycleLinksByKou(links: readonly LifecycleLink[]): Map<number, LifecycleLink[]> {
  const m = new Map<number, LifecycleLink[]>();
  for (const l of links) for (const i of [l.from, l.to]) if (i >= 0) (m.get(i) ?? m.set(i, []).get(i)!).push(l);
  return m;
}

/** 項の対応の状態。確定した対応（RESOLVED）が 1 つでもあれば RESOLVED、無ければ候補がある（AMBIGUOUS）か、候補なし（UNRESOLVED）。対応の行が無い項は null */
export function lifecycleLinkState(links: readonly LifecycleLink[] | undefined): LifecycleLinkStatus | null {
  if (!links || links.length === 0) return null;
  if (links.some(l => l.status === 'RESOLVED')) return 'RESOLVED';
  return links.some(l => l.status === 'AMBIGUOUS') ? 'AMBIGUOUS' : 'UNRESOLVED';
}

export const matchesLifecycleLinks = (state: LifecycleLinkStatus | null, f: LifecycleFilters): boolean => f.links === 'all' || (state !== null && state !== 'RESOLVED');

export type LifecycleSortKey = 'group' | 'acct' | 'org' | 'name' | 'jikou' | 'stages' | 'links' | 'span' | 'request' | 'budget' | 'revised' | 'spent' | 'size';
export type LifecycleSortDir = 1 | -1;

/** 一覧の行の額（円）。代表の額は、概算要求 = 要求額、政府案 = 政府案の額、補正 = 改予算額、決算 = 支出済額（画面の段階カードと同じ）。値が無いときは undefined */
export interface LifecycleRowAmounts { request: number | undefined; budget: number | undefined; revised: number | undefined; spent: number | undefined; size: number }
export function lifecycleRowAmounts(v: LifecycleValues): LifecycleRowAmounts {
  return { request: v.request_amount, budget: v.budget_amount, revised: v.revised_amount, spent: v.spent, size: Math.max(0, v.current_amount ?? 0, v.budget_amount ?? 0, v.request_amount ?? 0) };
}

/** 並べ替え。額の列は、値が無い項を、向きによらず末尾に置く（0 とは別） */
const LINK_RANK: Record<string, number> = { RESOLVED: 0, AMBIGUOUS: 1, UNRESOLVED: 2 };

/** `years` = 確定した対応でたどれた年数（`lifecycleChains`）、`jikou` = 項の下の事項の数（無い・読み込み前は null か undefined。向きによらず末尾） */
export function sortLifecycleRows<T extends { k: LifecycleKou; a: LifecycleRowAmounts; link?: LifecycleLinkStatus | null; years?: number; jikou?: { total: number } | null }>(rows: readonly T[], key: LifecycleSortKey, dir: LifecycleSortDir): T[] {
  const text = (r: T): string => (key === 'group' ? lifecycleGroupOf(r.k) : key === 'acct' ? lifecycleAcctOf(r.k) : key === 'org' ? lifecycleOrgOf(r.k) : r.k.name);
  return [...rows].sort((x, y) => {
    if (key === 'group' || key === 'acct' || key === 'org' || key === 'name') return dir * text(x).localeCompare(text(y), 'ja') || x.k.id.localeCompare(y.k.id);
    if (key === 'links') return dir * ((LINK_RANK[x.link ?? ''] ?? 3) - (LINK_RANK[y.link ?? ''] ?? 3)) || x.k.id.localeCompare(y.k.id);
    if (key === 'stages') return dir * (x.k.seenIn.length - y.k.seenIn.length) || x.k.id.localeCompare(y.k.id);
    if (key === 'span') return dir * ((x.years ?? 0) - (y.years ?? 0)) || x.k.id.localeCompare(y.k.id);
    if (key === 'jikou') {
      const a = x.jikou?.total, b = y.jikou?.total;
      if (a === undefined || b === undefined) return a === b ? x.k.id.localeCompare(y.k.id) : a === undefined ? 1 : -1;
      return dir * (a - b) || x.k.id.localeCompare(y.k.id);
    }
    const a = x.a[key as Exclude<LifecycleSortKey, 'group' | 'acct' | 'org' | 'name' | 'jikou' | 'stages' | 'links' | 'span'>], b = y.a[key as Exclude<LifecycleSortKey, 'group' | 'acct' | 'org' | 'name' | 'jikou' | 'stages' | 'links' | 'span'>];
    if (a === undefined || b === undefined) return a === b ? x.k.id.localeCompare(y.k.id) : a === undefined ? 1 : -1;
    return dir * (a - b) || x.k.id.localeCompare(y.k.id);
  });
}
