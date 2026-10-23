/**
 * 画面（apps/web）が読む JSON を、基準データからまとめて作る。
 *
 * 使い方: node packages/pipeline/src/build/web-data-cli.ts <基準データのディレクトリ> <出力ディレクトリ> [terms.json]
 * 基準データのディレクトリ直下の `manifest.json`（公開分の manifest でよい）と `terms.json` から、「出典と利用条件」の `about.json` も作る。
 * 出力:
 *   trend/{kou,jikou,detail}.json.gz   概算要求の年度推移（`docs/guides/trend.md`、`jikou-youkyu.md`、`trend-detail.md`）
 *   mof/{kou,detail}.json.gz           概算要求と当初予算の差（`docs/guides/mof-ui.md`）
 *   lifecycle/data.json.gz             予算の一生の表（`docs/guides/budget-lifecycle.md`）
 *   about.json                         出典と利用条件（`docs/guides/web-publish.md`）
 * 出力ディレクトリは git に入れない（`.gitignore` の `data/`）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import type { SiteAbout, SiteAboutAuthority } from '@nihon-no-yosan/core';
import { buildBudgetRequestJikouYoukyu } from './jikou-youkyu.ts';
import { buildLifecycle } from './lifecycle.ts';
import { buildBudgetRequestMofUi, mofUiMatchesFromDataset } from './mof-ui.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';
import { buildBudgetRequestTrendDetail } from './trend-detail.ts';

const [dataset, outDir, termsPath = path.join('datasets', 'terms.json')] = process.argv.slice(2);
if (!dataset || !outDir) throw new Error('usage: web-data-cli.ts <dataset> <outDir> [terms.json]');

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
  ['lifecycle/data.json.gz', zlib.gzipSync(JSON.stringify(buildLifecycle({ datasetDir: dataset, requestOfMofRow: mof.requestOfMofRow, requestOnlyRows: mof.data.rows })), { level: 9, mtime: 0 } as zlib.ZlibOptions)],
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
