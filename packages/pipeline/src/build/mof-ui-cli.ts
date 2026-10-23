/**
 * 概算要求と当初予算の差の画面用データを作って、出力ディレクトリに書く。
 *
 * 使い方: node packages/pipeline/src/build/mof-ui-cli.ts <基準データのディレクトリ> <出力ディレクトリ>
 * 出力: kou.json.gz、detail.json.gz（画面用）、summary.json。入力にする項の年度推移・事項要求の検知・事項と目の年度推移は、この中で作り直す
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildBudgetRequestMofUi, mofUiMatchesFromDataset } from './mof-ui.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const [dataset, outDir] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: mof-ui-cli.ts <dataset> <outDir>');

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
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), r.files['summary.json']);
fs.writeFileSync(path.join(outDir, 'kou.json.gz'), r.kouGz);
fs.writeFileSync(path.join(outDir, 'detail.json.gz'), r.detailGz);
console.log(`wrote 3 files to ${outDir}`);
