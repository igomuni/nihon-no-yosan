/**
 * 年度をまたぐ対応で、「相手の年度に候補が無い」のか、「相手の年度に、その所管・会計の項が 1 つも無い」のかを分ける（純粋な関数）。
 * 後者は、所管・会計の新設・廃止（例: FY2021 のデジタル庁、FY2025 の子ども・子育て支援特別会計）か、その年度のデータにその書が入っていない（例: FY2027 の概算要求書に、厚生労働省・労働保険特別会計・年金特別会計の項が 0 件）かで、
 * 項が無くなった・新しくできたとは言えない。データがあるかを見る単位は、一般会計は所管、特別会計は特別会計名。
 */
import type { LifecycleKou } from './lifecycle.ts';
import type { LifecycleLink } from './lifecycle-links.ts';

export const lifecycleSourceOf = (k: LifecycleKou): string => (k.account === 'general' ? `一般|${k.ministry}` : `特別|${k.specialAccount}`);

/** `${年度}|${単位}` の集合: その年度に、その単位の項が 1 つでもある */
export function lifecycleSourcePresence(kous: readonly LifecycleKou[]): Set<string> {
  return new Set(kous.map(k => `${k.year}|${lifecycleSourceOf(k)}`));
}

/**
 * 項 `k` の隣の年度（`dir` = 1 は次の年度、-1 は前の年度）が、データの年度にあり、そこに、`k` と同じ単位の項が 1 つも無いか。
 * 隣の年度がデータの外（最初の年度の前、最後の年度の次）なら false（それは端）。
 */
export function lifecycleNoDataNeighbor(presence: ReadonlySet<string>, years: readonly number[], k: LifecycleKou, dir: 1 | -1): boolean {
  const y = k.year + dir;
  return years.includes(y) && !presence.has(`${y}|${lifecycleSourceOf(k)}`);
}

/** 項 `index` の対応が、すべて「候補なし」で、そのどれもが、隣の年度に同じ単位の項が 1 つも無いため（データなし）か。対応の行が無い項、確定・未確定の対応がある項は false */
export function lifecycleLinkGap(presence: ReadonlySet<string>, years: readonly number[], kous: readonly LifecycleKou[], index: number, links: readonly LifecycleLink[] | undefined): boolean {
  if (!links || links.length === 0) return false;
  const k = kous[index]!;
  return links.every(l => l.status === 'UNRESOLVED' && lifecycleNoDataNeighbor(presence, years, k, l.from === index ? 1 : -1));
}
