/**
 * 基準データを、公開できる分だけの tar.gz にまとめる（GitHub Releases に置く）。仕様: docs/guides/data.md
 *
 * 使い方: node packages/pipeline/src/migrate/package.ts <基準データのディレクトリ> <manifest> <出力ディレクトリ> [リリースのタグ（既定 dataset-reference-v0）]
 * - 公開するのは、利用条件が確かめられた（`basis` = `page-read` で、`status` が `unconfirmed` でない）書の分だけ。それ以外の書は、CSV・plain text を入れない。
 * - 年度ごとの `detail-table/unresolved.csv` は全機関の行が混ざっているので、入れない書の行（`source_file` が入れない書の plain text）を除く。
 * - 出力: `reference-v0.tar.gz`（中身は基準データのルートから。直下に公開分の `manifest.json`）、公開分の `manifest.json`（コミットして、CI が取り込みを照合する）、`release.json`（リリースのタグと、tar.gz の SHA-256）。
 * - 作った中身は、`verify.ts` と同じ照合を通す（公開分の manifest と一致）。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseCsv } from '@nihon-no-yosan/core';
import { sortedRecord, stringifyManifest, termsSummary, type FileEntry, type SourceRecord } from './dataset.ts';

const [datasetDir, manifestPath, outDir, tag = 'dataset-reference-v0'] = process.argv.slice(2);
if (!datasetDir || !manifestPath || !outDir) throw new Error('usage: package.ts <dataset> <manifest> <outDir>');

type Manifest = { files: Record<string, FileEntry>; sources: SourceRecord[]; summary: Record<string, unknown> } & Record<string, unknown>;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

const publishable = (s: SourceRecord): boolean => s.terms.basis === 'page-read' && s.terms.status !== 'unconfirmed';
const excludedSources = manifest.sources.filter(s => !publishable(s));
const excludedFiles = new Set(excludedSources.flatMap(s => Object.values(s.files)));
const excludedSlugs = new Set(excludedSources.map(s => `${s.year}/${s.slug}`));

const files: Record<string, FileEntry> = {};
for (const [rel, e] of Object.entries(manifest.files)) if (!excludedFiles.has(rel)) files[rel] = e;

// 入れない書の行を、unresolved.csv から除く（ヘッダは元のまま。値は元の文字列のまま、行ごとに書き直す）
const filteredUnresolved: Record<string, { before: number; after: number }> = {};
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-v0-'));
const put = (rel: string, bytes: Buffer): void => {
  fs.mkdirSync(path.dirname(path.join(staging, rel)), { recursive: true });
  fs.writeFileSync(path.join(staging, rel), bytes);
};
const csvCell = (v: string): string => (/[",\n\r]/u.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
for (const rel of Object.keys(files)) {
  const src = fs.readFileSync(path.join(datasetDir, rel));
  if (!rel.endsWith('/detail-table/unresolved.csv')) {
    put(rel, src);
    continue;
  }
  const year = rel.split('/')[1]!;
  const rows = parseCsv(src.toString('utf8'));
  const header = rows[0]!;
  const col = header.indexOf('source_file');
  if (col < 0) throw new Error(`source_file の列が無い: ${rel}`);
  const kept = rows.slice(1).filter(r => !excludedSlugs.has(`${year}/${path.basename(r[col] ?? '', '.txt')}`));
  filteredUnresolved[rel] = { before: rows.length - 1, after: kept.length };
  const out = Buffer.from([header, ...kept].map(r => r.map(csvCell).join(',')).join('\n') + '\n', 'utf8');
  put(rel, out);
  files[rel] = { sha256: sha256(out), bytes: out.length };
}

const sources = manifest.sources.filter(publishable);
const published = {
  note: '公開できる分（利用条件を本文で確かめた書）だけ。入れない書の CSV・plain text と、unresolved.csv のその書の行は含まない。pdf-corpus-freeze.json と plain-text-manifest.json は全 PDF の記録（URL・SHA-256）のまま',
  basedOnManifestSha256: sha256(fs.readFileSync(manifestPath)),
  excludedSources: excludedSources.map(s => ({ year: s.year, slug: s.slug, domain: s.domain, terms: s.terms })),
  unresolvedFiltered: filteredUnresolved,
};
const out = {
  ...manifest,
  summary: {
    ...manifest.summary,
    pdfSources: sources.length,
    sourcesByTerms: termsSummary(sources),
    files: Object.keys(files).length,
    bytes: Object.values(files).reduce((n, e) => n + e.bytes, 0),
  },
  published,
  files: sortedRecord(files),
  sources,
};
const manifestText = stringifyManifest(out);
put('manifest.json', Buffer.from(manifestText, 'utf8'));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifestText);
const list = [...Object.keys(files), 'manifest.json'].sort();
const listFile = path.join(staging, '.list');
fs.writeFileSync(listFile, list.join('\n') + '\n');
const tarPath = path.resolve(outDir, 'reference-v0.tar.gz');
execFileSync('tar', ['-czf', tarPath, '--uid', '0', '--gid', '0', '-C', staging, '-T', listFile], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
const tarBytes = fs.readFileSync(tarPath);
fs.writeFileSync(
  path.join(outDir, 'release.json'),
  JSON.stringify({ tag, asset: 'reference-v0.tar.gz', sha256: sha256(tarBytes), bytes: tarBytes.length, manifestSha256: sha256(Buffer.from(manifestText, 'utf8')), files: list.length }, null, 1) + '\n',
);
fs.rmSync(staging, { recursive: true, force: true });
console.log(`excluded sources: ${excludedSources.length}, files: ${list.length}, tar.gz: ${tarBytes.length} bytes`);
