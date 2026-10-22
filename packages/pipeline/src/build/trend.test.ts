import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { readCsv, type BudgetRequestTrendData, type Rec } from '@nihon-no-yosan/core';
import { buildBudgetRequestTrend, TREND_YEARS, type TrendMatch } from './trend.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trend-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const SLUG = 'x.go.jp__env';
// 1 年度分の基準データ: 表紙（環境省）、空の明細表（ヘッダだけ）、PDF の一覧
for (const [year] of TREND_YEARS) {
  const dir = path.join(tmp, 'budget-request', String(year));
  fs.mkdirSync(path.join(dir, 'cover', 'sources'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'detail-table', 'sources'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'cover', 'sources', `${SLUG}.csv`), 'source_page,entry_index,kind,ordinal,marker,code,name,page_ref,status\n1,0,HEADER,,,31,環境省所管,,\n');
  fs.writeFileSync(path.join(dir, 'detail-table', 'sources', `${SLUG}.csv`), '要求番号,事項,頁,source_page,row_type\n');
  fs.writeFileSync(
    path.join(dir, 'pdf-corpus-freeze.json'),
    JSON.stringify({ documents: [{ localPdfPath: 'data/download/x.go.jp/env.pdf', sourceUrl: `https://x.go.jp/${year}/env.pdf` }] }),
  );
}

const kou = (name: string, code3: string, prev: string, req: string, org = '環境本省'): Rec => ({
  request_source: SLUG, toc_kou_idx: '0', request_code3: code3, request_name: name, request_page: '5',
  acct: 'general', ministry: '環境省', org, account: '', sub: '', request_amount: req, previous_amount: prev, hierarchy: 'toc',
});
const matchesOf = (byYear: Record<number, Rec[]>): Map<number, TrendMatch> =>
  new Map(TREND_YEARS.map(([y, ver]) => [y, { requestKou: byYear[y] ?? [], m1Kou: ver ? [] : null }]));

describe('buildBudgetRequestTrend', () => {
  it('puts the same 項 of every year in one row, keeps the amounts and points to the PDF of each year', () => {
    const r = buildBudgetRequestTrend({
      datasetDir: tmp,
      matches: matchesOf(Object.fromEntries(TREND_YEARS.map(([y], i) => [y, [kou('地球温暖化対策推進費', '017', String(100 + i), String(110 + i))]]))),
    });
    expect(r.ui.rows).toHaveLength(1);
    const row = r.ui.rows[0]!;
    expect(Object.keys(row.y)).toEqual(['2023', '2024', '2025', '2026', '2027']);
    expect(row).toMatchObject({ acct: 0, min: '環境省', org: '環境本省', orgSrc: '目次', name: '地球温暖化対策推進費', code: '31' });
    expect(row.y['2025']).toMatchObject({ prev: 102, req: 112, mismatch: false, mof: '' });
    expect(r.ui.urls).toEqual(TREND_YEARS.map(([y]) => `https://x.go.jp/${y}/env.pdf`));
    const csv = readCsv(r.files['kou.csv']);
    expect(csv).toHaveLength(5);
    expect(csv[0]).toMatchObject({ 年度: '2023', 会計区分: '一般', 所管: '環境省', 項名: '地球温暖化対策推進費', 増減_千円: '10', 複数書: '0' });
  });

  it('joins a renamed 項 (same 所管 and 勘定, name close, amount within 30%) into one row', () => {
    const r = buildBudgetRequestTrend({
      datasetDir: tmp,
      matches: matchesOf({
        2023: [kou('児童手当等交付金', '010', '90', '100')],
        2024: [kou('児童手当交付金', '010', '95', '105')],
      }),
    });
    expect(r.ui.rows).toHaveLength(1);
    expect(r.ui.rows[0]!.y['2024']!.moved).toEqual({ kind: '改称', from: '環境省 › 環境本省「児童手当等交付金」' });
    expect(Object.keys(r.ui.rows[0]!.y)).toEqual(['2023', '2024']);
  });

  it('writes the same data as plain JSON and gzip, and a summary that agrees with the rows', () => {
    const r = buildBudgetRequestTrend({ datasetDir: tmp, matches: matchesOf({ 2023: [kou('A費A費A費', '001', '1', '2')] }) });
    expect(JSON.parse(zlib.gunzipSync(r.uiGz).toString('utf8'))).toEqual(JSON.parse(r.uiJson) as BudgetRequestTrendData);
    const summary = JSON.parse(r.files['summary.json']) as { years: Record<string, { rows: number }> };
    expect(summary.years['2023']!.rows).toBe(1);
    expect(summary.years['2024']!.rows).toBe(0);
  });

  it('stops when a PDF of the 項 is not in the PDF list', () => {
    const bad = kou('A費', '001', '1', '2');
    bad['request_source'] = 'unknown__source';
    expect(() => buildBudgetRequestTrend({ datasetDir: tmp, matches: matchesOf({ 2023: [bad] }) })).toThrow(/no URL for 2023/);
  });
});
