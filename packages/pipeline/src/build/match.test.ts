import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readCsv } from '@nihon-no-yosan/core';
import { buildMofBudgetRequestMatch } from './match.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'match-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const write = (p: string, header: string[], rows: string[][]): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, [header, ...rows].map(r => r.join(',')).join('\n') + '\n');
};

// 環境省 環境本省 の項 1 つ（事項 1 つ、目 1 つ）。要求と予算書で名前と額が一致する
const req = path.join(tmp, 'request');
const mofDir = path.join(tmp, 'mof');
const S = 'x.go.jp__env';
write(path.join(req, 'toc', 'sources', `${S}.csv`), ['要求番号', '区分', 'ページ'], [
  ['', '（所管） 31 環境省', '1'],
  ['', '（組織） 010 環境本省', '1'],
  ['', '（項） 017 地球温暖化対策推進費', '2'],
  ['1', '01-95 地球温暖化対策の推進に必要な経費', '2'],
]);
write(path.join(req, 'total-table', 'sources', `${S}.csv`), ['要求番号', '区分', '前年度予算額_計', '８年度概算要求額_計', '明細書頁数', 'source_page', 'row_type'], [
  ['', '017 地球温暖化対策推進費', '90', '100', '2', '1', 'CODE3'],
  ['1', '01‑95 地球温暖化対策の推進に必要な経費', '90', '100', '2', '1', 'DETAIL'],
  ['', '組織計', '90', '100', '', '1', 'TOTAL'],
]);
write(path.join(req, 'detail-table', 'sources', `${S}.csv`), ['要求番号', '事項', '前年度予算額', '８年度概算要求額', 'source_page', 'row_type'], [
  ['', '31 環境省所管', '', '', '1', 'CONTEXT'],
  ['', '017 地球温暖化対策推進費', '', '100', '1', 'CODE3'],
  ['1', '01‑95 地球温暖化対策の推進に必要な経費', '', '100', '1', 'DETAIL'],
  ['', '95016‑2111‑02‑0000 職員基本給', '', '100', '1', 'CODE_5_4_2_4'],
]);
const KOU = ['所管', '組織', '項コード', '項名'];
write(path.join(mofDir, 'kou-general.csv'), [...KOU, '令和8年度要求額の合計'], [['環境省', '環境本省', '0017', '地球温暖化対策推進費', '100']]);
write(path.join(mofDir, 'jikou-general.csv'), [...KOU, '事項名', '主要経費別分類コード', '令和8年度要求額'], [
  ['環境省', '環境本省', '0017', '地球温暖化対策推進費', '地球温暖化対策の推進に必要な経費', '95', '100'],
]);
write(path.join(mofDir, 'moku-general.csv'), [...KOU, '目名', '主要経費別分類コード', '目的別分類コード', '目別分類コード', '財政法公債金対象非対象別分類コード', '経済性質別分類コード', '使途別分類コード', '令和8年度要求額(千円)'], [
  ['環境省', '環境本省', '0017', '地球温暖化対策推進費', '職員基本給', '95', '016', '02', '2', '1', '11', '100'],
]);
for (const t of ['kou', 'jikou', 'moku']) {
  const header = t === 'kou' ? [...['特別会計', '勘定', '項コード', '項名'], '令和8年度要求額の合計'] : ['特別会計', '勘定', '項コード', '項名', t === 'jikou' ? '事項名' : '目名'];
  write(path.join(mofDir, `${t}-special.csv`), header, []);
}

describe('buildMofBudgetRequestMatch', () => {
  const { files } = buildMofBudgetRequestMatch({ requestDir: req, mofDir, year: '2026', ver: '2026' });
  const rows = (name: string) => readCsv(files[name]!);

  it('matches the 項, 事項 and 目 by name within the same scope, and keeps the amounts as diagnostics only', () => {
    expect(rows('m1-kou.csv')).toMatchObject([{ status: 'MATCHED', mof_row: 'kou-general:1', request_amount: '100', mof_amount: '100', amount_diff: '0', hierarchy: 'toc' }]);
    expect(rows('m2-jikou.csv')).toMatchObject([{ status: 'MATCHED', mof_jikou_row: 'jikou-general:1', class_code_agrees: 'true' }]);
    expect(rows('m3-moku.csv')).toMatchObject([{ status: 'MATCHED', mof_moku_row: 'moku-general:1', request_rows: '1', request_sum: '100', amount_diff: '0' }]);
  });
  it('leaves no 予算書 row unmatched and writes a summary that agrees with the CSVs', () => {
    for (const t of ['kou', 'jikou', 'moku']) expect(rows(`unmatched-mof-${t}.csv`)).toEqual([]);
    const summary = JSON.parse(files['summary.json']!) as { m1_status: Record<string, number>; mof_rows_referenced: Record<string, number>; sources: number };
    expect(summary.m1_status).toEqual({ MATCHED: 1 });
    expect(summary.mof_rows_referenced).toEqual({ kou: 1, jikou: 1, moku: 1 });
    expect(summary.sources).toBe(1);
  });
  it('reports a 項 whose name is not in the 予算書 as NO_CANDIDATE', () => {
    fs.writeFileSync(path.join(mofDir, 'kou-general.csv'), '所管,組織,項コード,項名,令和8年度要求額の合計\n環境省,環境本省,0017,別の名前の項,100\n');
    const r = readCsv(buildMofBudgetRequestMatch({ requestDir: req, mofDir, year: '2026', ver: '2026' }).files['m1-kou.csv']!);
    expect(r).toMatchObject([{ status: 'NO_CANDIDATE', reason: 'name_no_match' }]);
  });
});
