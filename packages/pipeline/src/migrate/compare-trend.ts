/**
 * 概算要求の年度推移（項）の出力を、前のリポジトリに commit されている出力と、バイト単位で比べる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-trend.ts <基準データのディレクトリ> <前のリポジトリの作業ツリー> <commit> <結果の JSON>
 * - 比較先: `tests/fixtures/budget-request-trend/{kou.csv,summary.json}`、`public/data/v2/ui/budget-request-trend/kou.json.gz`、
 *   `tests/fixtures/mof-budget-request-match/2027/request-kou.csv`（FY2027 の突合の入力）。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildMofBudgetRequestMatch } from '../build/match.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from '../build/trend.ts';

const [dataset, repo, commit, resultPath] = process.argv.slice(2);
if (!dataset || !repo || !commit || !resultPath) throw new Error('usage: compare-trend.ts <dataset> <repo> <commit> <result.json>');

const sha = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const gitShow = (p: string): Buffer => execFileSync('git', ['-C', repo, 'show', `${commit}:${p}`], { maxBuffer: 1 << 29 });

const t = buildBudgetRequestTrend({ datasetDir: dataset, matches: matchesFromDataset(dataset) });
const m2027 = buildMofBudgetRequestMatch({
  requestDir: path.join(dataset, 'budget-request', '2027'),
  mofDir: path.join(dataset, 'mof-archive', '2026'),
  year: '2027',
  ver: '2026',
}).files['request-kou.csv']!;

const checks: [string, string, Buffer | string][] = [
  ['kou.csv', 'tests/fixtures/budget-request-trend/kou.csv', t.files['kou.csv']],
  ['summary.json', 'tests/fixtures/budget-request-trend/summary.json', t.files['summary.json']],
  ['kou.json.gz', 'public/data/v2/ui/budget-request-trend/kou.json.gz', t.uiGz],
  ['2027/request-kou.csv', 'tests/fixtures/mof-budget-request-match/2027/request-kou.csv', m2027],
];
const problems: string[] = [];
const entries: Record<string, { comparedWith: string; sha256: string; bytes: number; equal: boolean }> = {};
for (const [name, p, mine] of checks) {
  const old = gitShow(p);
  const equal = Buffer.from(mine).equals(old);
  entries[name] = { comparedWith: p, sha256: sha(old), bytes: old.length, equal };
  if (!equal) problems.push(name);
}
const result = {
  comparedWith: { repository: 'igomuni/marumie-rssystem', commit },
  manifest: { path: 'datasets/reference-v0/manifest.json', sha256: sha(fs.readFileSync(path.join('datasets', 'reference-v0', 'manifest.json'))) },
  files: entries,
  allEqual: problems.length === 0,
};
fs.writeFileSync(resultPath, JSON.stringify(result, null, 1) + '\n');
if (problems.length > 0) {
  console.error(`違い: ${problems.join(', ')}`);
  process.exit(1);
}
console.log(`OK: ${checks.length} ファイルがバイト一致`);
