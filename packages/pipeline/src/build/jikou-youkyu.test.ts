import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { readCsv, type BudgetRequestJikouData, type Rec } from '@nihon-no-yosan/core';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildBudgetRequestTrend, TREND_YEARS, type TrendMatch } from './trend.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jikou-youkyu-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const SLUG = 'x.go.jp__env';
const DETAIL_HEAD = '要求番号,事項,前年度予算額,７年度概算要求額,頁,source_page,source_line_start,row_type\n';

/** 1 年度分の基準データ（環境省の書 1 冊）。plain text の 1 行目が項、2 行目が事項（備考に印あり）。`mark` で備考の文字を変える */
function writeYear(year: number, mark: string): void {
  const dir = path.join(tmp, 'budget-request', String(year));
  for (const d of ['cover/sources', 'detail-table/sources', 'plain-text']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, 'cover', 'sources', `${SLUG}.csv`), 'source_page,entry_index,kind,ordinal,marker,code,name,page_ref,status\n1,0,HEADER,,,31,環境省所管,,\n');
  fs.writeFileSync(path.join(dir, 'detail-table', 'sources', `${SLUG}.csv`), DETAIL_HEAD + ',010 共通費,50,100,3,1,1,CODE3\n1,01‑95 一般行政に必要な経費,50,100,3,1,2,DETAIL\n');
  fs.writeFileSync(path.join(dir, 'plain-text', `${SLUG}.txt`), `010 共通費 50 100 50\n1 01-95 一般行政に必要な経費 ${mark}\n`);
  fs.writeFileSync(path.join(dir, 'pdf-corpus-freeze.json'), JSON.stringify({ documents: [{ localPdfPath: 'data/download/x.go.jp/env.pdf', sourceUrl: `https://x.go.jp/${year}/env.pdf` }] }));
}

const kou = (prev: string, req: string): Rec => ({
  request_source: SLUG, toc_kou_idx: '0', request_code3: '010', request_name: '共通費', request_page: '5',
  acct: 'general', ministry: '環境省', org: '環境本省', account: '', sub: '', request_amount: req, previous_amount: prev, hierarchy: 'toc',
});
// 2023: 備考に（事項要求）、2024: 備考に文の言及、2025: 前年度 50・要求 0、2026・2027: 何もない
const REQ: Record<number, [string, string, string]> = {
  2023: ['50', '100', '（事項要求）'],
  2024: ['50', '100', '財源の確保については、事項要求とする'],
  2025: ['50', '0', ''],
  2026: ['50', '100', ''],
  2027: ['50', '100', ''],
};
const matches = new Map<number, TrendMatch>(TREND_YEARS.map(([y, ver]) => [y, { requestKou: [kou(REQ[y]![0], REQ[y]![1])], m1Kou: ver ? [] : null }]));
for (const [y, v] of Object.entries(REQ)) writeYear(Number(y), v[2]);

describe('buildBudgetRequestJikouYoukyu', () => {
  const kouCsv = buildBudgetRequestTrend({ datasetDir: tmp, matches }).files['kou.csv'];
  const r = buildBudgetRequestJikouYoukyu({ datasetDir: tmp, matches, kouCsv });

  it('finds 印 and 文 inside the range of a 項, and 要求0 from the amounts', () => {
    const rows = readCsv(r.files['kou.csv']);
    expect(rows.map(x => [x['年度'], x['形']])).toEqual([['2023', '印'], ['2024', '文'], ['2025', '要求0']]);
    expect(rows[0]).toMatchObject({ 項名: '共通費', 印の行の階層: '事項', 要求書: SLUG, 前年度予算額_千円: '50', 要求額_千円: '100' });
    expect(rows[1]!['根拠の行']).toContain('事項要求とする');
  });

  it('writes one row per occurrence to marks.csv and counts them in the summary', () => {
    const marks = readCsv(r.files['marks.csv']);
    expect(marks.map(x => [x['年度'], x['種類'], x['階層'], x['項名']])).toEqual([['2023', '印', '事項', '共通費'], ['2024', '文', '事項', '共通費']]);
    expect(r.summary['2023']).toMatchObject({ occurrences: 1, joined_to_kou: 1, unplaced: 0, kou_with_forms: 1, forms: { 印: 1 } });
    expect(r.summary['2026']).toMatchObject({ occurrences: 0, kou_with_forms: 0, forms: {} });
  });

  it('puts only 印 and 文 into the 画面用 JSON', () => {
    const ui = JSON.parse(zlib.gunzipSync(r.uiGz).toString('utf8')) as BudgetRequestJikouData;
    expect(Object.keys(ui.years)).toEqual(['2023', '2024']);
    expect(ui.years['2023']).toEqual([['0|環境省||環境本省|共通費', ['印'], '1 01-95 一般行政に必要な経費 （事項要求）']]);
  });
});
