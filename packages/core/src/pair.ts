/**
 * 概算要求側と予算書側の事項・目を、名前でつなぐ。仕様: docs/guides/keys-and-pairing.md
 */

/** 片側の 1 行。`name` は `nameKey` で揃えた名前、`code` は目のコード（`mofMokuCode` / `reqMokuCode`）。額は千円、空欄は null */
export interface Side {
  name: string;
  code?: string;
  amt: number | null;
}
/** つないだ行: [名前, コード, 要求額, 予算書の額]。無い側は null（その側に名前が無い）。ある側の空欄は 0 */
export type Pair = [name: string, code: string, req: number | null, mof: number | null];

const add = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : a + b);

/** 名前で集計する（同じ名前の行の額を足す。コードは最初の行のもの）。出現順を保つ */
function byName(rows: readonly Side[]): Map<string, { code: string; amt: number | null }> {
  const m = new Map<string, { code: string; amt: number | null }>();
  for (const r of rows) {
    const e = m.get(r.name);
    if (e) e.amt = add(e.amt, r.amt);
    else m.set(r.name, { code: r.code ?? '', amt: r.amt });
  }
  return m;
}

/**
 * 要求側と予算書側を名前でつなぐ。並びは予算書の順。要求にだけある行は、同じコードの予算書の行の最後の後ろに置き、
 * 同じコードが無ければ末尾に要求の順で置く（コードは分類で 1 つのコードに複数の行が入るので、名前の違う行を組にはしない）
 */
export function pairByName(req: readonly Side[], mof: readonly Side[]): Pair[] {
  const R = byName(req);
  const M = byName(mof);
  const out: Pair[] = [...M].map(([n, e]) => [n, e.code, R.has(n) ? (R.get(n)?.amt ?? 0) : null, e.amt ?? 0]);
  for (const [n, e] of R) {
    if (M.has(n)) continue;
    const row: Pair = [n, e.code, e.amt ?? 0, null];
    let at = -1;
    if (e.code) for (let i = 0; i < out.length; i++) if (out[i]?.[1] === e.code) at = i;
    if (at < 0) out.push(row);
    else out.splice(at + 1, 0, row);
  }
  return out;
}
