/**
 * 突合 M0〜M3 の出力を、前のリポジトリに commit されている出力と、バイト単位で比べる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-match.ts <基準データのディレクトリ> <前のリポジトリの作業ツリー> <commit> <結果の JSON>
 * - 新しい実装の入力は基準データ。比較先は `git show <commit>:tests/fixtures/mof-budget-request-match/{版}/{ファイル}`。
 * - 組（概算要求の年度, 予算書の版）は、前のリポジトリの `docs/mof-budget-request-match.md` の対応。
 * - 1 つでも違えば、一覧を出して終了コード 1。結果の JSON には、組ごとの入力の SHA-256（summary.json の input_sha256）と、ファイルごとの SHA-256 を残す。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { buildMofBudgetRequestMatch } from '../build/match.ts';
import * as path from 'node:path';

const [dataset, repo, commit, resultPath] = process.argv.slice(2);
if (!dataset || !repo || !commit || !resultPath) throw new Error('usage: compare-match.ts <dataset> <repo> <commit> <result.json>');

/** [概算要求の年度, 予算書の版]。FY2025 は提出時（2025_teishutsu）と成立後（2025）の 2 つ */
const PAIRS: [string, string][] = [
  ['2023', '2023'],
  ['2024', '2024'],
  ['2025', '2025'],
  ['2025', '2025_teishutsu'],
  ['2026', '2026'],
];
const sha = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');
const gitShow = (p: string): Buffer =>
  execFileSync('git', ['-C', repo, 'show', `${commit}:${p}`], { maxBuffer: 1 << 29 });
const oldNames = (dir: string): string[] =>
  execFileSync('git', ['-C', repo, 'ls-tree', '--name-only', `${commit}:${dir}`], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();

const result: Record<string, unknown> = {
  comparedWith: { repository: 'igomuni/marumie-rssystem', commit, path: 'tests/fixtures/mof-budget-request-match/{版}/' },
  manifest: { path: 'datasets/reference-v0/manifest.json', sha256: sha(fs.readFileSync(path.join('datasets', 'reference-v0', 'manifest.json'))) },
  pairs: {},
};
const problems: string[] = [];
for (const [year, ver] of PAIRS) {
  const { files } = buildMofBudgetRequestMatch({
    requestDir: path.join(dataset, 'budget-request', year),
    mofDir: path.join(dataset, 'mof-archive', ver),
    year,
    ver,
  });
  const dir = `tests/fixtures/mof-budget-request-match/${ver}`;
  const names = oldNames(dir);
  const entries: Record<string, { sha256: string; bytes: number; equal: boolean }> = {};
  for (const name of names) {
    const old = gitShow(`${dir}/${name}`);
    const mine = files[name];
    const equal = mine !== undefined && Buffer.from(mine).equals(old);
    entries[name] = { sha256: sha(old), bytes: old.length, equal };
    if (!equal) problems.push(`${year}→${ver}/${name}`);
  }
  for (const name of Object.keys(files)) if (!names.includes(name)) problems.push(`${year}→${ver}/${name}: 前のリポジトリに無い`);
  (result['pairs'] as Record<string, unknown>)[`${year}→${ver}`] = {
    inputSha256: (JSON.parse(files['summary.json']!) as { input_sha256: string }).input_sha256,
    files: entries,
  };
}
result['allEqual'] = problems.length === 0;
fs.mkdirSync(path.dirname(resultPath), { recursive: true });
fs.writeFileSync(resultPath, JSON.stringify(result, null, 1) + '\n');
if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} 件の違い`);
  process.exit(1);
}
const n = Object.values(result['pairs'] as Record<string, { files: object }>).reduce((s, p) => s + Object.keys(p.files).length, 0);
console.log(`OK: ${PAIRS.length} 組、${n} ファイルがバイト一致`);
