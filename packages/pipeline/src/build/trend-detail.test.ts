import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { readCsv, type BudgetRequestTrendDetailData, type Rec } from '@nihon-no-yosan/core';
import { buildBudgetRequestTrend, TREND_YEARS, type TrendMatch } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trend-detail-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const SLUG = 'x.go.jp__env';
const TOTAL_HEAD = '要求番号,区分,前年度予算額_計,７年度概算要求額_計,source_page,row_type\n';
const DETAIL_HEAD = '要求番号,事項,前年度予算額,７年度概算要求額,頁,source_page,row_type\n';

/** 1 年度分の基準データ（環境省の書 1 冊）。総表と明細表の中身は年度ごとに渡す */
function writeYear(year: number, total: string, detail: string): void {
  const dir = path.join(tmp, 'budget-request', String(year));
  for (const d of ['cover', 'toc', 'total-table', 'detail-table']) fs.mkdirSync(path.join(dir, d, 'sources'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'cover', 'sources', `${SLUG}.csv`), 'source_page,entry_index,kind,ordinal,marker,code,name,page_ref,status\n1,0,HEADER,,,31,環境省所管,,\n');
  fs.writeFileSync(path.join(dir, 'total-table', 'sources', `${SLUG}.csv`), TOTAL_HEAD + total);
  fs.writeFileSync(path.join(dir, 'detail-table', 'sources', `${SLUG}.csv`), DETAIL_HEAD + detail);
  fs.writeFileSync(path.join(dir, 'detail-table', 'unresolved.csv'), 'source_file,reason\n');
  fs.writeFileSync(path.join(dir, 'pdf-corpus-freeze.json'), JSON.stringify({ documents: [{ localPdfPath: 'data/download/x.go.jp/env.pdf', sourceUrl: `https://x.go.jp/${year}/env.pdf` }] }));
}

// 項 010 共通費（要求 100）: 事項 1 つ。目は 60 と、行が空欄で細分の合計が 40 のもの → 目の合計 100 で一致
const TOTAL_OK = ',010 共通費,50,100,3,CODE3\n1,01‑95 一般行政に必要な経費,50,100,3,DETAIL\n';
const DETAIL_OK = [
  ',010 共通費,,,3,4,CODE3',
  '1,01‑95 一般行政に必要な経費,,,3,4,DETAIL',
  ',95016‑2111‑02‑0000 職員基本給,30,60,3,5,CODE_5_4_2_4',
  ',95016‑2111‑03‑0000 職員諸手当,,,3,6,CODE_5_4_2_4',
  ',02‑0100 職員俸給,20,40,3,7,CODE_NN_NNNN',
].join('\n') + '\n';
// 目の合計が 90 で、項の額 100 と合わない
const DETAIL_NE = DETAIL_OK.replace(',20,40,', ',20,30,');

const kou: Rec = {
  request_source: SLUG, toc_kou_idx: '0', request_code3: '010', request_name: '共通費', request_page: '5',
  acct: 'general', ministry: '環境省', org: '環境本省', account: '', sub: '', request_amount: '100', previous_amount: '50', hierarchy: 'toc',
};
const matches = new Map<number, Pick<TrendMatch, 'requestKou'> & TrendMatch>(
  TREND_YEARS.map(([y, ver]) => [y, { requestKou: y === 2023 || y === 2024 ? [kou] : [], m1Kou: ver ? [] : null }]),
);

function build(detail2024: string) {
  writeYear(2023, TOTAL_OK, DETAIL_OK);
  writeYear(2024, TOTAL_OK, detail2024);
  for (const y of [2025, 2026, 2027]) writeYear(y, '', '');
  const kouCsv = buildBudgetRequestTrend({ datasetDir: tmp, matches }).files['kou.csv'];
  return buildBudgetRequestTrendDetail({ datasetDir: tmp, matches, kouCsv });
}

describe('buildBudgetRequestTrendDetail', () => {
  it('takes the 事項 amount from the total table and the 目 from the detail table, and uses the 細分 sum for a blank 目', () => {
    const r = build(DETAIL_OK);
    const jikou = readCsv(r.files['jikou.csv']);
    expect(jikou).toHaveLength(2);
    expect(jikou[0]).toMatchObject({
      年度: '2023', 項名: '共通費', 事項名: '一般行政に必要な経費', 前年度予算額_千円: '50', 要求額_千円: '100',
      目の要求額の合計_千円: '100', 目の行数: '2', 細分の合計を使った目: '1', 目の額の空き: '0', 検算: '一致',
    });
    const moku = readCsv(r.files['moku/2023.csv']);
    expect(moku.map(m => [m['目名'], m['要求額_千円'], m['細分の合計を使った行']])).toEqual([
      ['職員基本給', '60', '0'],
      ['職員諸手当', '40', '1'],
    ]);
    expect(moku[0]).toMatchObject({ 主要経費目的別コード: '95016', 目別コード: '02', 事項名: '一般行政に必要な経費' });
  });

  it('records a 項 whose 目 do not add up as 不一致 and writes the counts to the summary', () => {
    const r = build(DETAIL_NE);
    const jikou = readCsv(r.files['jikou.csv']);
    expect(jikou.map(j => [j['年度'], j['検算']])).toEqual([['2023', '一致'], ['2024', '不一致']]);
    const s = r.summary['2024'] as { kou: Record<string, number>; jikou: Record<string, number> };
    expect(s.kou).toMatchObject({ total: 1, kou_eq_jikou: 1, kou_ne_moku: 1, kou_eq_moku: 0 });
    expect(s.jikou).toMatchObject({ total: 1, ne: 1, eq: 0 });
    const summary = JSON.parse(r.files['detail-summary.json']) as { sha256: Record<string, string>; years: unknown };
    expect(Object.keys(summary.sha256)).toEqual(['jikou.csv', ...TREND_YEARS.map(([y]) => `moku/${y}.csv`)]);
  });

  it('writes the same data to the 画面用 JSON (gzip) as to the CSV', () => {
    const r = build(DETAIL_OK);
    const ui = JSON.parse(zlib.gunzipSync(r.uiGz).toString('utf8')) as BudgetRequestTrendDetailData;
    const y = ui.years['2023']!;
    const [key] = Object.keys(y);
    expect(key).toBe('0|環境省||環境本省|共通費');
    expect(y[key!]!.j).toEqual([['1', '一般行政に必要な経費', 50, 100, 100, '一致']]);
    expect(y[key!]!.m.map(m => [m[0], m[1], m[4]])).toEqual([[0, '職員基本給', 60], [0, '職員諸手当', 40]]);
  });

  it('stops when the 項 list differs from kou.csv', () => {
    writeYear(2023, TOTAL_OK, DETAIL_OK);
    const kouCsv = buildBudgetRequestTrend({ datasetDir: tmp, matches }).files['kou.csv'];
    const other = new Map(matches).set(2023, { requestKou: [], m1Kou: [] });
    expect(() => buildBudgetRequestTrendDetail({ datasetDir: tmp, matches: other, kouCsv })).toThrow(/2023: kou.csv 1 rows vs request-kou 0/);
  });
});
