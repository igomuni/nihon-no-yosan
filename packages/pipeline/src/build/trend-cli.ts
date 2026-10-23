/**
 * 概算要求の年度推移（項）を作って、出力ディレクトリに書く。
 *
 * 使い方: node packages/pipeline/src/build/trend-cli.ts <基準データのディレクトリ> <出力ディレクトリ>
 * 出力: kou.csv、summary.json、kou.json.gz（画面用）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';

const [dataset, outDir] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: trend-cli.ts <dataset> <outDir>');

const r = buildBudgetRequestTrend({ datasetDir: dataset, matches: matchesFromDataset(dataset) });
fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of Object.entries(r.files)) fs.writeFileSync(path.join(outDir, name), text);
fs.writeFileSync(path.join(outDir, 'kou.json.gz'), r.uiGz);
console.log(`wrote ${Object.keys(r.files).length + 1} files to ${outDir}`);
