/**
 * 概算要求の事項と予算書の事項の、名前でのつながりの測定。純粋な関数。仕様: docs/guides/request-jikou-pairing.md
 *
 * 入力は、概算要求と当初予算の差の画面用データ（`mof/detail.json.gz`）。行のキー（`mofRowKey`: 年度|種類|会計|所管|府省|勘定|組織|名前）ごとに、事項が
 * [名前, コード, 要求額, 当初予算額] で入っている（片側に無ければ null）。名前でつなぐ処理は `pairByName`（mof-ui）がすでに行っているので、ここではその結果を数える。
 */
import type { BudgetRequestMofDetail } from './budget-request-mof.ts';
import type { BudgetRequestJikouData } from './budget-request-trend.ts';

/** 名前の近さ（文字の 2 字組の Dice 係数。0〜1） */
export function bigramDice(a: string, b: string): number {
  const grams = (s: string): Set<string> => { const g = new Set<string>(); for (let i = 0; i + 1 < s.length; i++) g.add(s.slice(i, i + 2)); return g; };
  const x = grams(a), y = grams(b);
  let n = 0;
  for (const t of x) if (y.has(t)) n++;
  return x.size + y.size === 0 ? 0 : (2 * n) / (x.size + y.size);
}

/** 名前が近い（同じ項の中で、片側にだけある事項どうし）とみなす係数 */
export const NEAR_NAME = 0.5;
/** 予算 ÷ 要求が、この範囲なら「近い額」とする */
export const NEAR_RATIO: readonly [number, number] = [0.5, 2];
/** この割合以内なら「同じ額」（改称の候補の額の確認） */
export const SAME_AMOUNT_RATE = 0.1;

export interface JikouPairingYear {
  year: number;
  /** 要求側の事項（要求額がある）、予算書側の事項（当初予算額がある）、両側にある事項 */
  request: number;
  budget: number;
  both: number;
  /** 要求のみの事項の内訳: 対応のある項の中 / 額0の項 / 概算要求のみの項。対応のある項の中のうち要求額が 0 */
  requestOnly: { matched: number; zeroKou: number; requestOnlyKou: number; matchedZero: number };
  /** 予算のみの事項の内訳: 対応のある項の中 / 予算書のみの項。対応のある項の中のうち当初予算額が 0 */
  budgetOnly: { matched: number; mofOnlyKou: number; matchedZero: number };
  /** 両側にある事項のうち、両方の額が正のもの: 件数、予算 ÷ 要求が `NEAR_RATIO` に入る数、中央値、極端（0.2 倍未満か 5 倍超）の数 */
  ratio: { n: number; near: number; median: number | null; extreme: number };
  /** 対応のある項の中で、片側にだけある事項。名前が近い組（`NEAR_NAME` 以上。係数の大きい順に 1 対 1）と、残り */
  leftover: { namePairs: number; samePairs: number; requestZeroPairs: number; unpairedRequest: number; unpairedRequestZero: number; unpairedBudget: number; unpairedBudgetZero: number };
  /** 事項要求の印のある項（`BudgetRequestJikouData` の `印`・`文`）との重なり。対応のある項の中の、予算のみ（額が正）と、要求のみで要求額 0 の事項 */
  marks: { budgetOnlyPositive: number; budgetOnlyInMarkedKou: number; requestZero: number; requestZeroInMarkedKou: number } | null;
}

/** `mofRowKey` から、事項要求のデータの行のキー（会計区分|所管|勘定|組織|項名）を作る */
export function jikouKeyOfMofRow(key: string): string {
  const p = key.split('|');
  return [p[2], p[3], p[5], p[6], p[7]].join('|');
}

const median = (xs: number[]): number | null => (xs.length === 0 ? null : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!);

export function requestJikouPairing(rows: Readonly<Record<string, BudgetRequestMofDetail>>, jikou?: BudgetRequestJikouData): JikouPairingYear[] {
  const years = [...new Set(Object.keys(rows).map(k => Number(k.split('|')[0])))].sort((a, b) => a - b);
  return years.map(year => {
    const out: JikouPairingYear = {
      year, request: 0, budget: 0, both: 0,
      requestOnly: { matched: 0, zeroKou: 0, requestOnlyKou: 0, matchedZero: 0 },
      budgetOnly: { matched: 0, mofOnlyKou: 0, matchedZero: 0 },
      ratio: { n: 0, near: 0, median: null, extreme: 0 },
      leftover: { namePairs: 0, samePairs: 0, requestZeroPairs: 0, unpairedRequest: 0, unpairedRequestZero: 0, unpairedBudget: 0, unpairedBudgetZero: 0 },
      marks: jikou ? { budgetOnlyPositive: 0, budgetOnlyInMarkedKou: 0, requestZero: 0, requestZeroInMarkedKou: 0 } : null,
    };
    const marked = new Set((jikou?.years[String(year)] ?? []).map(m => m[0]));
    const ratios: number[] = [];
    for (const [key, v] of Object.entries(rows)) {
      const [y, kind] = key.split('|');
      if (Number(y) !== year) continue;
      for (const [, , req, bud] of v.j) {
        if (req !== null) out.request++;
        if (bud !== null) out.budget++;
        if (req !== null && bud !== null) {
          out.both++;
          if (req > 0 && bud > 0) ratios.push(bud / req);
        } else if (req !== null) {
          if (kind === 'matched') { out.requestOnly.matched++; if (req === 0) out.requestOnly.matchedZero++; }
          else if (kind === 'zero') out.requestOnly.zeroKou++;
          else if (kind === 'reqOnly') out.requestOnly.requestOnlyKou++;
        } else if (bud !== null) {
          if (kind === 'matched') { out.budgetOnly.matched++; if (bud === 0) out.budgetOnly.matchedZero++; }
          else if (kind === 'mofOnly') out.budgetOnly.mofOnlyKou++;
        }
      }
      if (kind !== 'matched') continue;
      const ro = v.j.filter(r => r[2] !== null && r[3] === null);
      const bo = v.j.filter(r => r[2] === null && r[3] !== null);
      const isMarked = marked.has(jikouKeyOfMofRow(key));
      if (out.marks) {
        for (const r of bo) if (r[3]! > 0) { out.marks.budgetOnlyPositive++; if (isMarked) out.marks.budgetOnlyInMarkedKou++; }
        for (const r of ro) if (r[2] === 0) { out.marks.requestZero++; if (isMarked) out.marks.requestZeroInMarkedKou++; }
      }
      // 名前の近い組: 係数の大きい順に、1 対 1
      const cand: [number, number, number][] = [];
      ro.forEach((r, i) => bo.forEach((b, j) => { const s = bigramDice(r[0], b[0]); if (s >= NEAR_NAME) cand.push([s, i, j]); }));
      cand.sort((a, b) => b[0] - a[0]);
      const usedR = new Set<number>(), usedB = new Set<number>();
      for (const [, i, j] of cand) {
        if (usedR.has(i) || usedB.has(j)) continue;
        usedR.add(i); usedB.add(j);
        out.leftover.namePairs++;
        const q = ro[i]![2]!, b = bo[j]![3]!;
        if (q === 0) out.leftover.requestZeroPairs++;
        else if (Math.abs(b - q) <= SAME_AMOUNT_RATE * q) out.leftover.samePairs++;
      }
      ro.forEach((r, i) => { if (!usedR.has(i)) { out.leftover.unpairedRequest++; if (r[2] === 0) out.leftover.unpairedRequestZero++; } });
      bo.forEach((r, j) => { if (!usedB.has(j)) { out.leftover.unpairedBudget++; if (r[3] === 0) out.leftover.unpairedBudgetZero++; } });
    }
    out.ratio = {
      n: ratios.length,
      near: ratios.filter(r => r >= NEAR_RATIO[0] && r <= NEAR_RATIO[1]).length,
      median: median(ratios),
      extreme: ratios.filter(r => r < 0.2 || r > 5).length,
    };
    return out;
  });
}
