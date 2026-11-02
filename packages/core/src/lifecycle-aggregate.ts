import type { LifecycleValues } from './lifecycle-view.ts';
import { lifecycleRowAmounts } from './lifecycle-list.ts';
import { jikouChainNodes, type JikouIndex } from './lifecycle-jikou.ts';
import { mokuChartSum, mokuFlow, type MokuIndex, type MokuMeasure } from './lifecycle-moku.ts';
import { rsAmountShown, type RsIndex } from './rs.ts';

/**
 * 一覧全体の年度推移（中ペインの集計行を選んだとき、右ペインに出す）。
 * 一覧の各行（項・事項・目・事業）を、年度をまたぐ流れ（項・事項・目は確定した対応でたどったもの。RS は予算事業 ID）でたどり、年度ごとに足す。
 * 年度ごとの行の数が違うことがある（流れが途切れる行、後から現れる行）。年度の間の増減は、同じ行の増減とは限らない。
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

/** 年度ごとに足す（値のある行だけ。0 は値）。年度の昇順 */
export function sumByYear(entries: Iterable<AggEntry>): AggYear[] {
  const byYear = new Map<number, AggYear>();
  for (const e of entries) {
    const y = byYear.get(e.year) ?? byYear.set(e.year, { year: e.year, count: 0, values: {} }).get(e.year)!;
    y.count++;
    for (const m of AGG_MEASURES) { const v = e.values[m]; if (v !== null && v !== undefined) y.values[m] = (y.values[m] ?? 0) + v; }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/** 項の一覧: 各項の、確定した対応でたどった項（`chains`。項の添字の並び）の、年度ごとの額 */
export function aggregateKous(chains: readonly (readonly number[])[], kous: readonly { year: number }[], valuesOf: ReadonlyMap<number, LifecycleValues>): AggYear[] {
  const entries: AggEntry[] = [];
  for (const members of chains) {
    for (const i of members) {
      const v = valuesOf.get(i);
      const a = lifecycleRowAmounts(v ?? {});
      entries.push({ year: kous[i]!.year, values: { request: a.request, budget: a.budget, revised: a.revised, spent: a.spent, carriedIn: v?.carryover_in, carried: v?.carryover_out } });
    }
  }
  return sumByYear(entries);
}

/** 事項の一覧: 各事項を通る流れ（確定した対応。項が変わった年度も含む）の、年度ごとの額（千円 → 円。事項に決算・繰越額は無い）。同じ事項は 1 回だけ足す */
export function aggregateJikou(index: JikouIndex, nodes: readonly number[]): AggYear[] {
  const seen = new Set<number>();
  const entries: AggEntry[] = [];
  for (const root of nodes) {
    for (const m of jikouChainNodes(index, root)) {
      if (seen.has(m)) continue;
      seen.add(m);
      const n = index.data.nodes[m]!;
      const yen = (v: number | null): number | null => (v === null ? null : v * 1000);
      entries.push({ year: n[1], values: { request: yen(n[7]), budget: yen(n[3]), revised: yen(n[5]) } });
    }
  }
  return sumByYear(entries);
}

/**
 * 目の一覧: 各目の、項の確定した対応でたどった項の中で同じ目（`mokuFlow`）の、年度ごとの額（千円 → 円）。同じ目は 1 回だけ足す。
 * 額は、目の詳細・項の詳細の、選んだ目の合計と同じ足し方（`mokuChartSum`。選んだ目が、その年度の目のすべてとは限らないので、「すべて」としては扱わない）。
 */
export function aggregateMoku(index: MokuIndex, nodes: readonly number[], chainKouIdsOf: (kouId: string) => readonly string[]): AggYear[] {
  const byYear = new Map<number, Set<number>>();
  for (const root of nodes) {
    for (const f of mokuFlow(index, root, chainKouIdsOf(index.data.kous[index.data.nodes[root]![0]]!))) {
      if (f.node === null) continue;
      const year = index.data.nodes[f.node]![1];
      (byYear.get(year) ?? byYear.set(year, new Set()).get(year)!).add(f.node);
    }
  }
  const measures: AggMeasure[] = ['request', 'budget', 'revised', 'carriedIn', 'spent', 'carried'];
  const out: AggYear[] = [];
  for (const [year, set] of [...byYear].sort((a, b) => a[0] - b[0])) {
    const list = [...set];
    const values: Partial<Record<AggMeasure, number>> = {};
    for (const m of measures) { const s = mokuChartSum(index.data, list, m satisfies MokuMeasure, false); if (s !== null) values[m] = s * 1000; }
    out.push({ year, count: list.length, values });
  }
  return out;
}

/** RS の一覧: 各事業（`jigyo` の添字）の、予算・執行の年度ごとの額（円。事業単位の集計で、予算書の数値と一致しない）。当初予算 → budget、歳出予算現額 → revised、執行額 → spent */
export function aggregateRs(index: RsIndex, idxs: readonly number[]): AggYear[] {
  const entries: AggEntry[] = [];
  for (const idx of new Set(idxs)) {
    for (const row of index.amountsOf.get(idx) ?? []) {
      entries.push({ year: row[1], values: { budget: rsAmountShown(index, row, 'initial'), revised: rsAmountShown(index, row, 'current'), spent: rsAmountShown(index, row, 'spent'), carriedIn: rsAmountShown(index, row, 'carryIn'), carried: rsAmountShown(index, row, 'carryOut') } });
    }
  }
  return sumByYear(entries);
}
