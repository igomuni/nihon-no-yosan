/**
 * 概算要求の事項・目の年度推移を作って、出力ディレクトリに書く。
 *
 * 使い方: node packages/pipeline/src/build/trend-detail-cli.ts <基準データのディレクトリ> <出力ディレクトリ>
 * 出力: jikou.csv、moku/{年度}.csv、detail-summary.json、detail.json.gz（画面用）。項の年度推移（`kou.csv`）は、この中で作り直して入力にする
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const [dataset, outDir] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: trend-detail-cli.ts <dataset> <outDir>');

const matches = matchesFromDataset(dataset);
const kou = buildBudgetRequestTrend({ datasetDir: dataset, matches });
const r = buildBudgetRequestTrendDetail({ datasetDir: dataset, matches, kouCsv: kou.files['kou.csv'] });
for (const [name, text] of Object.entries(r.files)) {
  fs.mkdirSync(path.dirname(path.join(outDir, name)), { recursive: true });
  fs.writeFileSync(path.join(outDir, name), text);
}
fs.writeFileSync(path.join(outDir, 'detail.json.gz'), r.uiGz);
console.log(`wrote ${Object.keys(r.files).length + 1} files to ${outDir}`);
