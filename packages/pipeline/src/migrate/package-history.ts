/**
 * 過去年度のデータセット（`mof-history-v0`）を、GitHub Releases に置く tar.gz にまとめる。仕様: docs/guides/web-publish.md
 *
 * 使い方: node packages/pipeline/src/migrate/package-history.ts <過去年度のデータセットのディレクトリ> <manifest> <terms.json> <出力ディレクトリ> [リリースのタグ（既定 dataset-mof-history-v0）]
 * - 入れるのは、manifest に載る全ファイル（財務省の予算書・決算書データベースの公式 CSV・XML から作った CSV）と、`manifest.json`。
 * - 公開してよいのは、`terms.json` で `bb.mof.go.jp` が、利用条件の本文を読んだ（`basis` = `page-read`）PDL1.0（`status` = `pdl1.0`）のとき。違えば止まる。
 * - 作る前に、ディレクトリが manifest と全件一致することを確かめる（`verify.ts` と同じ照合）。
 * - 出力: `mof-history-v0.tar.gz`、`release.json`（タグ・tar.gz の SHA-256・バイト数・manifest の SHA-256・ファイル数）。tar の並びは決まっているが、tar.gz のバイト列は作るたびに変わりうるので、リリースに置いたものを正とする。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const [datasetDir, manifestPath, termsPath, outDir, tag = 'dataset-mof-history-v0'] = process.argv.slice(2);
if (!datasetDir || !manifestPath || !termsPath || !outDir) throw new Error('usage: package-history.ts <dataset> <manifest> <terms.json> <outDir> [tag]');
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

const bb = (JSON.parse(fs.readFileSync(termsPath, 'utf8')) as { domains: Record<string, { status: string; basis: string }> }).domains['bb.mof.go.jp'];
if (!bb || bb.status !== 'pdl1.0' || bb.basis !== 'page-read') throw new Error(`bb.mof.go.jp の利用条件が、公開してよい状態でない: ${JSON.stringify(bb)}`);

const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8')) as { files: Record<string, { sha256: string; bytes: number }> };
const rels = Object.keys(manifest.files).sort();
for (const rel of rels) {
  const b = fs.readFileSync(path.join(datasetDir, rel));
  const e = manifest.files[rel]!;
  if (b.length !== e.bytes || sha256(b) !== e.sha256) throw new Error(`manifest と違う: ${rel}`);
}
if (!fs.readFileSync(path.join(datasetDir, 'manifest.json')).equals(manifestBytes)) throw new Error('ディレクトリの manifest.json が、渡した manifest と違う');

fs.mkdirSync(outDir, { recursive: true });
const list = [...rels, 'manifest.json'].sort();
const listFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mof-history-')), '.list');
fs.writeFileSync(listFile, list.join('\n') + '\n');
const tarPath = path.resolve(outDir, 'mof-history-v0.tar.gz');
execFileSync('tar', ['-czf', tarPath, '--uid', '0', '--gid', '0', '-C', datasetDir, '-T', listFile], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
fs.rmSync(path.dirname(listFile), { recursive: true, force: true });
const tarBytes = fs.readFileSync(tarPath);
fs.writeFileSync(
  path.join(outDir, 'release.json'),
  JSON.stringify({ tag, asset: 'mof-history-v0.tar.gz', sha256: sha256(tarBytes), bytes: tarBytes.length, manifestSha256: sha256(manifestBytes), files: list.length }, null, 1) + '\n',
);
console.log(`files: ${list.length}, tar.gz: ${tarBytes.length} bytes`);
