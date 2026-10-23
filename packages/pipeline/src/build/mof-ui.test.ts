import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import type { BudgetRequestMofData, BudgetRequestMofDetailData, Rec } from '@nihon-no-yosan/core';
import { buildBudgetRequestMofUi, MOF_UI_VERSIONS, type MofUiMatch } from './mof-ui.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mof-ui-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const SLUG = 'x.go.jp__env';
const AMT = '令和9年度要求額';

// 基準データ: 予算書の CSV（版ごと。一般会計の項 010 共通費 = 当初 90、事項 1 つ、目 2 つ）と、PDF の一覧
for (const [year, ver] of MOF_UI_VERSIONS) {
  const mof = path.join(tmp, 'mof-archive', ver);
  fs.mkdirSync(mof, { recursive: true });
  const head = '所管,組織,項コード,項名';
  fs.writeFileSync(path.join(mof, 'kou-general.csv'), `${head},目の行数,${AMT}の合計,前年度予算額(千円)の合計\n環境省,環境本省,010,共通費,2,90,40\n環境省,環境本省,020,予備費,1,5,5\n`);
  fs.writeFileSync(path.join(mof, 'kou-special.csv'), `特別会計,勘定,項コード,項名,目の行数,${AMT}の合計,前年度予算額(千円)の合計\n`);
  fs.writeFileSync(path.join(mof, 'jikou-general.csv'), `${head},事項名,${AMT},前年度予算額(千円)\n環境省,環境本省,010,共通費,一般行政に必要な経費,90,40\n`);
  fs.writeFileSync(path.join(mof, 'jikou-special.csv'), `特別会計,勘定,項コード,項名,事項名,${AMT},前年度予算額(千円)\n`);
  fs.writeFileSync(
    path.join(mof, 'moku-general.csv'),
    `${head},目名,主要経費別分類コード,目的別分類コード,目別分類コード,${AMT}(千円),前年度予算額(千円)\n` +
      '環境省,環境本省,010,共通費,職員基本給,95,016,02,60,30\n環境省,環境本省,010,共通費,予算書だけの目,95,016,09,30,10\n',
  );
  fs.writeFileSync(path.join(mof, 'moku-special.csv'), `特別会計,勘定,項コード,項名,目名,主要経費別分類コード,目的別分類コード,目別分類コード,${AMT}(千円),前年度予算額(千円)\n`);
  const req = path.join(tmp, 'budget-request', String(year));
  fs.mkdirSync(req, { recursive: true });
  fs.writeFileSync(path.join(req, 'pdf-corpus-freeze.json'), JSON.stringify({ documents: [{ localPdfPath: `data/download/${SLUG.replace('__', '/')}.pdf`, sourceUrl: `https://x.go.jp/${year}/env.pdf` }] }));
}

const rec = (o: Record<string, string>): Rec => o;
const requestKou = rec({ request_source: SLUG, toc_kou_idx: '0', org: '環境本省', sub: '', previous_amount: '45', acct: 'general', ministry: '環境省', account: '' });
const m1Matched = rec({ request_source: SLUG, toc_kou_idx: '0', request_code3: '010', request_name: '共通費', request_page: '5', mof_row: 'kou-general:1', status: 'MATCHED', reason: '', request_amount: '100', request_scope: '環境省|環境本省' });
const m1Only = rec({ request_source: SLUG, toc_kou_idx: '1', request_code3: '030', request_name: '新しい項', request_page: '6', mof_row: '', status: 'NO_CANDIDATE', reason: '', request_amount: '7', request_scope: '環境省|環境本省' });
const trendRow = (year: number, code: string, name: string): string => [year, '一般', '環境省', '', '', '環境本省', name, code, SLUG, '', '9'].join(',');
const trendKouCsv = ['年度,会計区分,所管,特別会計,勘定,組織,項名,項コード,要求書,PDFの要求書,PDF頁', ...MOF_UI_VERSIONS.flatMap(([y]) => [trendRow(y, '010', '共通費'), trendRow(y, '030', '新しい項')])].join('\n') + '\n';
const MOKU_HEAD = '年度,会計区分,所管,特別会計,勘定,組織,項名,項コード,事項名,目名,目コード(原文),要求額_千円,要求書\n';
const detailFiles: Record<string, string> = {
  'jikou.csv': '年度,会計区分,所管,特別会計,勘定,組織,項名,項コード,事項名,要求額_千円,要求書\n' + MOF_UI_VERSIONS.map(([y]) => `${y},一般,環境省,,,環境本省,共通費,010,一般行政に必要な経費,100,${SLUG}`).join('\n') + '\n',
  ...Object.fromEntries(MOF_UI_VERSIONS.map(([y]) => [`moku/${y}.csv`, MOKU_HEAD + `${y},一般,環境省,,,環境本省,共通費,010,一般行政に必要な経費,職員基本給,95016-2111-02-0000,100,${SLUG}\n`])),
};
const mofMatches = new Map<number, MofUiMatch>(MOF_UI_VERSIONS.map(([y]) => [y, { m1Kou: [m1Matched, m1Only], unmatchedMofKou: [rec({ mof_row: 'kou-general:2' })] }]));
const matches = new Map(MOF_UI_VERSIONS.map(([y]) => [y, { requestKou: [requestKou, { ...requestKou, toc_kou_idx: '1' }] }]));

describe('buildBudgetRequestMofUi', () => {
  const r = buildBudgetRequestMofUi({ datasetDir: tmp, matches, mofMatches, trendKouCsv, jikouKouCsv: '年度,会計区分,所管,特別会計,勘定,組織,項名,形,根拠の行\n', jikouUi: { years: {} }, detailFiles });
  const rows2026 = r.data.rows.filter(x => x.y === 2026);

  it('puts each 項 of a year in one of matched / mofOnly / reqOnly, with the amounts of both sides', () => {
    expect(rows2026.map(x => [x.kind, x.name, x.req, x.mof, x.reqPrev, x.mofPrev])).toEqual([
      ['matched', '共通費', 100, 90, 45, 40],
      ['reqOnly', '新しい項', 7, null, 45, null],
      ['mofOnly', '予備費', null, 5, null, 5],
    ]);
    expect(r.data.versions).toEqual({ 2023: '2023', 2024: '2024', 2025: '2025_teishutsu', 2026: '2026' });
    expect(r.data.urls).toEqual(MOF_UI_VERSIONS.map(([y]) => `https://x.go.jp/${y}/env.pdf`));
  });

  it('marks 編成で決まる for the 予備費 and counts the types in the summary', () => {
    expect(rows2026[2]!.types).toEqual(['編成で決まる']);
    expect(r.summary['2026']).toMatchObject({ version: '2026', rows: { matched: 1, reqOnly: 1, mofOnly: 1 }, types: { 編成で決まる: 1 } });
  });

  it('pairs the 事項 and 目 of both sides by name; a 目 only the budget book has stays one-sided', () => {
    const d = r.details[[2026, 'matched', 0, '環境省', '環境省', '', '環境本省', '共通費'].join('|')]!;
    expect(d.j).toEqual([['一般行政に必要な経費', '', 100, 90]]);
    expect(d.m).toEqual([['職員基本給', '95016-02', 100, 60], ['予算書だけの目', '95016-09', null, 30]]);
    expect(rows2026[0]).toMatchObject({ nJikou: 1, nMoku: 2 });
  });

  it('writes the same data to the gzip files as the objects', () => {
    expect(JSON.parse(zlib.gunzipSync(r.kouGz).toString('utf8'))).toEqual(JSON.parse(JSON.stringify(r.data)) as BudgetRequestMofData);
    expect((JSON.parse(zlib.gunzipSync(r.detailGz).toString('utf8')) as BudgetRequestMofDetailData).rows).toEqual(JSON.parse(JSON.stringify(r.details)));
  });
});
