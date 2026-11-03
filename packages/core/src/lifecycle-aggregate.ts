/**
 * 一覧全体の年度推移（中ペインの集計行を選んだとき、右ペインに出す）。
 * 今の絞り込みを、年度ごとにそのまま掛けて、その年度の一覧の行を、集計行と同じ足し方（値のある行だけ。0 は値）で足す。年度を切り替えたときの、中ペインの集計行と一致する。
 * 行を年度をまたいでたどらない。年度の間の増減は、同じ行の増減とは限らない（改称・統合・所管や会計の移動で、行が出入りする）。
 * 額は円。値のある行が 1 つも無い段階は、その年度に値なし（0 とは別）。
 */
export const AGG_MEASURES = ['request', 'budget', 'revised', 'carriedIn', 'spent', 'carried'] as const;
export type AggMeasure = (typeof AGG_MEASURES)[number];
export interface AggYear {
  year: number;
  /** その年度に、流れが見つかった行の数 */
  count: number;
  values: Partial<Record<AggMeasure, number>>;
}
export interface AggEntry {
  year: number;
  values: Partial<Record<AggMeasure, number | null | undefined>>;
}

/** 年度ごとに足す（値のある行だけ。0 は値）。年度の昇順。`years` の年度は、行が 0 でも出す（その年度に、条件に合う行が無いことを示す） */
export function sumByYear(entries: Iterable<AggEntry>, years: readonly number[] = []): AggYear[] {
  const byYear = new Map<number, AggYear>(years.map(year => [year, { year, count: 0, values: {} }]));
  for (const e of entries) {
    const y = byYear.get(e.year) ?? byYear.set(e.year, { year: e.year, count: 0, values: {} }).get(e.year)!;
    y.count++;
    for (const m of AGG_MEASURES) { const v = e.values[m]; if (v !== null && v !== undefined) y.values[m] = (y.values[m] ?? 0) + v; }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/** 年度ごとに、その年度の一覧の行（`rowsOf`）を足す。`valuesOf` は、行の額（円）。一覧に出ない年度（行が 0）も、`years` にあれば 0 行で出す */
export function aggregateYears<T>(years: readonly number[], rowsOf: (year: number) => readonly T[], valuesOf: (row: T, year: number) => AggEntry['values']): AggYear[] {
  const entries: AggEntry[] = [];
  for (const year of years) for (const row of rowsOf(year)) entries.push({ year, values: valuesOf(row, year) });
  return sumByYear(entries, years);
}
