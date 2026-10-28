/**
 * RS（行政事業レビュー）の CSV のデータセット（`rs-v0`）を、GitHub Releases に置く tar.gz にまとめる。仕様: docs/guides/web-publish.md
 *
 * 使い方: node packages/pipeline/src/migrate/package-rs.ts <RS の CSV のディレクトリ> <terms.json> <出力ディレクトリ> [リリースのタグ（既定 dataset-rs-v0）]
 * - 入れるのは、画面のデータ作り（`web-data-cli.ts`）に使う 3 ファイル（1-2 事業概要等、2-1 予算・執行サマリ、2-2 予算種別・歳出予算項目）を、そのまま（手を加えずに）と、`manifest.json`。ほかの CSV は入れない。
 * - 公開してよいのは、`terms.json` で `rssystem.go.jp` が、利用条件の本文を読んだ（`basis` = `page-read`）PDL1.0（`status` = `pdl1.0`）のとき。違えば止まる。
 * - 出力: `manifest.json`（ファイル名・SHA-256・バイト数。`datasets/rs-v0/manifest.json` に置く）、`rs-v0.tar.gz`、`release.json`（タグ・tar.gz の SHA-256・バイト数・manifest の SHA-256・ファイル数）。
 *   tar の並びは決まっているが、tar.gz のバイト列は作るたびに変わりうるので、リリースに置いたものを正とする。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const [csvDir, termsPath, outDir, tag = 'dataset-rs-v0'] = process.argv.slice(2);
if (!csvDir || !termsPath || !outDir) throw new Error('usage: package-rs.ts <rsCsvDir> <terms.json> <outDir> [tag]');
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

const rs = (JSON.parse(fs.readFileSync(termsPath, 'utf8')) as { domains: Record<string, { status: string; basis: string }> }).domains['rssystem.go.jp'];
if (!rs || rs.status !== 'pdl1.0' || rs.basis !== 'page-read') throw new Error(`rssystem.go.jp の利用条件が、公開してよい状態でない: ${JSON.stringify(rs)}`);

const WANTED = [/^1-2_.*基本情報_事業概要等\.csv$/, /^2-1_.*予算・執行_サマリ\.csv$/, /^2-2_.*予算・執行_予算種別・歳出予算項目\.csv$/];
const names = WANTED.map(re => {
  const hit = fs.readdirSync(csvDir).filter(f => re.test(f));
  if (hit.length !== 1) throw new Error(`${re} に合うファイルが 1 つでない: ${hit.length}`);
  return hit[0]!;
}).sort();
const files: Record<string, { sha256: string; bytes: number }> = {};
for (const n of names) { const b = fs.readFileSync(path.join(csvDir, n)); files[n] = { sha256: sha256(b), bytes: b.length }; }

fs.mkdirSync(outDir, { recursive: true });
const manifest = {
  schema: 'nihon-no-yosan/rs-manifest/v0',
  note: '行政事業レビュー見える化サイト（RS システム）の CSV（2025 年度版）のうち、画面のデータ作りに使う 3 ファイルを、手を加えずに入れた。出典: 行政事業レビュー見える化サイト（https://rssystem.go.jp）。利用条件: https://rssystem.go.jp/terms（PDL1.0 に準拠）。取得日の記録は無い（サイトのページに「データは 2026 年 1 月 19 日時点」とある版と同じかは未確認。docs/guides/rs-link.md）',
  source: { page: 'https://rssystem.go.jp/download-csv/2025', terms: 'https://rssystem.go.jp/terms' },
  files,
};
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 1) + '\n');
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifestBytes);

// tar.gz は、CSV と manifest.json を同じ階層に置く（展開先 `data/download/rs/2025/`）。macOS の拡張属性・UID を入れない
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-v0-'));
for (const n of names) fs.copyFileSync(path.join(csvDir, n), path.join(staging, n));
fs.copyFileSync(path.join(outDir, 'manifest.json'), path.join(staging, 'manifest.json'));
const list = [...names, 'manifest.json'].sort();
const listFile = path.join(staging, '.list');
fs.writeFileSync(listFile, list.join('\n') + '\n');
const tarPath = path.resolve(outDir, 'rs-v0.tar.gz');
execFileSync('tar', ['-czf', tarPath, '--uid', '0', '--gid', '0', '-C', staging, '-T', listFile], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
fs.rmSync(staging, { recursive: true, force: true });
const tarBytes = fs.readFileSync(tarPath);
fs.writeFileSync(
  path.join(outDir, 'release.json'),
  JSON.stringify({ tag, asset: 'rs-v0.tar.gz', sha256: sha256(tarBytes), bytes: tarBytes.length, manifestSha256: sha256(manifestBytes), files: list.length }, null, 1) + '\n',
);
console.log(`files: ${list.length}, tar.gz: ${tarBytes.length} bytes`);
