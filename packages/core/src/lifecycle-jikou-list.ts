/**
 * 予算の一覧の「事項」タブ: 事項を行にした一覧のフィルタ・並べ替え（純粋な関数）。仕様: docs/guides/lifecycle-jikou.md
 *
 * 行 = 選んだ年度の事項 1 件。所管・会計・組織・項名は、その事項がある項（`LifecycleKou`）のもの。額は千円。年度をまたぐ流れは、確定した対応でたどる（`jikouChainNodes`）。
 */
import type { LifecycleKou } from './lifecycle.ts';
import { jikouChainNodes, type JikouIndex } from './lifecycle-jikou.ts';
import { filterLifecycleKous, lifecycleAcctOf, lifecycleGroupOf, lifecycleOrgOf, lifecyclePublisherOf, type LifecycleFilters, type LifecycleSortDir } from './lifecycle-list.ts';
import { textMatches } from './trend-view.ts';

export interface JikouListRow {
  /** 事項（`nodes` の添字） */
  node: number;
  /** その事項がある項 */
  k: LifecycleKou;
  name: string;
  /** 主要経費別の分類コード（無ければ空。名前は `codeNameOf`） */
  major: string;
  /** 千円。値が無いときは null（0 とは別） */
  request: number | null;
  budget: number | null;
  revised: number | null;
  suppNet: number | null;
  /** 確定した対応でたどれた年度の範囲と年数 */
  span: { from: number; to: number; years: number };
  /** 並べ替えの大きさ（千円）: 概算要求・政府案・補正後のうち最大（項の「最大額」と同じ考え方。補正後が歳出予算現額の代わり）。どれも無ければ 0 */
  size: number;
}

/** 選んだ年度の事項の行。項が見つからない事項は作らない（`kouById` に無い） */
export function jikouListRows(index: JikouIndex, kouById: ReadonlyMap<string, LifecycleKou>, year: number): JikouListRow[] {
  const { data } = index;
  const rows: JikouListRow[] = [];
  data.nodes.forEach((n, node) => {
    if (n[1] !== year) return;
    const k = kouById.get(data.kous[n[0]]!);
    if (!k) return;
    const chain = jikouChainNodes(index, node);
    const from = data.nodes[chain[0]!]![1], to = data.nodes[chain[chain.length - 1]!]![1];
    rows.push({ node, k, name: n[2], major: n[8], budget: n[3], revised: n[5], suppNet: n[6], request: n[7], span: { from, to, years: chain.length }, size: Math.max(0, n[7] ?? 0, n[3] ?? 0, n[5] ?? 0) });
  });
  return rows;
}

/**
 * 年度・所管・会計・組織／勘定・項名と、事項名・主要経費別で絞る（項の一覧と同じフィルタ。「値のある段階」と「年度をまたぐ対応」は項の絞り込みなので、ここでは使わない）。
 * 使途別は、事項に無いので、`usesKouSet`（使途別の絞り込みに合う目を持つ項。`kouIdsWithMoku`。絞り込みが無ければ null）に入る項の事項に絞る。
 */
export function filterJikouRows(rows: readonly JikouListRow[], f: LifecycleFilters, year: number, usesKouSet: ReadonlySet<string> | null = null): JikouListRow[] {
  return filterLifecycleKous(rows, f, year).filter(r =>
    textMatches(r.name, f.jikouName, f.jikouNameRegex)
    && (f.majors.length === 0 || f.majors.includes(r.major))
    && (usesKouSet === null || usesKouSet.has(r.k.id)));
}

export type JikouSortKey = 'publisher' | 'group' | 'acct' | 'org' | 'kou' | 'name' | 'major' | 'request' | 'budget' | 'revised' | 'suppNet' | 'span' | 'size';

/** 並べ替え。額の列は、値が無い事項を、向きによらず末尾に置く（0 とは別） */
export function sortJikouRows(rows: readonly JikouListRow[], key: JikouSortKey, dir: LifecycleSortDir): JikouListRow[] {
  const text = (r: JikouListRow): string => (key === 'publisher' ? lifecyclePublisherOf(r.k) : key === 'group' ? lifecycleGroupOf(r.k) : key === 'acct' ? lifecycleAcctOf(r.k) : key === 'org' ? lifecycleOrgOf(r.k) : key === 'kou' ? r.k.name : key === 'major' ? r.major : r.name);
  const tie = (x: JikouListRow, y: JikouListRow): number => x.k.id.localeCompare(y.k.id) || x.name.localeCompare(y.name, 'ja');
  return [...rows].sort((x, y) => {
    if (key === 'publisher' || key === 'group' || key === 'acct' || key === 'org' || key === 'kou' || key === 'name' || key === 'major') return dir * text(x).localeCompare(text(y), 'ja') || tie(x, y);
    if (key === 'span') return dir * (x.span.years - y.span.years) || tie(x, y);
    if (key === 'size') return dir * (x.size - y.size) || tie(x, y);
    const a = x[key], b = y[key];
    if (a === null || b === null) return a === b ? tie(x, y) : a === null ? 1 : -1;
    return dir * (a - b) || tie(x, y);
  });
}

/** 選んだ年度で、事項名が検索に合う事項を持つ項（`LifecycleKou.id`）。項の一覧の「事項名」の絞り込みに使う。検索が空なら null（絞り込まない） */
export function kouIdsWithJikou(index: JikouIndex, year: number, query: string, regex: boolean): Set<string> | null {
  if (query.trim() === '') return null;
  const ids = new Set<string>();
  for (const n of index.data.nodes) if (n[1] === year && textMatches(n[2], query, regex)) ids.add(index.data.kous[n[0]]!);
  return ids;
}
