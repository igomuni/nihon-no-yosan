/**
 * 調達ポータルの落札実績のデータセット（`p-portal-v0`）を、GitHub Releases に置く tar.gz にまとめる。仕様: docs/guides/procurement.md、web-publish.md
 *
 * 使い方: node packages/pipeline/src/migrate/package-procurement.ts <取り込みのディレクトリ（data/download/p-portal）> <terms.json> <出力ディレクトリ> [リリースのタグ（既定 dataset-p-portal-v0）]
 * - 入れるのは、取り込んだ zip を展開した CSV（手を加えずに。年度ごと）と、`manifest.json`。zip そのものと、仕様書の PDF は入れない（PDF は、コード表 `datasets/p-portal-code-tables/` に必要な分を写してある）。
 * - 公開してよいのは、`terms.json` で `p-portal.go.jp` が、利用条件の本文を読んだ（`basis` = `page-read`）政府標準利用規約 第 2.0 版（`status` = `gov-terms-2.0`）のとき。違えば止まる。
 * - 取り込みの記録（`<取り込みのディレクトリ>/manifest.json`）と、zip・CSV の SHA-256・行数を照合し、合わなければ止まる。
 * - 出力: `manifest.json`（`datasets/p-portal-v0/manifest.json` に置く）、`p-portal-v0.tar.gz`、`release.json`（タグ・tar.gz の SHA-256・バイト数・manifest の SHA-256・ファイル数）。
 *   tar の並びは決まっているが、tar.gz のバイト列は作るたびに変わりうるので、リリースに置いたものを正とする。
 * - 手元でも、同じ出力を `data/dataset/p-portal-v0/` に展開して、`build:data` に渡す（`tar -xzf <出力>/p-portal-v0.tar.gz -C data/dataset/p-portal-v0`）。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { procurementDataset, type ProcurementDownloadManifest } from '../build/procurement.ts';

const [dlDir, termsPath, outDir, tag = 'dataset-p-portal-v0'] = process.argv.slice(2);
if (!dlDir || !termsPath || !outDir) throw new Error('usage: package-procurement.ts <downloadDir> <terms.json> <outDir> [tag]');
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

const t = (JSON.parse(fs.readFileSync(termsPath, 'utf8')) as { domains: Record<string, { status: string; basis: string }> }).domains['p-portal.go.jp'];
if (!t || t.status !== 'gov-terms-2.0' || t.basis !== 'page-read') throw new Error(`p-portal.go.jp の利用条件が、公開してよい状態でない: ${JSON.stringify(t)}`);

const dl = JSON.parse(fs.readFileSync(path.join(dlDir, 'manifest.json'), 'utf8')) as ProcurementDownloadManifest;
const zips = new Map(dl.files.map(f => [Number(/_all_(\d{4})\.zip$/.exec(f.file)?.[1]), fs.readFileSync(path.join(dlDir, f.file))] as const));
const { csvs, manifest } = procurementDataset(zips, dl);

fs.mkdirSync(outDir, { recursive: true });
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 1) + '\n');
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifestBytes);

// tar.gz は、CSV と manifest.json を同じ階層に置く（展開先 `data/dataset/p-portal-v0/`）。macOS の拡張属性・UID を入れない
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'p-portal-v0-'));
for (const [name, bytes] of csvs) fs.writeFileSync(path.join(staging, name), bytes);
fs.writeFileSync(path.join(staging, 'manifest.json'), manifestBytes);
const list = [...csvs.keys(), 'manifest.json'].sort();
const listFile = path.join(staging, '.list');
fs.writeFileSync(listFile, list.join('\n') + '\n');
const tarPath = path.resolve(outDir, 'p-portal-v0.tar.gz');
execFileSync('tar', ['-czf', tarPath, '--uid', '0', '--gid', '0', '-C', staging, '-T', listFile], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
fs.rmSync(staging, { recursive: true, force: true });
const tarBytes = fs.readFileSync(tarPath);
fs.writeFileSync(
  path.join(outDir, 'release.json'),
  JSON.stringify({ tag, asset: 'p-portal-v0.tar.gz', sha256: sha256(tarBytes), bytes: tarBytes.length, manifestSha256: sha256(manifestBytes), files: list.length }, null, 1) + '\n',
);
console.log(`files: ${list.length}, rows: ${Object.values(manifest.files).reduce((n, f) => n + f.rows, 0)}, tar.gz: ${tarBytes.length} bytes`);
