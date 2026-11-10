/**
 * 調達ポータルの落札実績（画面「調達を観る」のデータ）。仕様: docs/guides/procurement.md
 *
 * 年度ごとのファイル（`procurement/{年度}.json.gz`）の行は、原本の CSV（落札実績オープンデータの全件データ）の 1 行。列の並びは原本と同じで、落札者だけ、
 * 同じ（商号又は名称・法人番号）の組を表（`vendors`）にまとめ、行は表の添字を持つ。府省コード・入札方式コードは、原本のコードのまま。名前は `procurement/meta.json.gz`。
 * 年度は、原本のファイルの年度（落札決定日が 4 月〜翌 3 月）。
 */
import type { LifecycleSortDir } from './lifecycle-list.ts';
import { textMatches } from './trend-view.ts';

/** 行（原本の列の順）: 調達案件番号、調達案件名称、落札決定日（YYYY-MM-DD）、落札価格（円。原本は小数 2 桁で、円未満が 0 でない行がある）、府省コード、入札方式コード、落札者（`vendors` の添字） */
export type ProcurementRow = [caseNo: string, name: string, date: string, yen: number, ministry: string, method: string, vendor: number];

/** 年度のファイル */
export interface ProcurementYearData {
  year: number;
  /** 落札者: [商号又は名称, 法人番号（原本が空なら空文字）] */
  vendors: [string, string][];
  rows: ProcurementRow[];
}

/** `procurement/meta.json.gz` */
export interface ProcurementMeta {
  /** 年度ごとの行数（落札決定日の最小・最大つき） */
  years: { year: number; rows: number; dateMin: string; dateMax: string }[];
  /** 府省コード → 名称（仕様書の表の全件） */
  ministries: [code: string, name: string][];
  /** 入札方式コード → 名称（仕様書の表の全件） */
  methods: [code: string, name: string][];
  /** 原本を取得した日時 */
  retrievedAt: string;
  /** 仕様書の版（例: 令和 8 年 10 月版） */
  specEdition: string;
}

/** 一覧の行 */
export interface ProcurementListRow {
  /** 年度のファイルの行の添字 */
  i: number;
  caseNo: string;
  name: string;
  date: string;
  yen: number;
  ministry: string;
  ministryName: string;
  method: string;
  methodName: string;
  vendorName: string;
  /** 法人番号（原本が空なら空文字） */
  corp: string;
  /** 落札者の同定の鍵。法人番号があれば法人番号、なければ商号又は名称（法人番号の無い行どうしだけが、名前で同じとみなされる） */
  vendorKey: string;
}

export interface ProcurementIndex {
  data: ProcurementYearData;
  ministryName: ReadonlyMap<string, string>;
  methodName: ReadonlyMap<string, string>;
  rows: ProcurementListRow[];
  /** 調達案件番号 → 行の添字（`ProcurementListRow.i`）。同じ案件番号に複数の行があることがある */
  byCase: ReadonlyMap<string, readonly number[]>;
  /** 落札者の鍵 → 行の添字 */
  byVendor: ReadonlyMap<string, readonly number[]>;
}

export const vendorKeyOf = (name: string, corp: string): string => (corp !== '' ? `c:${corp}` : `n:${name}`);

/** 年度のデータと名前の表から、一覧の行と、案件番号・落札者での引き表を作る。コードが名前の表に無ければ止まる（名前を捏造しない） */
export function procurementIndex(data: ProcurementYearData, meta: Pick<ProcurementMeta, 'ministries' | 'methods'>): ProcurementIndex {
  const ministryName = new Map(meta.ministries);
  const methodName = new Map(meta.methods);
  const byCase = new Map<string, number[]>();
  const byVendor = new Map<string, number[]>();
  const rows = data.rows.map(([caseNo, name, date, yen, ministry, method, v], i): ProcurementListRow => {
    const vendor = data.vendors[v];
    const mName = ministryName.get(ministry);
    const bName = methodName.get(method);
    if (!vendor) throw new Error(`落札者の添字が表に無い: ${data.year} 行 ${i} (${v})`);
    if (mName === undefined) throw new Error(`府省コードが表に無い: ${data.year} 行 ${i} (${ministry})`);
    if (bName === undefined) throw new Error(`入札方式コードが表に無い: ${data.year} 行 ${i} (${method})`);
    const vendorKey = vendorKeyOf(vendor[0], vendor[1]);
    (byCase.get(caseNo) ?? byCase.set(caseNo, []).get(caseNo)!).push(i);
    (byVendor.get(vendorKey) ?? byVendor.set(vendorKey, []).get(vendorKey)!).push(i);
    return { i, caseNo, name, date, yen, ministry, ministryName: mName, method, methodName: bName, vendorName: vendor[0], corp: vendor[1], vendorKey };
  });
  return { data, ministryName, methodName, rows, byCase, byVendor };
}

export interface ProcurementFilters {
  /** 府省コード（空 = すべて）。`[NONE_SELECTED]` の扱いは `filterProcurementRows` の引数 */
  ministries: string[];
  /** 入札方式コード（空 = すべて） */
  methods: string[];
  name: string;
  nameRegex: boolean;
  vendor: string;
  vendorRegex: boolean;
  /** 法人番号: `with` = ある行だけ、`without` = 原本が空の行だけ */
  corp: 'all' | 'with' | 'without';
  /** 落札価格の下限・上限（円。数字だけ。空 = 指定なし） */
  minYen: string;
  maxYen: string;
}
export const INITIAL_PROCUREMENT_FILTERS: ProcurementFilters = { ministries: [], methods: [], name: '', nameRegex: false, vendor: '', vendorRegex: false, corp: 'all', minYen: '', maxYen: '' };

/** 円の入力（`1,000` のカンマと空白は無視）。空は null。数字以外が混じると NaN（絞り込みは、NaN の側を指定なしとせず、何も通さない） */
export function parseYenInput(s: string): number | null {
  const t = s.replace(/[\s,]/g, '');
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

export function filterProcurementRows(rows: readonly ProcurementListRow[], f: ProcurementFilters, noneSelected: string): ProcurementListRow[] {
  if (f.ministries.includes(noneSelected) || f.methods.includes(noneSelected)) return [];
  const ministries = new Set(f.ministries);
  const methods = new Set(f.methods);
  const min = parseYenInput(f.minYen);
  const max = parseYenInput(f.maxYen);
  return rows.filter(r =>
    (ministries.size === 0 || ministries.has(r.ministry))
    && (methods.size === 0 || methods.has(r.method))
    && textMatches(r.name, f.name, f.nameRegex)
    && textMatches(r.vendorName, f.vendor, f.vendorRegex)
    && (f.corp === 'all' || (f.corp === 'with') === (r.corp !== ''))
    && (min === null || r.yen >= min)
    && (max === null || r.yen <= max));
}

export type ProcurementSortKey = 'date' | 'ministry' | 'name' | 'method' | 'vendor' | 'yen' | 'caseNo';
export const PROCUREMENT_TEXT_SORT_KEYS: readonly ProcurementSortKey[] = ['ministry', 'name', 'method', 'vendor', 'caseNo'];

/** 並べ替え。同じ値は、年度のファイルの行の順 */
export function sortProcurementRows(rows: readonly ProcurementListRow[], key: ProcurementSortKey, dir: LifecycleSortDir): ProcurementListRow[] {
  return [...rows].sort((x, y) => {
    let c: number;
    if (key === 'yen') c = x.yen - y.yen;
    else if (key === 'date') c = x.date < y.date ? -1 : x.date > y.date ? 1 : 0;
    else if (key === 'caseNo') c = x.caseNo < y.caseNo ? -1 : x.caseNo > y.caseNo ? 1 : 0;
    else {
      const a = key === 'ministry' ? x.ministryName : key === 'method' ? x.methodName : key === 'vendor' ? x.vendorName : x.name;
      const b = key === 'ministry' ? y.ministryName : key === 'method' ? y.methodName : key === 'vendor' ? y.vendorName : y.name;
      c = a.localeCompare(b, 'ja');
    }
    return dir * c || x.i - y.i;
  });
}

export interface ProcurementTotals {
  rows: number;
  yen: number;
  /** 落札者の数（`vendorKey` の種類） */
  vendors: number;
  /** 調達案件番号の種類 */
  cases: number;
  ministries: number;
}

/** 行の集計（一覧の集計行・落札者の合計） */
export function procurementTotals(rows: readonly ProcurementListRow[]): ProcurementTotals {
  let cents = 0;
  const vendors = new Set<string>(), cases = new Set<string>(), ministries = new Set<string>();
  // 小数 2 桁の値を、銭（1/100 円）の整数にして足す（浮動小数点の誤差を、足し算のたびに積まない）
  for (const r of rows) { cents += Math.round(r.yen * 100); vendors.add(r.vendorKey); cases.add(r.caseNo); ministries.add(r.ministry); }
  return { rows: rows.length, yen: cents / 100, vendors: vendors.size, cases: cases.size, ministries: ministries.size };
}

/** 落札価格の表示。原本は小数 2 桁（全 316,281 行）で、円未満が 0 でない行がある（1,831 行）ので、小数は 2 桁まで出す */
export const yenText = (yen: number): string => `${yen.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} 円`;

/** 落札価格の合計の注意。落札価格が、総額でなく単価のことがありうる（単価契約）が、原本の列からは区別できない */
export const PROCUREMENT_SUM_NOTE = '原本の落札価格の合計。単価契約の単価など、総額でない値も含みうる（原本の列からは区別できない）ので、支出の総額ではない';
