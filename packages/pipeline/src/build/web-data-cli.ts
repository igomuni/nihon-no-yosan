/**
 * 画面（apps/web）が読む JSON を、基準データからまとめて作る。
 *
 * 使い方: node packages/pipeline/src/build/web-data-cli.ts <基準データのディレクトリ> <出力ディレクトリ>
 * 出力:
 *   trend/{kou,jikou,detail}.json.gz   概算要求の年度推移（`docs/guides/trend.md`、`jikou-youkyu.md`、`trend-detail.md`）
 *   mof/{kou,detail}.json.gz           概算要求と当初予算の差（`docs/guides/mof-ui.md`）
 * 出力ディレクトリは git に入れない（`.gitignore` の `data/`）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildBudgetRequestMofUi, mofUiMatchesFromDataset } from './mof-ui.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const [dataset, outDir] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: web-data-cli.ts <dataset> <outDir>');

const matches = matchesFromDataset(dataset);
const trend = buildBudgetRequestTrend({ datasetDir: dataset, matches });
const kouCsv = trend.files['kou.csv'];
const jikou = buildBudgetRequestJikouYoukyu({ datasetDir: dataset, matches, kouCsv });
const detail = buildBudgetRequestTrendDetail({ datasetDir: dataset, matches, kouCsv });
const mof = buildBudgetRequestMofUi({
  datasetDir: dataset,
  matches,
  mofMatches: mofUiMatchesFromDataset(dataset),
  trendKouCsv: kouCsv,
  jikouKouCsv: jikou.files['kou.csv'],
  jikouUi: jikou.ui,
  detailFiles: detail.files,
});

const outputs: [string, Buffer][] = [
  ['trend/kou.json.gz', trend.uiGz],
  ['trend/jikou.json.gz', jikou.uiGz],
  ['trend/detail.json.gz', detail.uiGz],
  ['mof/kou.json.gz', mof.kouGz],
  ['mof/detail.json.gz', mof.detailGz],
];
for (const [name, bytes] of outputs) {
  fs.mkdirSync(path.dirname(path.join(outDir, name)), { recursive: true });
  fs.writeFileSync(path.join(outDir, name), bytes);
}
console.log(`wrote ${outputs.length} files to ${outDir}`);
