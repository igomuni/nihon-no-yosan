/**
 * 年度をまたぐ事項の対応（`jikou-links`）。前の年度の事項と次の年度の事項を、根拠つきで結ぶ。仕様: docs/guides/mof-history.md（事項の年度をまたぐ対応）。
 * 純粋な関数。項の対応（`lifecycle-links.ts`）と同じ考え方で、会計（一般・特別）をまたぐ対応は探さない。事項の鍵は年度の中で一意（確かめ済み）。
 *
 * 1. 同じ鍵（`same_key`）の事項は結ぶ。鍵は、一般会計が 所管|組織|項コード|項名|事項名、特別会計が 特別会計|勘定|組織|項コード|項名|事項名（特別会計の所管は、目次の表記が年度で変わるので、鍵に入れない）。状態は `RESOLVED`。
 * 2. 同じ鍵の相手が無い事項について、相手の年度の同じ会計の全事項から候補を探す。根拠は次の 4 種類。
 *    - `same_name_other_item`: 同じ所属（一般は所管・組織、特別は特別会計・勘定・組織）で、事項名が同じで、項が違う。
 *    - `same_item_other_name`: 同じ所属・同じ項で、事項名が違う。その項の中で、前の側・次の側とも、同じ鍵の相手が無い事項が 1 つだけのときだけ。
 *    - `same_name_other_org`: 事項名が同じで、所属が違う。同じ鍵の相手が無い側については、同じ名前の事項がその側の残りに 1 つだけのときだけ。
 *    - `prev_amount_eq_revised` / `prev_amount_eq_budget`: 次の年度の前年度予算額（0 を除く）が、前の年度の改予算額 / 当初の額と一致する。
 *    名前だけの組は、両方とも同じ鍵の相手が無いときだけ候補にする。額の根拠がある組は、片方に同じ鍵の相手がいても候補にする。
 * 3. 状態: `RESOLVED` = 名前の根拠と額の根拠がそろい、前の側・次の側とも候補がこの 1 組だけ。ほかの候補は `AMBIGUOUS`。候補が無い事項は、相手の無い行を作り `UNRESOLVED`。額の確認（`amount`）は、同じ鍵の組で別に持ち、状態を変えない。
 */

export type JikouLinkStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';
export type JikouLinkEvidence = 'same_key' | 'same_name_other_item' | 'same_item_other_name' | 'same_name_other_org' | 'prev_amount_eq_revised' | 'prev_amount_eq_budget';
/** 次の年度の前年度予算額と、前の年度の額の突き合わせ。`eq_revised` 改予算額と一致、`eq_budget` 当初の額と一致、`ne` どちらとも違う、`zero` 前年度予算額が 0（比べない）、`n/a` どちらかに値が無い */
export type JikouLinkAmount = 'eq_revised' | 'eq_budget' | 'ne' | 'zero' | 'n/a';

/** 事項 1 件（1 年度の当初予算の 1 行）。額は千円 */
export interface JikouNode {
  year: number;
  account: 'general' | 'special';
  /** 所管（一般会計）。特別会計は空 */
  ministry: string;
  /** 特別会計・勘定（特別会計）。一般会計は空 */
  specialAccount: string;
  subAccount: string;
  /** 組織（一般会計。特別会計は復興特別会計だけ） */
  org: string;
  itemCode: string;
  itemName: string;
  name: string;
  /** その年度の当初の額（要求額・予定額） */
  budget: number | null;
  /** 予算書が載せる前年度予算額 */
  prev: number | null;
  /** その年度の補正後の額（補正の事項の CSV から。補正の無い事項・年度は undefined） */
  revised?: number | undefined;
}

export interface JikouLink {
  /** `nodes` の添字。相手の無い行は -1 */
  from: number;
  to: number;
  evidence: JikouLinkEvidence[];
  amount: JikouLinkAmount;
  status: JikouLinkStatus;
}

const itemOf = (n: JikouNode): string => `${n.itemCode}|${n.itemName}`;
const unitOf = (n: JikouNode): string => (n.account === 'general' ? `${n.ministry}|${n.org}` : `${n.specialAccount}|${n.subAccount}|${n.org}`);
export const jikouLinkKeyOf = (n: JikouNode): string => `${n.account}|${unitOf(n)}|${itemOf(n)}|${n.name}`;

function amountCheck(from: JikouNode, to: JikouNode): JikouLinkAmount {
  const prev = to.prev;
  if (prev === null) return 'n/a';
  if (prev === 0) return 'zero';
  if (from.revised === prev) return 'eq_revised';
  if (from.budget === prev) return 'eq_budget';
  if (from.revised === undefined && from.budget === null) return 'n/a';
  return 'ne';
}

export function buildJikouLinks(nodes: readonly JikouNode[], years: readonly number[]): JikouLink[] {
  const links: JikouLink[] = [];
  for (let n = 0; n + 1 < years.length; n++) {
    const y0 = years[n]!, y1 = years[n + 1]!;
    for (const account of ['general', 'special'] as const) {
      const idx = (y: number): number[] => nodes.flatMap((k, i) => (k.year === y && k.account === account ? [i] : []));
      const from = idx(y0), to = idx(y1);
      const toByKey = new Map(to.map(i => [jikouLinkKeyOf(nodes[i]!), i]));
      const matchedTo = new Set<number>();
      const rest0: number[] = [];
      for (const i of from) {
        const j = toByKey.get(jikouLinkKeyOf(nodes[i]!));
        if (j === undefined) { rest0.push(i); continue; }
        matchedTo.add(j);
        const amount = amountCheck(nodes[i]!, nodes[j]!);
        links.push({ from: i, to: j, evidence: ['same_key', ...(amount === 'eq_revised' ? ['prev_amount_eq_revised' as const] : amount === 'eq_budget' ? ['prev_amount_eq_budget' as const] : [])], amount, status: 'RESOLVED' });
      }
      const rest1 = to.filter(j => !matchedTo.has(j));
      const noPartner0 = new Set(rest0), noPartner1 = new Set(rest1);
      const tally = (xs: number[], f: (k: JikouNode) => string): Map<string, number> => { const m = new Map<string, number>(); for (const i of xs) m.set(f(nodes[i]!), (m.get(f(nodes[i]!)) ?? 0) + 1); return m; };
      const names0 = tally(rest0, k => k.name), names1 = tally(rest1, k => k.name);
      const items0 = tally(rest0, k => `${unitOf(k)}|${itemOf(k)}`), items1 = tally(rest1, k => `${unitOf(k)}|${itemOf(k)}`);

      const cand: JikouLink[] = [];
      for (const i of from) for (const j of to) {
        if (!noPartner0.has(i) && !noPartner1.has(j)) continue;
        const a = nodes[i]!, b = nodes[j]!;
        const evidence: JikouLinkEvidence[] = [];
        if (a.name === b.name) {
          if (unitOf(a) === unitOf(b)) { if (itemOf(a) !== itemOf(b)) evidence.push('same_name_other_item'); }
          else if ((!noPartner0.has(i) || names0.get(a.name) === 1) && (!noPartner1.has(j) || names1.get(b.name) === 1)) evidence.push('same_name_other_org');
        } else if (unitOf(a) === unitOf(b) && itemOf(a) === itemOf(b) && noPartner0.has(i) && noPartner1.has(j) && items0.get(`${unitOf(a)}|${itemOf(a)}`) === 1 && items1.get(`${unitOf(b)}|${itemOf(b)}`) === 1) {
          evidence.push('same_item_other_name');
        }
        const amount = amountCheck(a, b);
        if (amount === 'eq_revised') evidence.push('prev_amount_eq_revised');
        else if (amount === 'eq_budget') evidence.push('prev_amount_eq_budget');
        const bothFree = noPartner0.has(i) && noPartner1.has(j);
        if (evidence.length > 0 && (bothFree || amount === 'eq_revised' || amount === 'eq_budget')) cand.push({ from: i, to: j, evidence, amount, status: 'AMBIGUOUS' });
      }
      const countBy = (f: (l: JikouLink) => number): Map<number, number> => { const m = new Map<number, number>(); for (const l of cand) m.set(f(l), (m.get(f(l)) ?? 0) + 1); return m; };
      const nFrom = countBy(l => l.from), nTo = countBy(l => l.to);
      for (const l of cand) {
        const hasName = l.evidence.some(e => e === 'same_name_other_item' || e === 'same_item_other_name' || e === 'same_name_other_org');
        const hasAmount = l.evidence.some(e => e === 'prev_amount_eq_revised' || e === 'prev_amount_eq_budget');
        if (hasName && hasAmount && nFrom.get(l.from) === 1 && nTo.get(l.to) === 1) l.status = 'RESOLVED';
      }
      links.push(...cand);
      for (const i of rest0) if (!nFrom.has(i)) links.push({ from: i, to: -1, evidence: [], amount: 'n/a', status: 'UNRESOLVED' });
      for (const j of rest1) if (!nTo.has(j)) links.push({ from: -1, to: j, evidence: [], amount: 'n/a', status: 'UNRESOLVED' });
    }
  }
  return links;
}

/**
 * 項目（事項）が、確定した対応（`RESOLVED`）で何年続くか。各事項について、前の年度へ、確定した相手がちょうど 1 つの間さかのぼる（相手が無い・複数・確定でないところで止まる）。
 * 返り値は、`nodes` の添字ごとの「その年度を含めて、さかのぼれた年数」（最小 1）。
 */
export function jikouRunLengths(nodes: readonly JikouNode[], links: readonly JikouLink[]): number[] {
  const prev = new Map<number, number[]>();
  for (const l of links) if (l.status === 'RESOLVED' && l.from >= 0 && l.to >= 0) (prev.get(l.to) ?? prev.set(l.to, []).get(l.to)!).push(l.from);
  const memo = new Map<number, number>();
  const run = (i: number): number => {
    const m = memo.get(i);
    if (m !== undefined) return m;
    const ps = prev.get(i) ?? [];
    const r = ps.length === 1 ? 1 + run(ps[0]!) : 1;
    memo.set(i, r);
    return r;
  };
  return nodes.map((_, i) => run(i));
}
