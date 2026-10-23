import type { LifecycleKou } from './lifecycle.ts';
import type { LifecycleValues } from './lifecycle-view.ts';

/**
 * 年度をまたぐ項の対応（`links`）。前の年度の項と次の年度の項を、根拠つきで結ぶ。仕様: docs/guides/budget-lifecycle.md（年度をまたぐ対応）。
 * 純粋な関数（入力は項と、項ごとの値）。会計（一般・特別）をまたぐ対応は探さない。
 *
 * 1. 同じ鍵（`same_key`）の項は結ぶ。鍵は、一般会計が 所管|組織|項コード|項名、特別会計が 特別会計|勘定|項コード|項名。
 * 2. 同じ鍵の相手が無い項（前の側・次の側）について、相手の年度の同じ会計の全項から候補を探す（同じ鍵の組どうしは探さない）。根拠は次の 3 種類。
 *    名前だけの組は、両方とも同じ鍵の相手が無いときだけ候補にする。額の根拠がある組は、片方に同じ鍵の相手がいても候補にする。
 *    - `same_name_other_code`: 同じ所管・組織（特別会計は特別会計・勘定）で、項名が同じで、項コードが違う。
 *    - `same_name_other_org`: 項名が同じで、所管・組織（または特別会計・勘定）が違う。同じ鍵の相手が無い側については、同じ名前の項がその側の残りに 1 つだけのときだけ。
 *    - `prev_amount_eq_revised` / `prev_amount_eq_budget`: 次の年度の予算書の前年度予算額（0 を除く）が、前の年度の改予算額 / 政府案の額と一致する。
 * 3. 状態: `RESOLVED` = 名前の根拠と額の根拠がそろい、前の側・次の側とも候補がこの 1 組だけ。候補がある他の組は `AMBIGUOUS`（根拠が 1 種類だけ、または候補が複数）。候補が無い項は、相手の無い行を作り `UNRESOLVED`。
 *    候補の数は、2 で探した組だけで数える。同じ鍵の組は `RESOLVED`（鍵はこのデータの項の識別）。額の確認（`amount`）は別に持ち、状態を変えない。
 */

export type LifecycleLinkStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';
export type LifecycleLinkEvidence = 'same_key' | 'same_name_other_code' | 'same_name_other_org' | 'prev_amount_eq_revised' | 'prev_amount_eq_budget';
/**
 * 次の年度の予算書の前年度予算額と、前の年度の額の突き合わせ。
 * `eq_revised` 前の年度の改予算額と一致、`eq_budget` 政府案の額と一致（補正が無い項）、`ne` どちらとも違う、`zero` 前年度予算額が 0（比べない）、`n/a` どちらかに値が無い
 */
export type LifecycleLinkAmount = 'eq_revised' | 'eq_budget' | 'ne' | 'zero' | 'n/a';

/** 1 行 = 前の年度の項（from）と次の年度の項（to）の組。相手の無い行は -1（`kous` の添字） */
export interface LifecycleLink {
  from: number;
  to: number;
  evidence: LifecycleLinkEvidence[];
  amount: LifecycleLinkAmount;
  status: LifecycleLinkStatus;
}

const keyOf = (k: LifecycleKou): string => k.id.slice(k.id.indexOf(':', k.id.indexOf(':') + 1) + 1);
const unitOf = (k: LifecycleKou): string => (k.account === 'general' ? `${k.ministry}|${k.org}` : `${k.specialAccount}|${k.subAccount}`);

/**
 * 次の年度の前年度予算額と、前の年度の額を比べる。予算書の前年度予算額（補正後の額が多い）を使い、無いとき（概算要求だけの項）は、概算要求書の前年度予算額（当初予算の額）を使う。
 * 概算要求書の前年度予算額は、前の年度の政府案の額とだけ比べる（補正後の額とは比べない）。
 */
function amountCheck(from: LifecycleValues, to: LifecycleValues): LifecycleLinkAmount {
  const fromRequest = to.budget_prev === undefined;
  const prev = to.budget_prev ?? to.request_prev;
  if (prev === undefined) return 'n/a';
  if (prev === 0) return 'zero';
  if (!fromRequest && from.revised_amount === prev) return 'eq_revised';
  if (from.budget_amount === prev) return 'eq_budget';
  if (from.revised_amount === undefined && from.budget_amount === undefined) return 'n/a';
  return 'ne';
}

export function buildLifecycleLinks(kous: readonly LifecycleKou[], values: readonly LifecycleValues[], years: readonly number[]): LifecycleLink[] {
  const links: LifecycleLink[] = [];
  for (let n = 0; n + 1 < years.length; n++) {
    const y0 = years[n]!, y1 = years[n + 1]!;
    for (const account of ['general', 'special'] as const) {
      const idx = (y: number): number[] => kous.flatMap((k, i) => (k.year === y && k.account === account ? [i] : []));
      const from = idx(y0), to = idx(y1);
      const toByKey = new Map(to.map(i => [keyOf(kous[i]!), i]));
      const matchedTo = new Set<number>();
      const rest0: number[] = [];
      for (const i of from) {
        const j = toByKey.get(keyOf(kous[i]!));
        if (j === undefined) { rest0.push(i); continue; }
        matchedTo.add(j);
        const amount = amountCheck(values[i] ?? {}, values[j] ?? {});
        links.push({ from: i, to: j, evidence: ['same_key', ...(amount === 'eq_revised' ? ['prev_amount_eq_revised' as const] : amount === 'eq_budget' ? ['prev_amount_eq_budget' as const] : [])], amount, status: 'RESOLVED' });
      }
      const rest1 = to.filter(j => !matchedTo.has(j));

      // 同じ鍵の相手が無い項の候補（相手側は、同じ鍵で結ばれた項も含む。例: 前の年度の項が、同じ鍵の項（決算だけにある項）と、移管先の項の両方に続く）
      const cand: LifecycleLink[] = [];
      const noPartner0 = new Set(rest0), noPartner1 = new Set(rest1);
      const tally = (xs: number[]): Map<string, number> => { const m = new Map<string, number>(); for (const i of xs) m.set(kous[i]!.name, (m.get(kous[i]!.name) ?? 0) + 1); return m; };
      const names0 = tally(rest0), names1 = tally(rest1);
      for (const i of from) for (const j of to) {
        if (!noPartner0.has(i) && !noPartner1.has(j)) continue;
        const a = kous[i]!, b = kous[j]!;
        const evidence: LifecycleLinkEvidence[] = [];
        // 所管・組織が違う名前だけの根拠は、同じ鍵の相手が無い側について、その名前の項が残りに 1 つだけのときだけ（「予備費」「諸支出金」のような、会計ごとにある名前は、組み合わせが増えるだけで根拠にならない）
        if (a.name === b.name) {
          if (unitOf(a) === unitOf(b)) evidence.push('same_name_other_code');
          else if ((!noPartner0.has(i) || names0.get(a.name) === 1) && (!noPartner1.has(j) || names1.get(b.name) === 1)) evidence.push('same_name_other_org');
        }
        const amount = amountCheck(values[i] ?? {}, values[j] ?? {});
        if (amount === 'eq_revised') evidence.push('prev_amount_eq_revised');
        else if (amount === 'eq_budget') evidence.push('prev_amount_eq_budget');
        // 名前だけの根拠は、両方とも同じ鍵の相手が無い項の間だけ（「予備費」「諸支出金」のような、どの会計にもある名前で、同じ鍵の相手がいる項に候補を作らない）。額の根拠がある組は、片方に同じ鍵の相手がいても候補にする
        const bothFree = noPartner0.has(i) && noPartner1.has(j);
        if (evidence.length > 0 && (bothFree || amount === 'eq_revised' || amount === 'eq_budget')) cand.push({ from: i, to: j, evidence, amount, status: 'AMBIGUOUS' });
      }
      const countBy = (f: (l: LifecycleLink) => number): Map<number, number> => { const m = new Map<number, number>(); for (const l of cand) m.set(f(l), (m.get(f(l)) ?? 0) + 1); return m; };
      const nFrom = countBy(l => l.from), nTo = countBy(l => l.to);
      for (const l of cand) {
        const hasName = l.evidence.some(e => e === 'same_name_other_code' || e === 'same_name_other_org');
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
