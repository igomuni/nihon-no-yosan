/**
 * 概算要求書の表紙の CSV を、plain text から作る（表紙の頁は頁分類で決める）。
 *
 * 使い方: node packages/pipeline/src/extract/cover-cli.ts <基準データのディレクトリ> <年度> <出力ディレクトリ>
 * 出力: sources/{slug}.csv、unclassified.csv、summary.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCover } from './cover.ts';
import { classifyYear } from './page-classification.ts';

const [dataset, yearArg, outDir] = process.argv.slice(2);
if (!dataset || !yearArg || !outDir) throw new Error('usage: cover-cli.ts <dataset> <year> <outDir>');
if (!/^\d{4}$/.test(yearArg)) throw new Error(`year must be a 4-digit fiscal year: ${yearArg}`);
const files = buildCover({ datasetDir: dataset, year: Number(yearArg), records: classifyYear(dataset, Number(yearArg)) });
for (const [name, content] of Object.entries(files)) {
  const dest = path.join(outDir, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}
console.log(`wrote ${Object.keys(files).length} files to ${outDir}`);
