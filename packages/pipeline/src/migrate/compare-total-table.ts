/**
 * 総表の CSV の作り直しを、前のリポジトリに commit されている出力と、バイト単位で比べる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-total-table.ts <基準データのディレクトリ> <前のリポジトリの作業ツリー> <commit> <結果の JSON>
 * - 入力: 基準データの `budget-request/{年度}/plain-text/` と `plain-text-manifest.json`（年度は 2023〜2027）。
 * - 比較先: `tests/fixtures/budget-request-csv/{年度}/total-table/` の全ファイル。`summary.json` は入力の置き場の文字列（`input.inputDir`）だけ違うので、それを除いて比べる。
 *   `output-manifest.json` は各ファイルの SHA-256 の表で、`summary.json` の行だけが同じ理由で違うので、その行を除いて比べる。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildTotalTable } from '../extract/total-table.ts';

const [dataset, repo, commit, resultPath] = process.argv.slice(2);
if (!dataset || !repo || !commit || !resultPath) throw new Error('usage: compare-total-table.ts <dataset> <repo> <commit> <result.json>');

const sha = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const git = (...args: string[]): Buffer => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 1 << 29 });
const dropInputDir = (json: string): string => {
  const o = JSON.parse(json) as { input: { inputDir?: string } };
  delete o.input.inputDir;
  return JSON.stringify(o);
};

const dropSummary = (json: string): string => {
  const o = JSON.parse(json) as Record<string, string>;
  delete o['summary.json'];
  return JSON.stringify(o);
};

const years: Record<string, unknown> = {};
const problems: string[] = [];
for (const year of [2023, 2024, 2025, 2026, 2027]) {
  const dir = path.join(dataset, 'budget-request', String(year));
  const mine = buildTotalTable({ inputDir: path.join(dir, 'plain-text'), manifestPath: path.join(dir, 'plain-text-manifest.json'), year, inputLabel: '' });
  const prefix = `tests/fixtures/budget-request-csv/${year}/total-table`;
  const oldNames = git('ls-tree', '-r', '-z', '--name-only', commit, prefix).toString('utf8').split('\0').filter(Boolean).map(p => p.slice(prefix.length + 1));
  const names = [...new Set([...Object.keys(mine), ...oldNames])].sort();
  const files: Record<string, { sha256: string; bytes: number; equal: boolean }> = {};
  for (const name of names) {
    const old = oldNames.includes(name) ? git('show', `${commit}:${prefix}/${name}`) : null;
    const m = mine[name];
    let equal = old !== null && m !== undefined && Buffer.from(m).equals(old);
    if (!equal && name === 'summary.json' && old !== null && m !== undefined) equal = dropInputDir(m) === dropInputDir(old.toString('utf8'));
    if (!equal && name === 'output-manifest.json' && old !== null && m !== undefined) equal = dropSummary(m) === dropSummary(old.toString('utf8'));
    files[name] = { sha256: old ? sha(old) : '', bytes: old?.length ?? 0, equal };
    if (!equal) problems.push(`${year}/${name}`);
  }
  years[year] = { files: names.length, allEqual: names.every(n => files[n]!.equal), detail: files };
}
const result = {
  comparedWith: { repository: 'igomuni/marumie-rssystem', commit, path: 'tests/fixtures/budget-request-csv/{年度}/total-table' },
  manifest: { path: 'datasets/reference-v0/manifest.json', sha256: sha(fs.readFileSync(path.join('datasets', 'reference-v0', 'manifest.json'))) },
  years,
  allEqual: problems.length === 0,
};
fs.writeFileSync(resultPath, JSON.stringify(result, null, 1) + '\n');
console.log(problems.length === 0 ? 'all equal' : `DIFFERENT:\n${problems.join('\n')}`);
if (problems.length) process.exit(1);
