/**
 * 予算の一覧の「事項」タブ: 事項を行にした一覧のフィルタ・並べ替え（純粋な関数）。仕様: docs/guides/lifecycle-jikou.md
 *
 * 行 = 選んだ年度の事項 1 件。所管・会計・組織・項名は、その事項がある項（`LifecycleKou`）のもの。額は千円。年度をまたぐ流れは、確定した対応でたどる（`jikouChainNodes`）。
 */
import type { LifecycleKou } from './lifecycle.ts';
import { jikouChainNodes, type JikouIndex } from './lifecycle-jikou.ts';
import { filterLifecycleKous, lifecycleAcctOf, lifecycleGroupOf, lifecycleOrgOf, type LifecycleFilters, type LifecycleSortDir } from './lifecycle-list.ts';
import { textMatches } from './trend-view.ts';

export interface JikouListRow {
  /** 事項（`nodes` の添字） */
  node: number;
  /** その事項がある項 */
  k: LifecycleKou;
  name: string;
  /** 千円。値が無いときは null（0 とは別） */
  request: number | null;
  budget: number | null;
  revised: number | null;
  suppNet: number | null;
  /** 確定した対応でたどれた年度の範囲と年数 */
  span: { from: number; to: number; years: number };
  /** 並べ替えの大きさ（千円）: 政府案、無ければ補正後、概算要求。どれも無ければ 0 */
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
    rows.push({ node, k, name: n[2], budget: n[3], revised: n[5], suppNet: n[6], request: n[7], span: { from, to, years: chain.length }, size: n[3] ?? n[5] ?? n[7] ?? 0 });
  });
  return rows;
}

/** 年度・所管・会計・組織／勘定・項名と、事項名で絞る（項の一覧と同じフィルタ。「値のある段階」と「年度をまたぐ対応」は項の絞り込みなので、ここでは使わない） */
export function filterJikouRows(rows: readonly JikouListRow[], f: LifecycleFilters, year: number): JikouListRow[] {
  return filterLifecycleKous(rows, f, year).filter(r => textMatches(r.name, f.jikouName, f.jikouNameRegex));
}

export type JikouSortKey = 'group' | 'acct' | 'org' | 'kou' | 'name' | 'request' | 'budget' | 'revised' | 'suppNet' | 'span' | 'size';

/** 並べ替え。額の列は、値が無い事項を、向きによらず末尾に置く（0 とは別） */
export function sortJikouRows(rows: readonly JikouListRow[], key: JikouSortKey, dir: LifecycleSortDir): JikouListRow[] {
  const text = (r: JikouListRow): string => (key === 'group' ? lifecycleGroupOf(r.k) : key === 'acct' ? lifecycleAcctOf(r.k) : key === 'org' ? lifecycleOrgOf(r.k) : key === 'kou' ? r.k.name : r.name);
  const tie = (x: JikouListRow, y: JikouListRow): number => x.k.id.localeCompare(y.k.id) || x.name.localeCompare(y.name, 'ja');
  return [...rows].sort((x, y) => {
    if (key === 'group' || key === 'acct' || key === 'org' || key === 'kou' || key === 'name') return dir * text(x).localeCompare(text(y), 'ja') || tie(x, y);
    if (key === 'span') return dir * (x.span.years - y.span.years) || tie(x, y);
    if (key === 'size') return dir * (x.size - y.size) || tie(x, y);
    const a = x[key], b = y[key];
    if (a === null || b === null) return a === b ? tie(x, y) : a === null ? 1 : -1;
    return dir * (a - b) || tie(x, y);
  });
}
