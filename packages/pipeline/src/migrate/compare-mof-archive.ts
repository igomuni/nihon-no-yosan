/**
 * 財務省の公式 CSV の zip から作り直した項・目の CSV（FY2023・FY2024）を、基準データの `mof-archive/{年度}/` と、バイト単位で比べる。
 * 過去年度（FY2017〜FY2022）を作る処理（`build/mof-archive.ts`）が、基準データを作った処理と同じ出力になることの確認。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-mof-archive.ts <基準データのディレクトリ> <zip のディレクトリ> <結果の JSON>
 * - zip のディレクトリには `DL{年}{帳票}.zip`（FY2023・FY2024 の分）が並ぶ。zip の SHA-256 は、その場で計算して結果に残す（記録との照合は `build` の仕事）。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ACCOUNTS, buildBudgetCsv, buildHoseiKessanCsv } from '../build/mof-archive.ts';

const [dataset, zipDir, resultPath] = process.argv.slice(2);
if (!dataset || !zipDir || !resultPath) throw new Error('usage: compare-mof-archive.ts <dataset> <zipDir> <result.json>');
const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const zip = (year: number, doc: string): { zipPath: string; sha256: string } => {
  const zipPath = path.join(zipDir, `DL${year}${doc}.zip`);
  return { zipPath, sha256: sha(fs.readFileSync(zipPath)) };
};

const years: Record<string, { files: number; allEqual: boolean; zips: Record<string, string> }> = {};
const problems: string[] = [];
for (const year of [2023, 2024]) {
  const made: Record<string, string> = {};
  const zips: Record<string, string> = {};
  for (const account of ACCOUNTS) {
    const docs = account === 'general' ? ['11001', '21001', '77001'] : ['12001', '22001', '78001'];
    for (const d of docs) zips[`DL${year}${d}.zip`] = zip(year, d).sha256;
    Object.assign(made, buildBudgetCsv(year, account, zip(year, docs[0]!)).files);
    Object.assign(made, buildHoseiKessanCsv('hosei', year, account, 1, zip(year, docs[1]!)).files);
    Object.assign(made, buildHoseiKessanCsv('kessan', year, account, 1, zip(year, docs[2]!)).files);
  }
  let allEqual = true;
  for (const [name, text] of Object.entries(made)) {
    const ref = fs.readFileSync(path.join(dataset, 'mof-archive', String(year), name));
    if (!Buffer.from(text).equals(ref)) { allEqual = false; problems.push(`${year}/${name}`); }
  }
  years[year] = { files: Object.keys(made).length, allEqual, zips };
}
fs.writeFileSync(resultPath, JSON.stringify({ comparedWith: 'data/dataset/reference-v0/mof-archive/{年度}', years, allEqual: problems.length === 0 }, null, 1) + '\n');
console.log(problems.length === 0 ? 'all equal' : `DIFFERENT:\n${problems.join('\n')}`);
if (problems.length) process.exit(1);
