import type { LifecycleKou } from './lifecycle.ts';
import type { LifecycleLink } from './lifecycle-links.ts';

/**
 * 項の年度推移: 確定した（`RESOLVED`）対応を、前の年度・次の年度へたどって、同じ項と確認できた年度の並びを作る。純粋な関数。
 * 仕様: docs/guides/budget-lifecycle.md（年度推移）。確定した対応が 1 つだけのときだけ進む。名前が似ているだけの候補（`AMBIGUOUS`）・候補なし（`UNRESOLVED`）では進まない（補完しない）。
 */

/** たどれなくなった理由。`edge` = データの最初・最後の年度に着いた（その先の年度は、このデータに無い）、`none` = 相手の年度に候補が無い、`ambiguous` = 候補はあるが確定でない、`multiple` = 確定した相手が複数 */
export type LifecycleChainEnd = 'edge' | 'none' | 'ambiguous' | 'multiple';

export interface LifecycleChain {
  /** 同じ項と確認できた年度の項（`kous` の添字）。年度の古い順。選んだ項を含む */
  members: number[];
  /** 先頭の年度より前・末尾の年度より後を、たどれなくなった理由 */
  before: LifecycleChainEnd;
  after: LifecycleChainEnd;
}

interface Side { resolved: number[]; ambiguous: boolean }
const side = (m: Map<number, Side>, i: number): Side => m.get(i) ?? m.set(i, { resolved: [], ambiguous: false }).get(i)!;

/** 項ごとに、前の年度側・次の年度側の対応を集めておく（何度も `chainOf` を呼べるように） */
export function lifecycleChains(kous: readonly LifecycleKou[], links: readonly LifecycleLink[], years: readonly number[]): (index: number) => LifecycleChain {
  const prev = new Map<number, Side>(), next = new Map<number, Side>();
  for (const l of links) {
    if (l.from >= 0 && l.to >= 0) {
      if (l.status === 'RESOLVED') { side(next, l.from).resolved.push(l.to); side(prev, l.to).resolved.push(l.from); }
      else if (l.status === 'AMBIGUOUS') { side(next, l.from).ambiguous = true; side(prev, l.to).ambiguous = true; }
    }
  }
  const first = years[0], last = years[years.length - 1];
  const step = (m: Map<number, Side>, i: number, edgeYear: number | undefined): { to: number } | { end: LifecycleChainEnd } => {
    if (kous[i]!.year === edgeYear) return { end: 'edge' };
    const s = m.get(i);
    if (!s || (s.resolved.length === 0 && !s.ambiguous)) return { end: 'none' };
    if (s.resolved.length === 1) return { to: s.resolved[0]! };
    return { end: s.resolved.length > 1 ? 'multiple' : 'ambiguous' };
  };
  /** 前（または次）の年度へ、確定した相手がちょうど 1 つの間たどる。たどった添字（近い順）と、止まった理由 */
  const walk = (m: Map<number, Side>, from: number, edgeYear: number | undefined): { ids: number[]; end: LifecycleChainEnd } => {
    const ids: number[] = [];
    for (let i = from; ;) {
      const r = step(m, i, edgeYear);
      if ('end' in r) return { ids, end: r.end };
      ids.push(r.to);
      i = r.to;
    }
  };
  return index => {
    const back = walk(prev, index, first), fwd = walk(next, index, last);
    return { members: [...back.ids.reverse(), index, ...fwd.ids], before: back.end, after: fwd.end };
  };
}

/** 年度の範囲の表示（例: `2017–2026`）と、年数 */
export function lifecycleChainSpan(kous: readonly LifecycleKou[], chain: LifecycleChain): { from: number; to: number; years: number } {
  const from = kous[chain.members[0]!]!.year, to = kous[chain.members[chain.members.length - 1]!]!.year;
  return { from, to, years: chain.members.length };
}

export const LIFECYCLE_CHAIN_END_LABEL: Record<LifecycleChainEnd, string> = {
  edge: 'データの最初・最後の年度',
  none: '相手の年度に候補なし',
  ambiguous: '候補はあるが未確定',
  multiple: '確定した相手が複数',
};
