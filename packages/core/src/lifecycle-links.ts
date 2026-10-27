import type { LifecycleKou } from './lifecycle.ts';
import { bigramDice } from './request-jikou-pairing.ts';
import type { LifecycleValues } from './lifecycle-view.ts';

/**
 * 年度をまたぐ項の対応（`links`）。前の年度の項と次の年度の項を、根拠つきで結ぶ。仕様: docs/guides/budget-lifecycle.md（年度をまたぐ対応）。
 * 純粋な関数（入力は項と、項ごとの値）。会計（一般・特別）をまたぐ対応は探さない。
 *
 * 0. **所属の引き継ぎ**（前提）: 隣り合う年度で、前の年度で無くなった所属（一般会計は 所管|組織、特別会計は 特別会計|勘定）と、次の年度に新しくできた所属で、**次の年度の前年度予算額（予算書。無ければ概算要求書）の合計が、前の年度の補正後の額（無ければ政府案の額）の合計、または政府案の額の合計と、円まで一致し、0 でない**組を、引き継ぎとする。ただし、額が正の項が、前の側・次の側とも 2 つ以上あるときだけ（1 つの項どうしの額の一致は、項の額の一致と同じで、引き継ぎの根拠にならない）（例: FY2025 の子ども・子育て支援特別会計の子ども・子育て支援勘定は、FY2024 の年金特別会計の子ども・子育て支援勘定の引き継ぎ）。無くなった所属・新しくできた所属の組み合わせのうち、1 対 1 に決まるものだけ。引き継ぎの 2 つの所属は、以下の規則で、同じ所属（同じ所管）として扱う。人手の表は使わない。
 * 1. 同じ鍵（`same_key`）の項は結ぶ。鍵は、一般会計が 所管|組織|項コード|項名、特別会計が 特別会計|勘定|項コード|項名。引き継ぎの所属の間で、所属を読み替えた鍵が同じ項は、`same_key_succession`。
 * 2. 同じ鍵の相手が無い項（前の側・次の側）について、相手の年度の同じ会計の全項から候補を探す（同じ鍵の組どうしは探さない）。根拠は次の種類。
 *    名前だけの組は、両方とも同じ鍵の相手が無いときだけ候補にする。額の根拠がある組は、片方に同じ鍵の相手がいても候補にする。
 *    - `same_name_other_code`: 同じ所管・組織（特別会計は特別会計・勘定）で、項名が同じで、項コードが違う。
 *    - `same_name_other_org`: 項名が同じで、所管・組織（または特別会計・勘定）が違う。同じ鍵の相手が無い側については、同じ名前の項がその側の残りに 1 つだけのときだけ。
 *    - `prev_amount_eq_revised` / `prev_amount_eq_budget`: 次の年度の予算書の前年度予算額（0 を除く）が、前の年度の改予算額 / 政府案の額と一致する。
 *    - `same_code_other_name`: 同じ所管（特別会計は特別会計）で、項コードが同じで、項名が違う。**額の根拠がある組にだけ**付ける（項コードは、組替えで別の項に使い回されることがあるため、額と合わせて使う）。
 *    - `similar_name`: 同じ所管（特別会計は特別会計）で、項名が違うが近い（文字の 2 字組の類似度 `SIMILAR_NAME` 以上）。**額の根拠がある組にだけ**付ける。
 * 3. 状態: `RESOLVED` = 次のどれかで、前の側・次の側とも候補がこの 1 組だけ。
 *    (a) 名前の根拠（`same_name_other_*`、`same_code_other_name`、`similar_name`）と額の根拠がそろう。
 *    (b) 名前の根拠だけだが、**同じ組織で項名が同じ**（`same_name_other_code`）。同じ組織の中で、同じ名前の項は、項コードが変わっても同じ項とみなす。
 *    (c) 名前の根拠だけだが、**同じ所管で項名が同じ**（`same_name_other_org`。組織の再編）で、額が比べられる（どちらの年度にも値があり、前年度予算額が 0 でない。一致はしなくてよい。組替えで額が変わるため）。
 *    所管が違う名前だけの組、額だけの組、候補が複数の組は `AMBIGUOUS`。候補が無い項は、相手の無い行を作り `UNRESOLVED`。
 *    候補の数は、2 で探した組だけで数える。同じ鍵の組は `RESOLVED`（鍵はこのデータの項の識別）。額の確認（`amount`）は別に持ち、状態を変えない。
 */

export type LifecycleLinkStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';
export type LifecycleLinkEvidence = 'same_key' | 'same_key_succession' | 'same_name_other_code' | 'same_name_other_org' | 'prev_amount_eq_revised' | 'prev_amount_eq_budget' | 'same_code_other_name' | 'similar_name';
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
/** 所管（特別会計は特別会計名）。組織・勘定が変わっても、同じになる */
const groupOf = (k: LifecycleKou): string => (k.account === 'general' ? k.ministry : k.specialAccount);
/** 項名が違うが近いとみなす類似度（文字の 2 字組の Dice 係数） */
export const SIMILAR_NAME = 0.6;

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

/** 所属の引き継ぎ。新しい所属 → 前の年度の所属（所属の識別 `unitOf`）と、新しい所管 → 前の年度の所管（`groupOf`） */
interface Succession { units: Map<string, string>; groups: Map<string, string> }

function findSuccession(kous: readonly LifecycleKou[], values: readonly LifecycleValues[], from: readonly number[], to: readonly number[]): Succession {
  const byUnit = (idx: readonly number[]): Map<string, number[]> => { const m = new Map<string, number[]>(); for (const i of idx) { const u = unitOf(kous[i]!); (m.get(u) ?? m.set(u, []).get(u)!).push(i); } return m; };
  const A = byUnit(from), B = byUnit(to);
  const gone = [...A.keys()].filter(u => !B.has(u)), born = [...B.keys()].filter(u => !A.has(u));
  // 合計と、額が正の項の数。1 つの項どうしの額の一致は、項の額の一致（候補の根拠）と同じなので、引き継ぎの根拠にしない（2 つ以上の項の合計が千円まで一致するのは、偶然ではない）
  const sumOld = (u: string): { revised: number; budget: number; n: number } => { let revised = 0, budget = 0, n = 0; for (const i of A.get(u)!) { const v = values[i] ?? {}; const r = v.revised_amount ?? v.budget_amount ?? 0; revised += r; budget += v.budget_amount ?? 0; if (r > 0) n++; } return { revised, budget, n }; };
  const sumNew = (u: string): { prev: number; n: number } => { let prev = 0, n = 0; for (const i of B.get(u)!) { const v = values[i] ?? {}; const p = v.budget_prev ?? v.request_prev ?? 0; prev += p; if (p > 0) n++; } return { prev, n }; };
  const pairs: [string, string][] = [];
  for (const n of born) {
    const next = sumNew(n);
    if (next.prev === 0 || next.n < 2) continue;
    for (const o of gone) { const old = sumOld(o); if (old.n >= 2 && (old.revised === next.prev || old.budget === next.prev)) pairs.push([o, n]); }
  }
  const count = (k: number): Map<string, number> => { const m = new Map<string, number>(); for (const p of pairs) m.set(p[k]!, (m.get(p[k]!) ?? 0) + 1); return m; };
  const nOld = count(0), nNew = count(1);
  const succ: Succession = { units: new Map(), groups: new Map() };
  for (const [o, n] of pairs) {
    if (nOld.get(o) !== 1 || nNew.get(n) !== 1) continue; // 1 対 1 に決まるものだけ
    succ.units.set(n, o);
    succ.groups.set(groupOf(kous[B.get(n)![0]!]!), groupOf(kous[A.get(o)![0]!]!));
  }
  return succ;
}

export function buildLifecycleLinks(kous: readonly LifecycleKou[], values: readonly LifecycleValues[], years: readonly number[]): LifecycleLink[] {
  const links: LifecycleLink[] = [];
  for (let n = 0; n + 1 < years.length; n++) {
    const y0 = years[n]!, y1 = years[n + 1]!;
    for (const account of ['general', 'special'] as const) {
      const idx = (y: number): number[] => kous.flatMap((k, i) => (k.year === y && k.account === account ? [i] : []));
      const from = idx(y0), to = idx(y1);
      const succ = findSuccession(kous, values, from, to);
      // 引き継ぎの所属にある項は、所属を前の年度の所属に読み替える（概算要求のみの項は、鍵の形が違うので読み替えない）
      const moved = (k: LifecycleKou): boolean => !k.requestOnly && succ.units.has(unitOf(k));
      const unitTo = (k: LifecycleKou): string => succ.units.get(unitOf(k)) ?? unitOf(k);
      const groupTo = (k: LifecycleKou): string => succ.groups.get(groupOf(k)) ?? groupOf(k);
      const keyTo = (k: LifecycleKou): string => (moved(k) ? `${unitTo(k)}|${k.code}|${k.name}` : keyOf(k));
      const toByKey = new Map(to.map(i => [keyTo(kous[i]!), i]));
      const matchedTo = new Set<number>();
      const rest0: number[] = [];
      for (const i of from) {
        const j = toByKey.get(keyOf(kous[i]!));
        if (j === undefined) { rest0.push(i); continue; }
        matchedTo.add(j);
        const amount = amountCheck(values[i] ?? {}, values[j] ?? {});
        links.push({ from: i, to: j, evidence: [moved(kous[j]!) ? 'same_key_succession' : 'same_key', ...(amount === 'eq_revised' ? ['prev_amount_eq_revised' as const] : amount === 'eq_budget' ? ['prev_amount_eq_budget' as const] : [])], amount, status: 'RESOLVED' });
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
          if (unitOf(a) === unitTo(b)) evidence.push('same_name_other_code');
          else if ((!noPartner0.has(i) || names0.get(a.name) === 1) && (!noPartner1.has(j) || names1.get(b.name) === 1)) evidence.push('same_name_other_org');
        }
        const amount = amountCheck(values[i] ?? {}, values[j] ?? {});
        if (amount === 'eq_revised') evidence.push('prev_amount_eq_revised');
        else if (amount === 'eq_budget') evidence.push('prev_amount_eq_budget');
        // 項名が違うときの名前の根拠は、同じ所管で、額の根拠もあるときだけ（項コードの使い回し・似た名前の別の項を、額と合わせて確かめる）
        if ((amount === 'eq_revised' || amount === 'eq_budget') && a.name !== b.name && groupOf(a) === groupTo(b)) {
          if (a.code !== '' && a.code === b.code && !a.requestOnly && !b.requestOnly) evidence.push('same_code_other_name');
          else if (bigramDice(a.name, b.name) >= SIMILAR_NAME) evidence.push('similar_name');
        }
        // 名前だけの根拠は、両方とも同じ鍵の相手が無い項の間だけ（「予備費」「諸支出金」のような、どの会計にもある名前で、同じ鍵の相手がいる項に候補を作らない）。額の根拠がある組は、片方に同じ鍵の相手がいても候補にする
        const bothFree = noPartner0.has(i) && noPartner1.has(j);
        if (evidence.length > 0 && (bothFree || amount === 'eq_revised' || amount === 'eq_budget')) cand.push({ from: i, to: j, evidence, amount, status: 'AMBIGUOUS' });
      }
      const countBy = (f: (l: LifecycleLink) => number): Map<number, number> => { const m = new Map<number, number>(); for (const l of cand) m.set(f(l), (m.get(f(l)) ?? 0) + 1); return m; };
      const nFrom = countBy(l => l.from), nTo = countBy(l => l.to);
      for (const l of cand) {
        const hasName = l.evidence.some(e => e === 'same_name_other_code' || e === 'same_name_other_org' || e === 'same_code_other_name' || e === 'similar_name');
        const hasAmount = l.evidence.some(e => e === 'prev_amount_eq_revised' || e === 'prev_amount_eq_budget');
        // 名前の根拠だけで足りるのは、同じ組織で項名が同じとき、同じ所管で項名が同じで額が比べられるとき（組織の再編。額が比べられない組は、名前以外に確かめる材料が無い）
        const nameEnough = l.evidence.includes('same_name_other_code') || (l.evidence.includes('same_name_other_org') && l.amount === 'ne' && groupOf(kous[l.from]!) === groupTo(kous[l.to]!));
        if ((hasName && hasAmount || nameEnough) && nFrom.get(l.from) === 1 && nTo.get(l.to) === 1) l.status = 'RESOLVED';
      }
      links.push(...cand);
      for (const i of rest0) if (!nFrom.has(i)) links.push({ from: i, to: -1, evidence: [], amount: 'n/a', status: 'UNRESOLVED' });
      for (const j of rest1) if (!nTo.has(j)) links.push({ from: -1, to: j, evidence: [], amount: 'n/a', status: 'UNRESOLVED' });
    }
  }
  return links;
}
