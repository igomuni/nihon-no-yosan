/**
 * 概算要求の事項要求の検知の出力を、前のリポジトリに commit されている出力と、バイト単位で比べる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-jikou-youkyu.ts <基準データのディレクトリ> <前のリポジトリの作業ツリー> <commit> <結果の JSON>
 * - 比較先: `tests/fixtures/budget-request-jikou-youkyu/{kou.csv,marks.csv,summary.json}`、`public/data/v2/ui/budget-request-trend/jikou.json.gz`。
 * - 入力の項の年度推移（`kou.csv`）は、基準データから作り直したものを使う（前のリポジトリの `kou.csv` とのバイト一致は `compare-trend.ts`）。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestTrend, matchesFromDataset } from '../build/trend.ts';
import { buildBudgetRequestJikouYoukyu } from '../build/jikou-youkyu.ts';

const [dataset, repo, commit, resultPath] = process.argv.slice(2);
if (!dataset || !repo || !commit || !resultPath) throw new Error('usage: compare-jikou-youkyu.ts <dataset> <repo> <commit> <result.json>');

const sha = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const gitShow = (p: string): Buffer => execFileSync('git', ['-C', repo, 'show', `${commit}:${p}`], { maxBuffer: 1 << 29 });

const matches = matchesFromDataset(dataset);
const t = buildBudgetRequestTrend({ datasetDir: dataset, matches });
const d = buildBudgetRequestJikouYoukyu({ datasetDir: dataset, matches, kouCsv: t.files['kou.csv'] });

const checks: [string, string, Buffer | string][] = [
  ...Object.entries(d.files).map(([name, text]): [string, string, string] => [name, `tests/fixtures/budget-request-jikou-youkyu/${name}`, text]),
  ['jikou.json.gz', 'public/data/v2/ui/budget-request-trend/jikou.json.gz', d.uiGz],
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
