/**
 * 画面（apps/web）が読む JSON を、基準データからまとめて作る。
 *
 * 使い方: node packages/pipeline/src/build/web-data-cli.ts <基準データのディレクトリ> <出力ディレクトリ> [terms.json] [過去年度のデータセットのディレクトリ]
 * 基準データのディレクトリ直下の `manifest.json`（公開分の manifest でよい）と `terms.json` から、「出典と利用条件」の `about.json` も作る。
 * 出力:
 *   trend/{kou,jikou,detail}.json.gz   概算要求の年度推移（`docs/guides/trend.md`、`jikou-youkyu.md`、`trend-detail.md`）
 *   mof/{kou,detail}.json.gz           概算要求と当初予算の差（`docs/guides/mof-ui.md`）
 *   lifecycle/data.json.gz             予算の一生の表（`docs/guides/budget-lifecycle.md`）
 *   lifecycle/jikou.json.gz            予算の一生の画面の事項タブ用（`docs/guides/lifecycle-jikou.md`。タブを開いたときに読む）
 *   lifecycle/moku.json.gz             予算の一生の画面の目タブ用（`docs/guides/lifecycle-moku.md`。タブを開いたときに読む）
 *   about.json                         出典と利用条件（`docs/guides/web-publish.md`）
 * 出力ディレクトリは git に入れない（`.gitignore` の `data/`）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import type { SiteAbout, SiteAboutAuthority } from '@nihon-no-yosan/core';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildJikouLinkData } from './jikou-links.ts';
import { buildLifecycle, lifecycleRequestOnlyRows, lifecycleSources, sameYearPairsOf } from './lifecycle.ts';
import { buildLifecycleJikou, mofRowKouIds, requestOnlyJikou } from './lifecycle-jikou.ts';
import { buildLifecycleMoku, requestOnlyMoku } from './lifecycle-moku.ts';
import { buildBudgetRequestMofUi, mofUiMatchesFromDataset } from './mof-ui.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const [dataset, outDir, termsPath = path.join('datasets', 'terms.json'), historyArg] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: web-data-cli.ts <dataset> <outDir> [terms.json] [historyDataset]');
// 過去年度のデータセット（FY2017〜FY2022。`docs/guides/mof-history.md`）は、ディレクトリがあるときだけ使う（無ければ FY2023 以降だけ）
const historyDir = historyArg && fs.existsSync(historyArg) ? historyArg : undefined;

const fail = (msg: string): never => { throw new Error(msg); };
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

const gz = (v: unknown): Buffer => zlib.gzipSync(JSON.stringify(v), { level: 9, mtime: 0 } as zlib.ZlibOptions);
const requestOnlyRows = lifecycleRequestOnlyRows(mof.data.rows, mof.data.urls, matches, lifecycleSources(historyDir));
const lifecycle = buildLifecycle({ datasetDir: dataset, historyDir, requestOfMofRow: mof.requestOfMofRow, requestOnlyRows });
// 事項（当初予算・補正・概算要求）。項に結べない事項、予算書の事項に置けない要求額があれば止まる（捨てない）
const jikouData = buildJikouLinkData(dataset, historyDir);
const kouIdOfMofRow = mofRowKouIds(dataset);
const lifecycleJikou = buildLifecycleJikou(
  jikouData,
  lifecycle.kous,
  lifecycle.links,
  {
    matched: new Map([...mof.jikouOfMofRow].map(([row, v]) => [kouIdOfMofRow.get(row) ?? fail(`予算書の項の行が無い: ${row}`), v])),
    requestOnly: requestOnlyJikou(requestOnlyRows, mof.details, detail.files['jikou.csv'] ?? fail('no jikou.csv'), sameYearPairsOf(lifecycle)),
  },
);
if (Object.keys(lifecycleJikou.unmatched).length > 0) throw new Error(`項に結べない事項がある: ${JSON.stringify(lifecycleJikou.unmatched)}`);
if (lifecycleJikou.unplaced > 0) throw new Error(`予算書の事項に置けない概算要求の事項がある: ${lifecycleJikou.unplaced}`);
// 目（当初予算・補正・決算・概算要求）。目の項が予算の一生の表に無ければ止まる
const lifecycleMoku = buildLifecycleMoku({
  datasetDir: dataset,
  historyDir,
  sources: lifecycleSources(historyDir),
  kous: lifecycle.kous,
  request: new Map([
    ...[...mof.mokuOfMofRow].map(([row, v]) => [kouIdOfMofRow.get(row) ?? fail(`予算書の項の行が無い: ${row}`), v] as const),
    ...requestOnlyMoku(requestOnlyRows, mof.details, new Map([...Object.keys(detail.files)].flatMap(f => { const y = /^moku\/(\d{4})\.csv$/.exec(f); return y ? [[Number(y[1]), detail.files[f]!] as const] : []; })), sameYearPairsOf(lifecycle)),
  ]),
});

const outputs: [string, Buffer][] = [
  ['trend/kou.json.gz', trend.uiGz],
  ['trend/jikou.json.gz', jikou.uiGz],
  ['trend/detail.json.gz', detail.uiGz],
  ['mof/kou.json.gz', mof.kouGz],
  ['mof/detail.json.gz', mof.detailGz],
  ['lifecycle/data.json.gz', gz(lifecycle)],
  ['lifecycle/jikou.json.gz', gz(lifecycleJikou.data)],
  ['lifecycle/moku.json.gz', gz(lifecycleMoku.data)],
];
for (const [name, bytes] of outputs) {
  fs.mkdirSync(path.dirname(path.join(outDir, name)), { recursive: true });
  fs.writeFileSync(path.join(outDir, name), bytes);
}

// 出典と利用条件: 取り込んだ書の機関と、機関ごとの利用規約のページ
type TermsDomain = { authority: string; status: string; url: string };
const terms = (JSON.parse(fs.readFileSync(termsPath, 'utf8')) as { domains: Record<string, TermsDomain> }).domains;
const manifest = JSON.parse(fs.readFileSync(path.join(dataset, 'manifest.json'), 'utf8')) as {
  version: string;
  summary: { files: number };
  sources: { domain: string }[];
};
const books = new Map<string, number>();
for (const s of manifest.sources) books.set(s.domain, (books.get(s.domain) ?? 0) + 1);
const authorities: SiteAboutAuthority[] = [...books]
  .map(([domain, n]) => {
    const t = terms[domain];
    if (!t) throw new Error(`terms.json にドメインが無い: ${domain}`);
    if (t.status !== 'pdl1.0' && t.status !== 'diet-courts') throw new Error(`公開できない状態のドメインが含まれる: ${domain} (${t.status})`);
    return { authority: t.authority, domain, status: t.status as SiteAboutAuthority['status'], termsUrl: t.url, books: n };
  })
  .sort((a, b) => b.books - a.books || a.domain.localeCompare(b.domain));
const bb = terms['bb.mof.go.jp'];
if (!bb) throw new Error('terms.json に bb.mof.go.jp が無い');
const about: SiteAbout = {
  dataset: { version: manifest.version, books: manifest.sources.length, files: manifest.summary.files },
  authorities,
  budgetBook: { authority: '財務省 予算書・決算書データベース', domain: 'bb.mof.go.jp', termsUrl: bb.url },
};
fs.writeFileSync(path.join(outDir, 'about.json'), JSON.stringify(about, null, 1) + '\n');
console.log(`wrote ${outputs.length + 1} files to ${outDir}`);
console.log(`目: ${JSON.stringify(lifecycleMoku.stats)}`);
