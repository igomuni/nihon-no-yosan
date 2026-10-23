/**
 * 予算の一生の表を CSV で出力する。仕様（案）: docs/guides/budget-lifecycle.md
 *
 * 使い方: node packages/pipeline/src/build/lifecycle-cli.ts <基準データのディレクトリ> <出力ディレクトリ>
 * 出力: kou.csv、events.csv、checks.json（項の識別、値ごとの出来事、検算の結果）。概算要求の額は、概算要求と当初予算の差の build（`mof-ui.ts`）から取る
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildLifecycle } from './lifecycle.ts';
import { buildBudgetRequestMofUi, mofUiMatchesFromDataset } from './mof-ui.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const [dataset, outDir] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: lifecycle-cli.ts <dataset> <outDir>');

const matches = matchesFromDataset(dataset);
const kouCsv = buildBudgetRequestTrend({ datasetDir: dataset, matches }).files['kou.csv'];
const jikou = buildBudgetRequestJikouYoukyu({ datasetDir: dataset, matches, kouCsv });
const detail = buildBudgetRequestTrendDetail({ datasetDir: dataset, matches, kouCsv });
const mof = buildBudgetRequestMofUi({ datasetDir: dataset, matches, mofMatches: mofUiMatchesFromDataset(dataset), trendKouCsv: kouCsv, jikouKouCsv: jikou.files['kou.csv'], jikouUi: jikou.ui, detailFiles: detail.files });
const data = buildLifecycle({ datasetDir: dataset, requestOfMofRow: mof.requestOfMofRow, requestOnlyRows: mof.data.rows });

const cell = (v: unknown): string => {
  const s = String(v);
  return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header: string[], rows: unknown[][]): string => [header, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'kou.csv'),
  toCsv(
    ['kou_id', 'year', 'account', 'ministry', 'org', 'special_account', 'sub_account', 'code', 'name', 'seen_in'],
    data.kous.map(k => [k.id, k.year, k.account, k.ministry, k.org, k.specialAccount, k.subAccount, k.code, k.name, k.seenIn.join(';')]),
  ),
);
fs.writeFileSync(
  path.join(outDir, 'events.csv'),
  toCsv(
    ['kou_id', 'event', 'version', 'seq', 'part', 'measure', 'value_orig', 'unit_orig', 'value_yen', 'state', 'source', 'note'],
    data.events.map(([i, ...rest]) => [data.kous[i]!.id, ...rest.slice(0, 5), ...rest.slice(5)]),
  ),
);
fs.writeFileSync(
  path.join(outDir, 'links.csv'),
  toCsv(
    ['from_kou_id', 'to_kou_id', 'evidence', 'amount', 'status'],
    data.links.map(l => [l.from < 0 ? '' : data.kous[l.from]!.id, l.to < 0 ? '' : data.kous[l.to]!.id, l.evidence.join(';'), l.amount, l.status]),
  ),
);
fs.writeFileSync(path.join(outDir, 'checks.json'), JSON.stringify(data.checks, null, 1) + '\n');
console.log(`kou ${data.kous.length}, events ${data.events.length}, links ${data.links.length}`);
