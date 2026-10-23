/**
 * PDF から作り直した plain text を、基準データの plain text と、バイト単位で比べる。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-plain-text.ts <基準データのディレクトリ> <PDF の置き場> <結果の JSON>
 * - 年度 2023〜2027 について、`extract/plain-text-cli.ts` を一時ディレクトリに動かし、`.txt` を基準データの `plain-text/` と比べる。
 * - `plain-text-manifest.json` は、凍結した PDF の一覧の置き場の文字列（`frozenPdfCorpus.path`）だけ違うので、それを除いて比べる。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const [dataset, pdfRoot, resultPath] = process.argv.slice(2);
if (!dataset || !pdfRoot || !resultPath) throw new Error('usage: compare-plain-text.ts <dataset> <pdfRoot> <result.json>');

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const cli = path.join(import.meta.dirname, '..', 'extract', 'plain-text-cli.ts');
const manifestWithoutPath = (file: string): string => {
  const o = JSON.parse(fs.readFileSync(file, 'utf8')) as { frozenPdfCorpus: { path?: string } };
  delete o.frozenPdfCorpus.path;
  return JSON.stringify(o);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-text-'));
const years: Record<string, { files: number; allEqual: boolean }> = {};
const problems: string[] = [];
try {
  for (const year of [2023, 2024, 2025, 2026, 2027]) {
    const out = path.join(tmp, String(year));
    execFileSync('node', [cli, dataset, String(year), pdfRoot, out], { stdio: ['ignore', 'ignore', 'inherit'] });
    const ref = path.join(dataset, 'budget-request', String(year), 'plain-text');
    const names = fs.readdirSync(ref).filter(f => f.endsWith('.txt')).sort();
    const made = fs.readdirSync(out).filter(f => f.endsWith('.txt')).sort();
    let equal = names.length === made.length && names.every((n, i) => n === made[i]);
    for (const n of names) {
      const same = made.includes(n) && sha(fs.readFileSync(path.join(ref, n))) === sha(fs.readFileSync(path.join(out, n)));
      if (!same) { equal = false; problems.push(`${year}/${n}`); }
    }
    if (manifestWithoutPath(path.join(dataset, 'budget-request', String(year), 'plain-text-manifest.json')) !== manifestWithoutPath(path.join(out, 'plain-text-manifest.json'))) {
      equal = false;
      problems.push(`${year}/plain-text-manifest.json`);
    }
    years[year] = { files: names.length, allEqual: equal };
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const result = {
  manifest: { path: 'datasets/reference-v0/manifest.json', sha256: sha(fs.readFileSync(path.join('datasets', 'reference-v0', 'manifest.json'))) },
  years,
  allEqual: problems.length === 0,
};
fs.writeFileSync(resultPath, JSON.stringify(result, null, 1) + '\n');
console.log(problems.length === 0 ? 'all equal' : `DIFFERENT:\n${problems.join('\n')}`);
if (problems.length) process.exit(1);
