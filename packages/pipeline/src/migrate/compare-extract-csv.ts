/**
 * 総表・明細表・表紙・目次の CSV の作り直しを、前のリポジトリに commit されている出力と、バイト単位で比べる。
 * あわせて、頁分類で COVER・TOC になった頁が、前のリポジトリの構造 inventory の頁と同じことを確かめる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-extract-csv.ts <基準データのディレクトリ> <前のリポジトリの作業ツリー> <commit> <結果を置くディレクトリ> <PDF の置き場>
 * 結果は `<結果を置くディレクトリ>/{total-table,detail-table,cover,toc}-comparison.json` と `page-classification-comparison.json`。
 * - 入力: 基準データの `budget-request/{年度}/plain-text/` と `plain-text-manifest.json`（年度は 2023〜2027）。
 * - 比較先: `tests/fixtures/budget-request-csv/{年度}/{total-table,detail-table,cover,toc}/` の全ファイル。総表・明細表の `summary.json` は入力の置き場の文字列
 *   （`input.inputDir`）だけ違うので、それを除いて比べる。`output-manifest.json` は各ファイルの SHA-256 の表で、`summary.json` の行だけが同じ理由で違うので、その行を除いて比べる。
 * - 目次は pdf.js で PDF から作り直すので、PDF の置き場（記録の `data/download/` に当たるディレクトリ）が要る。`summary.json` は、入力の記録（前のリポジトリの inventory とコードの SHA-256）を除いて比べ、
 *   `output-hashes.json` は `summary.json` の行を除いて比べる。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCover } from '../extract/cover.ts';
import { buildDetailTable } from '../extract/detail-table.ts';
import { classifyYear } from '../extract/page-classification.ts';
import { buildToc } from '../extract/toc.ts';
import { buildTotalTable } from '../extract/total-table.ts';

const [dataset, repo, commit, resultDir, pdfRoot] = process.argv.slice(2);
if (!dataset || !repo || !commit || !resultDir || !pdfRoot) throw new Error('usage: compare-extract-csv.ts <dataset> <repo> <commit> <resultDir> <pdfRoot>');

const YEARS = [2023, 2024, 2025, 2026, 2027];
const sha = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const git = (...args: string[]): Buffer => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 1 << 29 });
const manifestSha = sha(fs.readFileSync(path.join('datasets', 'reference-v0', 'manifest.json')));
const comparedWith = { repository: 'igomuni/marumie-rssystem', commit };
const yearDir = (year: number): string => path.join(dataset, 'budget-request', String(year));

const dropInputDir = (json: string): string => {
  const o = JSON.parse(json) as { input: { inputDir?: string } };
  delete o.input.inputDir;
  return JSON.stringify(o);
};
const dropInputsRecord = (json: string): string => {
  const o = JSON.parse(json) as { inputs: { inventory?: unknown; code?: unknown } };
  delete o.inputs.inventory;
  delete o.inputs.code;
  return JSON.stringify(o);
};
const dropSummary = (json: string): string => {
  const o = JSON.parse(json) as Record<string, string>;
  delete o['summary.json'];
  return JSON.stringify(o);
};

const dropHashesSummary = (json: string): string => {
  const o = JSON.parse(json) as { files: Record<string, unknown> };
  delete o.files['summary.json'];
  return JSON.stringify(o);
};

const classifications = new Map(YEARS.map(y => [y, classifyYear(dataset, y)]));
const tableBuild = (build: typeof buildTotalTable) => (year: number): Record<string, string> =>
  build({ inputDir: path.join(yearDir(year), 'plain-text'), manifestPath: path.join(yearDir(year), 'plain-text-manifest.json'), year, inputLabel: '' });
const builders: Record<string, (year: number) => Record<string, string> | Promise<Record<string, string>>> = {
  'total-table': tableBuild(buildTotalTable),
  'detail-table': tableBuild(buildDetailTable),
  cover: year => buildCover({ datasetDir: dataset, year, records: classifications.get(year)! }),
  toc: year => buildToc({ pdfRoot, records: classifications.get(year)! }),
};

const problems: string[] = [];
for (const [kind, build] of Object.entries(builders)) {
  const years: Record<string, unknown> = {};
  for (const year of YEARS) {
    const mine = await build(year);
    const prefix = `tests/fixtures/budget-request-csv/${year}/${kind}`;
    const oldNames = git('ls-tree', '-r', '-z', '--name-only', commit, prefix).toString('utf8').split('\0').filter(Boolean).map(p => p.slice(prefix.length + 1));
    const names = [...new Set([...Object.keys(mine), ...oldNames])].sort();
    const files: Record<string, { sha256: string; bytes: number; equal: boolean }> = {};
    for (const name of names) {
      const old = oldNames.includes(name) ? git('show', `${commit}:${prefix}/${name}`) : null;
      const m = mine[name];
      let equal = old !== null && m !== undefined && Buffer.from(m).equals(old);
      if (!equal && kind === 'toc' && name === 'summary.json' && old !== null && m !== undefined) equal = dropInputsRecord(m) === dropInputsRecord(old.toString('utf8'));
      if (!equal && (kind === 'total-table' || kind === 'detail-table') && name === 'summary.json' && old !== null && m !== undefined) equal = dropInputDir(m) === dropInputDir(old.toString('utf8'));
      if (!equal && name === 'output-manifest.json' && old !== null && m !== undefined) equal = dropSummary(m) === dropSummary(old.toString('utf8'));
      if (!equal && name === 'output-hashes.json' && old !== null && m !== undefined) equal = dropHashesSummary(m) === dropHashesSummary(old.toString('utf8'));
      files[name] = { sha256: old ? sha(old) : '', bytes: old?.length ?? 0, equal };
      if (!equal) problems.push(`${kind}/${year}/${name}`);
    }
    years[year] = { files: names.length, allEqual: names.every(n => files[n]!.equal), detail: files };
  }
  const result = { comparedWith: { ...comparedWith, path: `tests/fixtures/budget-request-csv/{年度}/${kind}` }, manifest: { path: 'datasets/reference-v0/manifest.json', sha256: manifestSha }, years, allEqual: !problems.some(p => p.startsWith(`${kind}/`)) };
  fs.writeFileSync(path.join(resultDir, `${kind}-comparison.json`), JSON.stringify(result, null, 1) + '\n');
}

// 頁分類: COVER・TOC になった頁（書・頁・種類・DIRECT か INHERITED か）が、前の構造 inventory と同じ
const classYears: Record<string, unknown> = {};
for (const year of YEARS) {
  const invPath = `tests/fixtures/budget-request-cover-toc-structure/${year}/structure-inventory.json`;
  const inv = JSON.parse(git('show', `${commit}:${invPath}`).toString('utf8')) as { pages: { localPdfPath: string; physicalPage: number; classifierPageType: string; classifierSource: string; pdfSha256: string; textSha256: string }[] };
  const key = (p: { localPdfPath: string; physicalPage: number; type: string; source: string; pdf: string; text: string }): string => JSON.stringify([p.localPdfPath, p.physicalPage, p.type, p.source, p.pdf, p.text]);
  const old = inv.pages.map(p => key({ localPdfPath: p.localPdfPath, physicalPage: p.physicalPage, type: p.classifierPageType, source: p.classifierSource, pdf: p.pdfSha256, text: p.textSha256 })).sort();
  const mine = classifications.get(year)!
    .filter(r => r.classification.pageType === 'COVER' || r.classification.pageType === 'TOC')
    .map(r => key({ localPdfPath: r.localPdfPath, physicalPage: r.physicalPage, type: r.classification.pageType!, source: r.classification.source!, pdf: r.pdfSha256, text: r.rawText.textSha256 })).sort();
  const equal = old.length === mine.length && old.every((k, i) => k === mine[i]);
  classYears[year] = { comparedWith: invPath, coverTocPages: old.length, allEqual: equal };
  if (!equal) problems.push(`page-classification/${year}`);
}
fs.writeFileSync(path.join(resultDir, 'page-classification-comparison.json'), JSON.stringify({
  comparedWith, manifest: { path: 'datasets/reference-v0/manifest.json', sha256: manifestSha }, years: classYears, allEqual: !problems.some(p => p.startsWith('page-classification/')),
}, null, 1) + '\n');

console.log(problems.length === 0 ? 'all equal' : `DIFFERENT:\n${problems.join('\n')}`);
if (problems.length) process.exit(1);
