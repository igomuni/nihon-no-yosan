/**
 * 概算要求と当初予算の差の画面用データを、前のリポジトリに commit されている出力と、バイト単位で比べる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-mof-ui.ts <基準データのディレクトリ> <前のリポジトリの作業ツリー> <commit> <結果の JSON>
 * - 比較先: `tests/fixtures/budget-request-mof/summary.json`、`public/data/v2/ui/budget-request-mof/{kou,detail}.json.gz`。
 * - 入力の項の年度推移・事項要求の検知・事項と目の年度推移は、基準データから作り直したものを使う（それぞれの比較は `compare-trend.ts` ほか）。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestJikouYoukyu } from '../build/jikou-youkyu.ts';
import { buildBudgetRequestMofUi, mofUiMatchesFromDataset } from '../build/mof-ui.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from '../build/trend.ts';
import { buildBudgetRequestTrendDetail } from '../build/trend-detail.ts';

const [dataset, repo, commit, resultPath] = process.argv.slice(2);
if (!dataset || !repo || !commit || !resultPath) throw new Error('usage: compare-mof-ui.ts <dataset> <repo> <commit> <result.json>');

const sha = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const gitShow = (p: string): Buffer => execFileSync('git', ['-C', repo, 'show', `${commit}:${p}`], { maxBuffer: 1 << 29 });

const matches = matchesFromDataset(dataset);
const kouCsv = buildBudgetRequestTrend({ datasetDir: dataset, matches }).files['kou.csv'];
const jikou = buildBudgetRequestJikouYoukyu({ datasetDir: dataset, matches, kouCsv });
const detail = buildBudgetRequestTrendDetail({ datasetDir: dataset, matches, kouCsv });
const r = buildBudgetRequestMofUi({
  datasetDir: dataset,
  matches,
  mofMatches: mofUiMatchesFromDataset(dataset),
  trendKouCsv: kouCsv,
  jikouKouCsv: jikou.files['kou.csv'],
  jikouUi: jikou.ui,
  detailFiles: detail.files,
});

const checks: [string, string, Buffer | string][] = [
  ['summary.json', 'tests/fixtures/budget-request-mof/summary.json', r.files['summary.json']],
  ['kou.json.gz', 'public/data/v2/ui/budget-request-mof/kou.json.gz', r.kouGz],
  ['detail.json.gz', 'public/data/v2/ui/budget-request-mof/detail.json.gz', r.detailGz],
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
