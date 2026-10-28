/**
 * 行政事業レビュー（RS）の事業の一覧と、予算書の項・目へのつなぎ（画面の「RS」タブ）。純粋な関数。仕様: docs/guides/rs-link.md、docs/guides/rs-tab.md
 * 画面用のデータ（`rs/jigyo.json.gz`）の型もここに置く。額は円（RS の予算・執行は円単位）。値が無いところは null（0 とは別）。
 */
import { textMatches } from './trend-view.ts';
import type { LifecycleSortDir } from './lifecycle-list.ts';

/** 事業 × 予算年度の額の位置（`RsAmountRow` の 2〜9 番目） */
export const RS_AMOUNTS = [
  { key: 'initial', label: '当初予算', col: 2 },
  { key: 'supp', label: '補正予算', col: 3 },
  { key: 'carryIn', label: '前年度繰越', col: 4 },
  { key: 'reserve', label: '予備費等', col: 5 },
  { key: 'current', label: '歳出予算現額', col: 6 },
  { key: 'spent', label: '執行額', col: 7 },
  { key: 'carryOut', label: '翌年度繰越', col: 8 },
  { key: 'request', label: '翌年度要求額', col: 9 },
] as const;
export type RsAmountKey = (typeof RS_AMOUNTS)[number]['key'];

/** [事業の添字, 予算年度, 当初予算, 補正予算, 前年度からの繰越し, 予備費等, 歳出予算現額, 執行額, 翌年度への繰越し, 翌年度要求額]（RS の 2-1 の合計の行。円） */
export type RsAmountRow = [number, number, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null];
/** 予算書の項に結べた行（RS の 2-2）: [事業の添字, 予算年度, 項の添字, 目名（空のことがある）, 予算種別（空のことがある）, 予算額（円。空欄は null）] */
export type RsLinkEntry = [number, number, number, string, string, number | null];

export interface RsJigyoData {
  /** 予算年度（2-1 に行のある年度） */
  years: number[];
  /** 項の id（`LifecycleKou.id`）。`links` が指す */
  kous: string[];
  /** 事業 1 件: [予算事業 ID, 事業名, 府省庁, 局・庁, 主要経費（複数は `|` でつなぐ。空のことがある）] */
  jigyo: [string, string, string, string, string][];
  amounts: RsAmountRow[];
  links: RsLinkEntry[];
}

export interface RsIndex {
  data: RsJigyoData;
  /** 予算事業 ID → 事業の添字 */
  indexOf: ReadonlyMap<string, number>;
  /** 事業の添字 → 年度の額（年度の古い順） */
  amountsOf: ReadonlyMap<number, readonly RsAmountRow[]>;
  /** `${事業の添字}|${予算年度}` → 項に結べた行 */
  linksOf: ReadonlyMap<string, readonly RsLinkEntry[]>;
}

export function rsIndex(data: RsJigyoData): RsIndex {
  const amountsOf = new Map<number, RsAmountRow[]>();
  for (const a of data.amounts) (amountsOf.get(a[0]) ?? amountsOf.set(a[0], []).get(a[0])!).push(a);
  for (const list of amountsOf.values()) list.sort((x, y) => x[1] - y[1]);
  const linksOf = new Map<string, RsLinkEntry[]>();
  for (const l of data.links) { const k = `${l[0]}|${l[1]}`; (linksOf.get(k) ?? linksOf.set(k, []).get(k)!).push(l); }
  return { data, indexOf: new Map(data.jigyo.map((j, i) => [j[0], i])), amountsOf, linksOf };
}

export const rsAmount = (row: RsAmountRow, key: RsAmountKey): number | null => row[RS_AMOUNTS.find(m => m.key === key)!.col] as number | null;

export interface RsListRow {
  /** 事業の添字 */
  idx: number;
  id: string;
  name: string;
  ministry: string;
  bureau: string;
  major: string;
  /** その年度に、予算書の項に結べた項の数（結べた行を持つ項の数）。0 = 結べない */
  kouCount: number;
  /** 円。値が無いときは null */
  initial: number | null;
  supp: number | null;
  current: number | null;
  spent: number | null;
  request: number | null;
}

/** 選んだ予算年度の事業の行（2-1 にその年度の行がある事業。項に結べない事業も含める） */
export function rsListRows(index: RsIndex, year: number): RsListRow[] {
  const rows: RsListRow[] = [];
  index.data.jigyo.forEach(([id, name, ministry, bureau, major], idx) => {
    const a = index.amountsOf.get(idx)?.find(x => x[1] === year);
    if (!a) return;
    const kouCount = new Set((index.linksOf.get(`${idx}|${year}`) ?? []).map(l => l[2])).size;
    rows.push({ idx, id, name, ministry, bureau, major, kouCount, initial: a[2], supp: a[3], current: a[6], spent: a[7], request: a[9] });
  });
  return rows;
}

export interface RsFilters {
  /** 府省庁（空 = すべて）。`[NONE_SELECTED]` の扱いは画面の部品に合わせ、ここでは名前の一致だけ見る */
  ministries: string[];
  bureau: string;
  bureauRegex: boolean;
  name: string;
  nameRegex: boolean;
  /** 項への結び: `linked` = 結べた事業だけ、`unlinked` = 結べない事業だけ */
  link: 'all' | 'linked' | 'unlinked';
}
export const INITIAL_RS_FILTERS: RsFilters = { ministries: [], bureau: '', bureauRegex: false, name: '', nameRegex: false, link: 'all' };

export function filterRsRows(rows: readonly RsListRow[], f: RsFilters, noneSelected: string): RsListRow[] {
  if (f.ministries.includes(noneSelected)) return [];
  const set = new Set(f.ministries);
  return rows.filter(r =>
    (set.size === 0 || set.has(r.ministry))
    && textMatches(r.bureau, f.bureau, f.bureauRegex)
    && textMatches(r.name, f.name, f.nameRegex)
    && (f.link === 'all' || (f.link === 'linked') === (r.kouCount > 0)));
}

export type RsSortKey = 'ministry' | 'bureau' | 'name' | 'kou' | 'initial' | 'supp' | 'current' | 'spent' | 'request';
export const RS_TEXT_SORT_KEYS: readonly RsSortKey[] = ['ministry', 'bureau', 'name'];

/** 並べ替え。額の列は、値が無い事業を、向きによらず末尾に置く（0 とは別）。同じ値は事業 ID の数字の順 */
export function sortRsRows(rows: readonly RsListRow[], key: RsSortKey, dir: LifecycleSortDir): RsListRow[] {
  const idOrder = (x: RsListRow, y: RsListRow): number => Number(x.id) - Number(y.id) || x.id.localeCompare(y.id);
  return [...rows].sort((x, y) => {
    if (key === 'ministry' || key === 'bureau' || key === 'name') return dir * x[key].localeCompare(y[key], 'ja') || idOrder(x, y);
    if (key === 'kou') return dir * (x.kouCount - y.kouCount) || idOrder(x, y);
    const a = x[key], b = y[key];
    if (a === null || b === null) return a === b ? idOrder(x, y) : a === null ? 1 : -1;
    return dir * (a - b) || idOrder(x, y);
  });
}
