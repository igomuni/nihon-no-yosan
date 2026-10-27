/**
 * 予算の推移の「目」タブ: 項の下の目を、政府案（当初予算）・補正・決算・概算要求の値で並べる。純粋な関数。
 * 仕様: docs/guides/lifecycle-moku.md。画面用のデータ（`lifecycle/moku.json.gz`）の型もここに置く。
 *
 * 額は千円（決算は原本が円なので、千円に直す。小数になりうる）。値が無いところは null（0 とは別）。
 * 目は、項 + 目名 + 分類コードで識別する。補正の「外N目」の集約行と、目名が空の行（項の行）は、目にしない（その目の補正は「値なし」）。
 * 決算で、同じ識別の行が共管の組織ごとに複数あるときは、共管別の行（`part`）に分ける。
 */
import type { LifecycleKou } from './lifecycle.ts';
import { filterLifecycleKous, lifecycleAcctOf, lifecycleGroupOf, lifecycleOrgOf, lifecyclePublisherOf, type LifecycleFilters, type LifecycleSortDir } from './lifecycle-list.ts';
import { textMatches } from './trend-view.ts';

/** 状態のビット */
export const MOKU_FLAG = {
  /** 補正に、この目の個別の行がある */
  suppItem: 1,
  /** その項の補正に「外N目」の集約行があり、この目は個別の行が無い（変更の無い目として、まとめられている） */
  suppAggregated: 2,
  /** その項の補正は、目名が空の行（項の行）だけで、目の内訳が無い */
  suppKouOnly: 4,
  /** 決算で、同じ識別の行が共管の組織ごとに複数あり、共管別の行に分けた（この行の決算は値なし） */
  settleSplit: 8,
  /** 決算の共管別の行（`part` が共管所管名|共管組織名） */
  settlePart: 16,
  /** 概算要求書にだけある目（予算書の目に、名前で結べなかった） */
  requestOnly: 32,
  /** 分類コードが違い、目名だけで結んだ（その項で、その目名の目が 1 つだけのとき） */
  nameOnly: 64,
} as const;

/**
 * 目 1 件（1 年度）: [項の添字, 年度, 目名, 分類コード（`|` でつなぐ。概算要求にだけある目は空）, 共管（決算の共管別の行だけ。それ以外は空）,
 * 政府案, 補正後, 補正の差引額, 歳出予算現額, 支出済歳出額, 翌年度繰越額, 不用額, 概算要求, 状態のビット（`MOKU_FLAG`）]
 */
export type LifecycleMokuNode = [number, number, string, string, string, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number];

/** 概算要求の目の取れ方（項ごと）。`full` = 全部の目で、要求と予算書の両方がある。`partial` = 片方にしか無い目がある。`none` = 要求側の目が 1 つも無い。`noReq` = 要求書に明細が無い・つながらない */
export type MokuRequestCoverage = 'full' | 'partial' | 'none' | 'noReq';
export const MOKU_REQUEST_COVERAGE_LABEL: Record<MokuRequestCoverage, string> = {
  full: '全部の目で、概算要求と予算書の両方がある',
  partial: '概算要求か予算書の片方にしか無い目がある',
  none: '概算要求の目が 1 つも無い',
  noReq: '概算要求書の明細が読めていない（明細が無い、または明細の項につながらない）',
};

export interface LifecycleMokuData {
  /** 目がある年度 */
  years: number[];
  /** 補正の書を読んだ年度・決算の書を読んだ年度・概算要求の目を読んだ年度（この外の年度の「値なし」は、書が無いため） */
  suppYears: number[];
  settleYears: number[];
  requestYears: number[];
  /** 項の id（`LifecycleKou.id`）。目の第 1 要素が指す */
  kous: string[];
  nodes: LifecycleMokuNode[];
  /** [項の添字, 概算要求の目の取れ方]。概算要求書の項と突合できた予算書の項だけ */
  requestCoverage: [number, MokuRequestCoverage][];
}

/** 目の識別（項の id を除く）。同じ項・年度の中で一意 */
export const mokuKeyOf = (n: LifecycleMokuNode): string => `${n[2]}|${n[3]}|${n[4]}`;

export interface MokuIndex {
  data: LifecycleMokuData;
  /** 項の id → 項の添字 */
  kouOf: ReadonlyMap<string, number>;
  /** 項の添字 → その項の目（`nodes` の添字） */
  nodesOf: ReadonlyMap<number, readonly number[]>;
  /** `${項の id}|${目の識別}` → 目（`nodes` の添字） */
  nodeByKey: ReadonlyMap<string, number>;
  /** 項の id → 概算要求の目の取れ方 */
  coverageOf: ReadonlyMap<string, MokuRequestCoverage>;
}

export function mokuIndex(data: LifecycleMokuData): MokuIndex {
  const kouOf = new Map(data.kous.map((id, i) => [id, i]));
  const nodesOf = new Map<number, number[]>();
  data.nodes.forEach((n, i) => (nodesOf.get(n[0]) ?? nodesOf.set(n[0], []).get(n[0])!).push(i));
  const nodeByKey = new Map(data.nodes.map((n, i) => [`${data.kous[n[0]]}|${mokuKeyOf(n)}`, i]));
  const coverageOf = new Map(data.requestCoverage.map(([k, c]) => [data.kous[k]!, c]));
  return { data, kouOf, nodesOf, nodeByKey, coverageOf };
}

/** 目の選択を持つ鍵（データを作り直すと添字が変わるため） */
export const mokuSelectionKey = (index: MokuIndex, node: number): string => { const n = index.data.nodes[node]!; return `${index.data.kous[n[0]]}|${mokuKeyOf(n)}`; };

export interface MokuListRow {
  /** 目（`nodes` の添字） */
  node: number;
  /** その目がある項 */
  k: LifecycleKou;
  name: string;
  /** 共管別の行の共管（共管所管名|共管組織名）。それ以外は空 */
  part: string;
  /** 千円。値が無いときは null（0 とは別） */
  request: number | null;
  budget: number | null;
  revised: number | null;
  suppNet: number | null;
  current: number | null;
  spent: number | null;
  unused: number | null;
  flags: number;
  /** 並べ替えの大きさ（千円）: 概算要求・政府案・補正後・歳出予算現額のうち最大。どれも無ければ 0 */
  size: number;
}

/** 選んだ年度の目の行。項が見つからない目は作らない */
export function mokuListRows(index: MokuIndex, kouById: ReadonlyMap<string, LifecycleKou>, year: number): MokuListRow[] {
  const { data } = index;
  const rows: MokuListRow[] = [];
  data.nodes.forEach((n, node) => {
    if (n[1] !== year) return;
    const k = kouById.get(data.kous[n[0]]!);
    if (!k) return;
    rows.push({ node, k, name: n[2], part: n[4], budget: n[5], revised: n[6], suppNet: n[7], current: n[8], spent: n[9], unused: n[11], request: n[12], flags: n[13], size: Math.max(0, n[12] ?? 0, n[5] ?? 0, n[6] ?? 0, n[8] ?? 0) });
  });
  return rows;
}

/** 年度・所管・会計・組織／勘定・項名と、目名で絞る（項の一覧と同じフィルタ。「値のある段階」「年度をまたぐ対応」「事項名」は使わない） */
export function filterMokuRows(rows: readonly MokuListRow[], f: LifecycleFilters, year: number): MokuListRow[] {
  return filterLifecycleKous(rows, f, year).filter(r => textMatches(r.name, f.mokuName, f.mokuNameRegex));
}

export type MokuSortKey = 'publisher' | 'group' | 'acct' | 'org' | 'kou' | 'name' | 'request' | 'budget' | 'revised' | 'current' | 'spent' | 'unused' | 'size';
export const MOKU_TEXT_SORT_KEYS: readonly MokuSortKey[] = ['publisher', 'group', 'acct', 'org', 'kou', 'name'];

/** 並べ替え。額の列は、値が無い目を、向きによらず末尾に置く（0 とは別） */
export function sortMokuRows(rows: readonly MokuListRow[], key: MokuSortKey, dir: LifecycleSortDir): MokuListRow[] {
  const text = (r: MokuListRow): string => (key === 'publisher' ? lifecyclePublisherOf(r.k) : key === 'group' ? lifecycleGroupOf(r.k) : key === 'acct' ? lifecycleAcctOf(r.k) : key === 'org' ? lifecycleOrgOf(r.k) : key === 'kou' ? r.k.name : r.name);
  const tie = (x: MokuListRow, y: MokuListRow): number => x.k.id.localeCompare(y.k.id) || x.name.localeCompare(y.name, 'ja') || x.part.localeCompare(y.part, 'ja') || x.node - y.node;
  return [...rows].sort((x, y) => {
    if (MOKU_TEXT_SORT_KEYS.includes(key)) return dir * text(x).localeCompare(text(y), 'ja') || tie(x, y);
    if (key === 'size') return dir * (x.size - y.size) || tie(x, y);
    const a = x[key as Exclude<MokuSortKey, 'publisher' | 'group' | 'acct' | 'org' | 'kou' | 'name' | 'size'>], b = y[key as Exclude<MokuSortKey, 'publisher' | 'group' | 'acct' | 'org' | 'kou' | 'name' | 'size'>];
    if (a === null || b === null) return a === b ? tie(x, y) : a === null ? 1 : -1;
    return dir * (a - b) || tie(x, y);
  });
}

/** 選んだ年度で、目名が検索に合う目を持つ項（`LifecycleKou.id`）。検索が空なら null（絞り込まない） */
export function kouIdsWithMoku(index: MokuIndex, year: number, query: string, regex: boolean): Set<string> | null {
  if (query.trim() === '') return null;
  const ids = new Set<string>();
  for (const n of index.data.nodes) if (n[1] === year && textMatches(n[2], query, regex)) ids.add(index.data.kous[n[0]]!);
  return ids;
}

/**
 * 目の年度の流れ: 項の確定した対応でたどった項（`chainKouIds`。年度の古い順）の中で、同じ目を探す。
 * 同じ目 = 同じ識別（目名・分類コード・共管）。無ければ、同じ目名の目がその項に 1 つだけのとき、それを使う（分類コードは年度で変わることがある）。
 * 目そのものの年度をまたぐ対応（改称・統合）は、まだ見ていない。見つからない年度は null。
 */
export function mokuFlow(index: MokuIndex, node: number, chainKouIds: readonly string[]): { kouId: string; node: number | null; byName: boolean }[] {
  const self = index.data.nodes[node]!;
  return chainKouIds.map(kouId => {
    const k = index.kouOf.get(kouId);
    if (k === undefined) return { kouId, node: null, byName: false };
    const exact = index.nodeByKey.get(`${kouId}|${mokuKeyOf(self)}`);
    if (exact !== undefined) return { kouId, node: exact, byName: false };
    if (self[4] !== '') return { kouId, node: null, byName: false };
    const same = (index.nodesOf.get(k) ?? []).filter(i => index.data.nodes[i]![2] === self[2] && index.data.nodes[i]![4] === '');
    return same.length === 1 ? { kouId, node: same[0]!, byName: true } : { kouId, node: null, byName: false };
  });
}

/** 補正の値が無い理由（表示用）。値があるときは null */
export function mokuSuppNote(data: LifecycleMokuData, n: LifecycleMokuNode): string | null {
  if (n[6] !== null) return null;
  if (!data.suppYears.includes(n[1])) return 'この年度の補正の書は、データに無い';
  if (n[13] & MOKU_FLAG.settlePart) return '決算の共管別の行（補正は、共管別に分かれていない）';
  if (n[13] & MOKU_FLAG.requestOnly) return '概算要求書にだけある目';
  if (n[13] & MOKU_FLAG.suppAggregated) return '補正の書では「外N目」の行にまとめられた目（補正で変更の無い目。目別の補正の額は無い）';
  if (n[13] & MOKU_FLAG.suppKouOnly) return '補正の書は、この項を目名の無い 1 行（項の行）で載せ、目の内訳が無い';
  return '補正の書に、この項の行が無い（補正の無い項）';
}

/** 決算の値が無い理由（表示用）。値があるときは null */
export function mokuSettleNote(data: LifecycleMokuData, n: LifecycleMokuNode): string | null {
  if (n[8] !== null) return null;
  if (!data.settleYears.includes(n[1])) return 'この年度の決算の書は、データに無い';
  if (n[13] & MOKU_FLAG.settleSplit) return '決算は、共管の組織ごとの行に分かれている（共管別の行を見る）';
  if (n[13] & MOKU_FLAG.requestOnly) return '概算要求書にだけある目';
  return '決算の書に、この目が無い（目名・分類コードで結べない）';
}

/** 項の右ペインの目のタブで切り替える値: 目の値の位置（`LifecycleMokuNode`）と、照合する項の値（`LifecycleValues` のキー。円） */
export const MOKU_MEASURES = [
  { key: 'request', label: '概算要求', col: 12, kou: 'request_amount' },
  { key: 'budget', label: '政府案', col: 5, kou: 'budget_amount' },
  { key: 'revised', label: '補正後', col: 6, kou: 'revised_amount' },
  { key: 'current', label: '歳出予算現額', col: 8, kou: 'current_amount' },
  { key: 'spent', label: '支出済', col: 9, kou: 'spent' },
  { key: 'unused', label: '不用額', col: 11, kou: 'unused' },
] as const;
export type MokuMeasure = (typeof MOKU_MEASURES)[number]['key'];
export const mokuMeasure = (key: MokuMeasure) => MOKU_MEASURES.find(m => m.key === key)!;
/** 目の値（千円）。無ければ null */
export const mokuValue = (n: LifecycleMokuNode, key: MokuMeasure): number | null => n[mokuMeasure(key).col] as number | null;

export interface MokuKouRow {
  name: string;
  /** 決算の共管別の行の共管。それ以外は空 */
  part: string;
  /** 年度 → 目（`nodes` の添字） */
  cells: Map<number, number>;
  /** 年度で分類コードが違い、目名でそろえた */
  byName: boolean;
}

/**
 * 項の流れ（確定した対応でたどった項。`kous` は年度の古い順）の目を、年度をまたいでそろえる。
 * 同じ目名の目（共管別の行を除く）が、どの年度でもその項に 1 つ以下なら、目名でそろえる（分類コードは年度で変わることがある。`mokuFlow` と同じ考え方）。
 * 同じ目名の目が 2 つ以上ある年度があれば、その目名は識別（目名・分類コード）でそろえる。共管別の行は識別（共管を含む）でそろえる。
 * 目の改称・統合は見ていない（名前の違う目は別の行）。行は、最初に出てくる順。
 */
export function mokuKouTable(index: MokuIndex, kous: readonly { id: string; year: number }[]): MokuKouRow[] {
  const perYear = kous.map(({ id, year }) => {
    const k = index.kouOf.get(id);
    return { year, nodes: k === undefined ? [] : index.nodesOf.get(k) ?? [] };
  });
  const most = new Map<string, number>();
  for (const { nodes } of perYear) {
    const count = new Map<string, number>();
    for (const i of nodes) { const n = index.data.nodes[i]!; if (n[4] === '') count.set(n[2], (count.get(n[2]) ?? 0) + 1); }
    for (const [name, c] of count) most.set(name, Math.max(most.get(name) ?? 0, c));
  }
  const rows = new Map<string, MokuKouRow & { codes: Set<string> }>();
  for (const { year, nodes } of perYear) {
    for (const i of nodes) {
      const n = index.data.nodes[i]!;
      const group = n[4] === '' && most.get(n[2]) === 1 ? `name|${n[2]}` : `key|${mokuKeyOf(n)}`;
      const row = rows.get(group) ?? rows.set(group, { name: n[2], part: n[4], cells: new Map(), byName: false, codes: new Set() }).get(group)!;
      row.cells.set(year, i);
      row.codes.add(n[3]);
    }
  }
  // 概算要求にだけある目（分類コードが空）は、分類コードの違いに数えない
  return [...rows.values()].map(({ codes, ...r }) => ({ ...r, byName: [...codes].filter(c => c !== '').length > 1 }));
}

/** 目の値の計（千円）。値の無い目は足さず、数える */
export function mokuSum(index: MokuIndex, nodes: readonly number[], key: MokuMeasure): { sum: number | null; missing: number } {
  let sum: number | null = null, missing = 0;
  for (const i of nodes) {
    const v = mokuValue(index.data.nodes[i]!, key);
    if (v === null) missing++;
    else sum = (sum ?? 0) + v;
  }
  return { sum, missing };
}
