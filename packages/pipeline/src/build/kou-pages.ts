/**
 * 概算要求書ごとの、項の開始頁の表。`trend.ts` の `kou.csv`（PDF頁・PDF頁の根拠・画像頁）から作る。
 * 頁が属する項は `core/redacted-pages.ts` の `kouOfPage` で決める。
 */
import { parseCsv, type KouPageRow } from '@nihon-no-yosan/core';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';

export type KouPage = KouPageRow & { ministry: string };

/** キーは `${年度}|${要求書の slug}` */
export function kouPagesByBook(dataset: string): Map<string, KouPage[]> {
  const kouCsv = buildBudgetRequestTrend({ datasetDir: dataset, matches: matchesFromDataset(dataset) }).files['kou.csv']!;
  const rows = parseCsv(kouCsv.replace(/^\uFEFF/, ''));
  const head = rows[0]!;
  const col = (name: string): number => { const i = head.indexOf(name); if (i < 0) throw new Error(`kou.csv に列が無い: ${name}`); return i; };
  const byBook = new Map<string, KouPage[]>();
  for (const r of rows.slice(1)) {
    if (r.length < 2 || !/^\d+$/.test(r[col('PDF頁')] ?? '')) continue;
    const key = `${r[col('年度')]}|${r[col('PDFの要求書')]}`;
    (byBook.get(key) ?? byBook.set(key, []).get(key)!).push({
      ministry: r[col('所管')] || (r[col('特別会計')] ?? ''), organization: r[col('組織')]!, itemName: r[col('項名')]!, itemCode: r[col('項コード')]!,
      startPage: Number(r[col('PDF頁')]), basis: r[col('PDF頁の根拠')]!, imagePage: r[col('画像頁')] === '1',
    });
  }
  return byBook;
}
