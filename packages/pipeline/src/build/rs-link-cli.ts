/**
 * RS の事業を、予算書の項・目につなぐ（`rs-link.ts`）。仕様: docs/guides/rs-link.md
 *
 * 使い方: node packages/pipeline/src/build/rs-link-cli.ts <RS の CSV のディレクトリ> <予算の一生のデータのディレクトリ（lifecycle/）> <出力ディレクトリ>
 * 入力: `2-2_*_予算・執行_予算種別・歳出予算項目.csv`（RS）、`data.json.gz`（項）・`moku.json.gz`（目）（`npm run build:data` の出力）
 * 出力: rs-link.csv（行ごとのつなぎ）、rs-link-stats.json（年度ごと・状態ごとの行数など）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { nameKey, readCsv, type LifecycleKou, type LifecycleMokuData } from '@nihon-no-yosan/core';
import { buildRsLink } from './rs-link.ts';

const [rsDir, lifecycleDir, outDir] = process.argv.slice(2);
if (!rsDir || !lifecycleDir || !outDir) throw new Error('usage: rs-link-cli.ts <rsDir> <lifecycleDir> <outDir>');

const file = fs.readdirSync(rsDir).find(f => /^2-2_.*予算・執行_予算種別・歳出予算項目\.csv$/.test(f));
if (!file) throw new Error(`2-2 の CSV が無い: ${rsDir}`);
const gunzip = <T>(f: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(lifecycleDir, f))).toString('utf8')) as T;
const { kous } = gunzip<{ kous: LifecycleKou[] }>('data.json.gz');
const moku = gunzip<LifecycleMokuData>('moku.json.gz');
const mokuKeys = new Set(moku.nodes.map(n => `${moku.kous[n[0]]!}|${nameKey(n[2])}`));

const { rows, stats } = buildRsLink(readCsv(fs.readFileSync(path.join(rsDir, file), 'utf8')), kous, (kouId, key) => mokuKeys.has(`${kouId}|${key}`));

const cell = (v: unknown): string => {
  const s = String(v);
  return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'rs-link.csv'),
  [['rs_id', 'year', 'kind', 'status', 'kou_id', 'moku', 'moku_hit', 'yen'], ...rows.map(r => [r.id, r.year, r.kind, r.status, r.kouId, r.moku, r.mokuHit ? 1 : 0, r.yen ?? ''])].map(r => r.map(cell).join(',')).join('\n') + '\n',
);
fs.writeFileSync(path.join(outDir, 'rs-link-stats.json'), JSON.stringify(stats, null, 1) + '\n');
console.log(`rows ${rows.length}`);
console.log(JSON.stringify(stats));
