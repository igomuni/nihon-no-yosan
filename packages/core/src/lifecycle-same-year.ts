import { bigramDice } from './request-jikou-pairing.ts';
import { SIMILAR_NAME } from './lifecycle-links.ts';

/**
 * 年度内の突合: 同じ年度の、概算要求書にだけある項と、予算書にだけある項（概算要求書の項に突合できなかった項）を、同じ項として結ぶ。純粋な関数。仕様: docs/guides/budget-lifecycle.md（年度内の突合）。
 *
 * 突合（`match.ts`）は、概算要求書と予算書の項を名前で結ぶ。名前が少し違う項（「育児休業等給付費」と「育児休業給付費」）は、結べずに、要求の側と予算の側に 1 つずつ残る。
 * 次を **すべて** 満たす組を、同じ項とする。人手の表は使わない。
 *  - 同じ所属（一般会計は 所管|組織、特別会計は 特別会計|勘定）。
 *  - 概算要求書の前年度予算額と、予算書の前年度予算額が、0 でなく、同じ（どちらも千円）。同じ年度の前年度予算額が一致するのは、同じ項の前年度の額を、2 つの書がそれぞれ載せているため。
 *  - 項名の類似度（文字の 2 字組の Dice 係数）が `SIMILAR_NAME` 以上。
 *  - 1 対 1 に決まる（上の条件を満たす相手が、両側とも 1 つだけ）。
 */
export interface SameYearItem {
  /** 呼び出し側の識別 */
  id: string;
  /** 所属 */
  unit: string;
  name: string;
  /** 前年度予算額（千円）。無ければ null */
  prev: number | null;
}

/** 概算要求書の項の識別 → 予算書の項の識別 */
export function pairSameYear(requestOnly: readonly SameYearItem[], budgetOnly: readonly SameYearItem[]): Map<string, string> {
  const pairs: [string, string][] = [];
  for (const r of requestOnly) {
    if (r.prev === null || r.prev === 0) continue;
    for (const b of budgetOnly) {
      if (b.unit === r.unit && b.prev === r.prev && bigramDice(r.name, b.name) >= SIMILAR_NAME) pairs.push([r.id, b.id]);
    }
  }
  const count = (k: 0 | 1): Map<string, number> => { const m = new Map<string, number>(); for (const p of pairs) m.set(p[k], (m.get(p[k]) ?? 0) + 1); return m; };
  const nReq = count(0), nBudget = count(1);
  return new Map(pairs.filter(([r, b]) => nReq.get(r) === 1 && nBudget.get(b) === 1));
}
