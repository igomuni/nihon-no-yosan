/**
 * RS の支出先の CSV のデータセット（`rs-spend-v0`）を、個人名の可能性がある名前を伏せて、GitHub Releases に置く tar.gz にまとめる。仕様: docs/guides/rs-spend.md
 *
 * 使い方: node packages/pipeline/src/migrate/package-rs-spend.ts <RS の CSV のディレクトリ> <terms.json> <出力ディレクトリ> [リリースのタグ（既定 dataset-rs-spend-v0）]
 * - 入れるのは、5-1（支出情報）・5-2（支出ブロックのつながり）・5-3（費目・使途）・5-4（国庫債務負担行為等による契約）を、伏せた形にしたもの（列・行は元のまま。名前などの値だけ置き換える）と、`manifest.json`。
 * - 公開してよいのは、`terms.json` で `rssystem.go.jp` と `houjin-bangou.nta.go.jp` が、どちらも利用条件の本文を読んだ（`basis` = `page-read`）PDL1.0（`status` = `pdl1.0`）のとき。違えば止まる。
 * - 出力: `manifest.json`（ファイル名・SHA-256・バイト数・伏せた件数）、`rs-spend-v0.tar.gz`、`release.json`、確認用の `kept-names-without-corp-number.txt`（tar.gz には入れない）。
 *   tar.gz のバイト列は作るたびに変わりうるので、リリースに置いたものを正とする。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseCsv, readCsv, redactSpend, SPEND_KEYS, type Rec, type SpendKey } from '@nihon-no-yosan/core';

const [csvDir, termsPath, outDir, tag = 'dataset-rs-spend-v0'] = process.argv.slice(2);
if (!csvDir || !termsPath || !outDir) throw new Error('usage: package-rs-spend.ts <rsCsvDir> <terms.json> <outDir> [tag]');
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

const domains = (JSON.parse(fs.readFileSync(termsPath, 'utf8')) as { domains: Record<string, { status: string; basis: string }> }).domains;
for (const d of ['rssystem.go.jp', 'houjin-bangou.nta.go.jp']) {
  const t = domains[d];
  if (!t || t.status !== 'pdl1.0' || t.basis !== 'page-read') throw new Error(`${d} の利用条件が、公開してよい状態でない: ${JSON.stringify(t)}`);
}

const WANTED: Record<SpendKey, RegExp> = {
  '5-1': /^5-1_.*支出先_支出情報\.csv$/,
  '5-2': /^5-2_.*支出先_支出ブロックのつながり\.csv$/,
  '5-3': /^5-3_.*支出先_費目・使途\.csv$/,
  '5-4': /^5-4_.*支出先_国庫債務負担行為等による契約\.csv$/,
};
const fileOf = {} as Record<SpendKey, string>;
const header = {} as Record<SpendKey, string[]>;
const input = {} as Record<SpendKey, Rec[]>;
for (const k of SPEND_KEYS) {
  const hit = fs.readdirSync(csvDir).filter(f => WANTED[k].test(f));
  if (hit.length !== 1) throw new Error(`${WANTED[k]} に合うファイルが 1 つでない: ${hit.length}`);
  fileOf[k] = hit[0]!;
  const text = fs.readFileSync(path.join(csvDir, hit[0]!), 'utf8');
  input[k] = readCsv(text);
  header[k] = parseCsv(text.replace(/^\uFEFF/, ''))[0] ?? [];
}

const result = redactSpend(input);
const cell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

fs.mkdirSync(outDir, { recursive: true });
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-spend-v0-'));
const files: Record<string, { sha256: string; bytes: number; rows: number }> = {};
for (const k of SPEND_KEYS) {
  const lines = [header[k].map(cell).join(',')];
  for (const r of result.tables[k]) lines.push(header[k].map(h => cell(r[h] ?? '')).join(','));
  const b = Buffer.from('\uFEFF' + lines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(staging, fileOf[k]), b);
  files[fileOf[k]] = { sha256: sha256(b), bytes: b.length, rows: result.tables[k].length };
}

const manifest = {
  schema: 'nihon-no-yosan/rs-spend-manifest/v0',
  note: '行政事業レビュー見える化サイト（RS システム）の CSV（2025 年度版）のうち、支出先の 4 ファイル（5-1〜5-4）を、個人名の可能性がある名前を伏せて加工した。伏せた箇所は「非表示（個人名の可能性あり）」。機械的な規則による加工で、取りこぼしや、伏せすぎがありうる。出典: 行政事業レビュー見える化サイト（https://rssystem.go.jp）を加工して作成。法人番号は、国税庁法人番号公表サイト（国税庁）（https://www.houjin-bangou.nta.go.jp/）を加工して作成。利用条件: https://rssystem.go.jp/terms と https://www.houjin-bangou.nta.go.jp/riyokiyaku/（いずれも PDL1.0 に準拠）。加工したものを、国（府省庁）が作ったように見せない。取得日の記録は無い（docs/guides/rs-link.md）',
  source: { page: 'https://rssystem.go.jp/download-csv/2025', terms: ['https://rssystem.go.jp/terms', 'https://www.houjin-bangou.nta.go.jp/riyokiyaku/'] },
  redaction: result.report,
  files,
};
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 1) + '\n');
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifestBytes);
fs.writeFileSync(path.join(staging, 'manifest.json'), manifestBytes);
fs.writeFileSync(path.join(outDir, 'kept-names-without-corp-number.txt'), result.keptNames.map(([n, c]) => `${c}\t${n}`).join('\n') + '\n');

const list = [...Object.keys(files), 'manifest.json'].sort();
const listFile = path.join(staging, '.list');
fs.writeFileSync(listFile, list.join('\n') + '\n');
const tarPath = path.resolve(outDir, 'rs-spend-v0.tar.gz');
execFileSync('tar', ['-czf', tarPath, '--uid', '0', '--gid', '0', '-C', staging, '-T', listFile], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
fs.rmSync(staging, { recursive: true, force: true });
const tarBytes = fs.readFileSync(tarPath);
fs.writeFileSync(
  path.join(outDir, 'release.json'),
  JSON.stringify({ tag, asset: 'rs-spend-v0.tar.gz', sha256: sha256(tarBytes), bytes: tarBytes.length, manifestSha256: sha256(manifestBytes), files: list.length }, null, 1) + '\n',
);
console.log(`files: ${list.length}, tar.gz: ${tarBytes.length} bytes`);
console.log(JSON.stringify(result.report, null, 1));
