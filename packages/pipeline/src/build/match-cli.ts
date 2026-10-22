/**
 * 突合 M0〜M3 を動かして、出力ディレクトリに書く。
 *
 * 使い方: node packages/pipeline/src/build/match-cli.ts <基準データのディレクトリ> <概算要求の年度> <予算書の版> <出力ディレクトリ>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildMofBudgetRequestMatch } from './match.ts';

const [dataset, year, ver, outDir] = process.argv.slice(2);
if (!dataset || !year || !ver || !outDir) throw new Error('usage: match-cli.ts <dataset> <year> <ver> <outDir>');

const { files } = buildMofBudgetRequestMatch({
  requestDir: path.join(dataset, 'budget-request', year),
  mofDir: path.join(dataset, 'mof-archive', ver),
  year,
  ver,
});
fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), text);
console.log(`wrote ${Object.keys(files).length} files to ${outDir}`);
