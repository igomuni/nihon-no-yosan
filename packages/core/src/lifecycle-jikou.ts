/**
 * 予算の一生の画面の「事項」タブ: 項の下の事項を、年度をまたぐ確定した対応（`jikou-links.ts`）でそろえて、年度の列に並べる。純粋な関数。
 * 仕様: docs/guides/lifecycle-jikou.md。画面用のデータ（`lifecycle/jikou.json.gz`）の型もここに置く。
 *
 * 事項の額は千円。概算要求（総表の要求額）、政府案（当初予算）、補正後、補正の差引額、予算書の前年度予算額がある。決算の事項は無い（決算は項と目だけ）。
 */
import type { JikouLinkAmount, JikouLinkEvidence } from './jikou-links.ts';

export const JIKOU_EVIDENCE: readonly JikouLinkEvidence[] = ['same_key', 'same_name_other_item', 'same_item_other_name', 'same_name_other_org', 'prev_amount_eq_revised', 'prev_amount_eq_budget', 'same_name_linked_kou'];
export const JIKOU_AMOUNT: readonly JikouLinkAmount[] = ['eq_revised', 'eq_budget', 'ne', 'zero', 'n/a'];

export const JIKOU_EVIDENCE_LABEL: Record<JikouLinkEvidence, string> = {
  same_key: '同じ鍵（項の識別と事項名が同じ）',
  same_name_other_item: '事項名が同じで、項が違う',
  same_item_other_name: '同じ項で、事項名が違う（その項の残りが 1 組だけ）',
  same_name_other_org: '事項名が同じで、所属が違う',
  prev_amount_eq_revised: '次の年度の前年度予算額 = 前の年度の改予算額',
  prev_amount_eq_budget: '次の年度の前年度予算額 = 前の年度の政府案の額',
  same_name_linked_kou: '事項名が同じで、項が確定した対応でつながる（概算要求にだけある項）',
};

/** 事項 1 件（1 年度）: [項の添字, 年度, 事項名, 政府案, 予算書の前年度予算額, 補正後, 補正の差引額, 概算要求の要求額]。額は千円で、値が無ければ null */
export type LifecycleJikouNode = [number, number, string, number | null, number | null, number | null, number | null, number | null];

/** 確定した年度をまたぐ対応: [前の年度の事項, 次の年度の事項, 根拠（`JIKOU_EVIDENCE` の添字を立てたビット）, 額の確認（`JIKOU_AMOUNT` の添字）] */
export type LifecycleJikouLink = [number, number, number, number];

export interface LifecycleJikouData {
  /** 事項がある年度 */
  years: number[];
  /** 項の id（`LifecycleKou.id`）。事項の第 1 要素が指す */
  kous: string[];
  nodes: LifecycleJikouNode[];
  links: LifecycleJikouLink[];
  /** 概算要求の事項を読めた項（`kous` の添字）。ここに無い項は、要求側の事項が読めていない（要求書に明細が無い、または明細の項につながらない）ので、「予算のみ」とは言えない */
  requestRead: number[];
}

export type JikouMeasure = 'request' | 'budget' | 'revised' | 'suppNet' | 'prev';
export const JIKOU_MEASURES: readonly { key: JikouMeasure; label: string; hint: string }[] = [
  { key: 'request', label: '概算要求', hint: '概算要求書（総表）の事項の要求額。予算書の事項と、同じ項の中で名前でつないだもの。要求側の事項が読めた項だけ' },
  { key: 'budget', label: '政府案', hint: '当初予算（国会への提出時の政府案）の額' },
  { key: 'revised', label: '補正後', hint: '改予算額。補正の事項の記録がある事項だけ（FY2024 まで）' },
  { key: 'suppNet', label: '補正の差引額', hint: '補正の差引額（追加額 + 修正減少額）。補正が複数回の年度は、その事項が載る最後の回の値' },
  { key: 'prev', label: '前年度予算額', hint: '予算書が載せる前年度予算額' },
];
const MEASURE_AT: Record<JikouMeasure, 3 | 4 | 5 | 6 | 7> = { budget: 3, prev: 4, revised: 5, suppNet: 6, request: 7 };

/** 事項の索引（データを読んだ後に 1 度だけ作る） */
export interface JikouIndex {
  data: LifecycleJikouData;
  /** 項の id → 項の添字 */
  kouOf: ReadonlyMap<string, number>;
  /** 項の添字 → その項の事項（`nodes` の添字） */
  nodesOf: ReadonlyMap<number, readonly number[]>;
  /** 概算要求の事項を読めた項（`kous` の添字） */
  requestRead: ReadonlySet<number>;
  /** 事項 → 前の年度へ入ってくる確定した対応（`links` の添字）。相手が 1 つに決まる事項だけ */
  inLink: ReadonlyMap<number, number>;
}

export function jikouIndex(data: LifecycleJikouData): JikouIndex {
  const kouOf = new Map(data.kous.map((id, i) => [id, i]));
  const nodesOf = new Map<number, number[]>();
  data.nodes.forEach((n, i) => (nodesOf.get(n[0]) ?? nodesOf.set(n[0], []).get(n[0])!).push(i));
  // 確定した対応は 1 対 1。念のため、同じ事項に 2 つ入る・2 つ出るときは、どちらの辺も使わない
  const into = new Map<number, number[]>(), out = new Map<number, number[]>();
  data.links.forEach((l, i) => {
    (into.get(l[1]) ?? into.set(l[1], []).get(l[1])!).push(i);
    (out.get(l[0]) ?? out.set(l[0], []).get(l[0])!).push(i);
  });
  const inLink = new Map<number, number>();
  data.links.forEach((l, i) => {
    if (into.get(l[1])!.length === 1 && out.get(l[0])!.length === 1) inLink.set(l[1], i);
  });
  return { data, kouOf, nodesOf, requestRead: new Set(data.requestRead), inLink };
}

export interface JikouCell {
  /** `nodes` の添字 */
  node: number;
  /** 前の年度から入ってくる対応（`links` の添字）。この行の最初の年度は undefined */
  link?: number;
}

export interface JikouRow {
  /** 年度 → セル。同じ年度に 2 つは無い */
  cells: ReadonlyMap<number, JikouCell>;
  /** 表の列（`years`）の最後の年度にある事項名。その年度に無ければ、あるうち最後の年度の事項名 */
  name: string;
  /** 行の中で事項名が変わっているか */
  renamed: boolean;
  firstYear: number;
  lastYear: number;
}

export interface JikouTable {
  /** 列にする年度（選んだ項の確定した年度の並び。事項のある年度だけ） */
  years: number[];
  rows: JikouRow[];
}

/**
 * 選んだ項の年度の並び（`kouIds`）にある事項を、確定した対応で結んで行にする。並び: 最後の年度の額（政府案、無ければ補正後、概算要求）の降順（その年度に無い行は、その後に最後にあった年度の新しい順）。
 * 対応は、並びの中の事項どうしだけで結ぶ（項をまたぐ対応は、行にしない）。
 */
export function jikouTable(index: JikouIndex, kouIds: readonly string[]): JikouTable {
  const { data } = index;
  const nodes: number[] = [];
  for (const id of kouIds) {
    const k = index.kouOf.get(id);
    if (k !== undefined) nodes.push(...(index.nodesOf.get(k) ?? []));
  }
  const inSet = new Set(nodes);
  // 前の年度へたどる（確定した対応が並びの中にあるものだけ）
  const prevOf = (n: number): { from: number; link: number } | undefined => {
    const li = index.inLink.get(n);
    if (li === undefined) return undefined;
    const from = data.links[li]![0];
    return inSet.has(from) ? { from, link: li } : undefined;
  };
  const hasNext = new Set<number>();
  for (const n of nodes) { const p = prevOf(n); if (p) hasNext.add(p.from); }
  const years = [...new Set(nodes.map(n => data.nodes[n]![1]))].sort((a, b) => a - b);
  const rows: JikouRow[] = [];
  // 行の最後（次の年度に続かない事項）から前へたどる
  for (const end of nodes) {
    if (hasNext.has(end)) continue;
    const cells = new Map<number, JikouCell>();
    for (let cur: number | undefined = end; cur !== undefined; ) {
      const p = prevOf(cur);
      cells.set(data.nodes[cur]![1], p ? { node: cur, link: p.link } : { node: cur });
      cur = p?.from;
    }
    const ys = [...cells.keys()].sort((a, b) => a - b);
    const names = ys.map(y => data.nodes[cells.get(y)!.node]![2]);
    rows.push({ cells, name: names[names.length - 1]!, renamed: new Set(names).size > 1, firstYear: ys[0]!, lastYear: ys[ys.length - 1]! });
  }
  const lastYear = years[years.length - 1];
  const onLast = (r: JikouRow): boolean => r.lastYear === lastYear;
  const amountAtLast = (r: JikouRow): number => (([, , , b, , rv, , q]) => b ?? rv ?? q ?? -Infinity)(data.nodes[r.cells.get(r.lastYear)!.node]!);
  rows.sort((a, b) => Number(onLast(b)) - Number(onLast(a)) || (onLast(a) ? amountAtLast(b) - amountAtLast(a) : b.lastYear - a.lastYear) || a.name.localeCompare(b.name, 'ja'));
  return { years, rows };
}

/** 当初予算に載っていない事項（補正で新しくできた事項） */
export const jikouSuppOnly = (n: LifecycleJikouNode): boolean => n[3] === null && n[5] !== null;
/** 予算書（当初・補正）に載っていない事項（概算要求書にだけある事項） */
export const jikouRequestOnly = (n: LifecycleJikouNode): boolean => n[3] === null && n[5] === null && n[7] !== null;
/** その値の合計に、事項の行として数えるか。政府案・前年度予算額は当初予算の事項、補正後・補正の差引額は当初予算か補正の事項、概算要求は要求額のある事項（予算のみの事項は、要求の行に数えない） */
const counts = (n: LifecycleJikouNode, measure: JikouMeasure): boolean => (measure === 'request' ? n[7] !== null : measure === 'budget' || measure === 'prev' ? n[3] !== null : n[3] !== null || n[5] !== null);

/** セルの額（千円）。事項の記録に値が無いときは null（0 ではない） */
export const jikouAmount = (index: JikouIndex, cell: JikouCell | undefined, measure: JikouMeasure): number | null => (cell ? index.data.nodes[cell.node]![MEASURE_AT[measure]] : null);

export interface JikouYearTotal {
  year: number;
  /** 事項の行の数 */
  rows: number;
  /** 値のある事項の数 */
  withValue: number;
  /** 値のある事項の合計（千円）。値のある事項が無ければ null */
  sum: number | null;
}

/** 年度ごとの合計。値の無い事項は足さない（`withValue` が `rows` より少ないときは、合計は事項の一部） */
export function jikouTotals(index: JikouIndex, table: JikouTable, measure: JikouMeasure): JikouYearTotal[] {
  return table.years.map(year => {
    let rows = 0, withValue = 0, sum = 0;
    for (const r of table.rows) {
      const c = r.cells.get(year);
      if (!c) continue;
      // 比べる項の額（予算書の目の合計、概算要求の総表）に入る事項だけを、行に数える
      if (!counts(index.data.nodes[c.node]!, measure)) continue;
      rows++;
      const v = jikouAmount(index, c, measure);
      if (v !== null) { withValue++; sum += v; }
    }
    return { year, rows, withValue, sum: withValue === 0 ? null : sum };
  });
}

/** 対応の根拠（ビット）を、根拠の並びに戻す */
export const jikouEvidenceOf = (mask: number): JikouLinkEvidence[] => JIKOU_EVIDENCE.filter((_, i) => (mask & (1 << i)) !== 0);
export const jikouEvidenceMask = (evidence: readonly JikouLinkEvidence[]): number => evidence.reduce((m, e) => m | (1 << JIKOU_EVIDENCE.indexOf(e)), 0);
