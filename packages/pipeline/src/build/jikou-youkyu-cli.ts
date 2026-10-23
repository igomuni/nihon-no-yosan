/**
 * 概算要求の「金額を示さない要求」（事項要求など）の候補を作って、出力ディレクトリに書く。
 *
 * 使い方: node packages/pipeline/src/build/jikou-youkyu-cli.ts <基準データのディレクトリ> <出力ディレクトリ>
 * 出力: kou.csv、marks.csv、summary.json、jikou.json.gz（画面用）。項の年度推移（`kou.csv`）は、この中で作り直して入力にする
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';

const [dataset, outDir] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: jikou-youkyu-cli.ts <dataset> <outDir>');

const matches = matchesFromDataset(dataset);
const kou = buildBudgetRequestTrend({ datasetDir: dataset, matches });
const r = buildBudgetRequestJikouYoukyu({ datasetDir: dataset, matches, kouCsv: kou.files['kou.csv'] });
fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of Object.entries(r.files)) fs.writeFileSync(path.join(outDir, name), text);
fs.writeFileSync(path.join(outDir, 'jikou.json.gz'), r.uiGz);
console.log(`wrote ${Object.keys(r.files).length + 1} files to ${outDir}`);
