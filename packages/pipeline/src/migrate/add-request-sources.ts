/**
 * 基準データ（reference dataset）に、凍結の後で見つかった概算要求書を足す。仕様: docs/guides/data.md、extract.md
 *
 * 使い方:
 *   node packages/pipeline/src/migrate/add-request-sources.ts <基準データのディレクトリ> <manifest> <terms.json> <年度> <抽出の出力ディレクトリ> <追補の日付 YYYY-MM-DD> <追補の説明>
 *
 * 前提: `<基準データ>/budget-request/{年度}/pdf-corpus-freeze.json` に、足す書の記録が入っている（manifest の sources に無い書が、足す書）。
 * 抽出の出力ディレクトリには、`docs/guides/extract.md` の手順で、その年度を作り直した出力（plain-text/・plain-text-manifest.json は plain-text/ の中・total-table/・detail-table/・cover/・toc/）が入っている。
 * - 足す書の plain text・総表・明細表・表紙・目次の CSV を、基準データにバイトのままコピーし、manifest の files・sources に足す。
 * - その年度の `pdf-corpus-freeze.json`・`plain-text-manifest.json`・`detail-table/unresolved.csv` は、新しい版で置き換える（新しい版が、既存の書の分を変えていないことを、先に確かめる）。
 * - 既存の書の CSV・plain text が、抽出の出力と 1 バイトでも違えば止まる（足すだけで、既存の書は変えない）。
 * - manifest の書式の往復（読んで書き戻して同じ）と、全ファイルの SHA-256 を確かめる。合わなければ止まる。
 * - summary（書の数・ファイル数・バイト数・利用条件ごとの数）と origin.additions を更新する。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { slugOf, stringifyManifest, termsOf, termsSummary, type FileEntry, type SourceRecord, type TermsFile } from './dataset.ts';

const [dataset, manifestPath, termsPath, yearArg, outRoot, addedOn, addedNote] = process.argv.slice(2);
if (!dataset || !manifestPath || !termsPath || !yearArg || !outRoot || !addedOn || !addedNote) throw new Error('usage: add-request-sources.ts <dataset> <manifest> <terms.json> <year> <extractOut> <date> <note>');
if (!/^\d{4}$/.test(yearArg) || !/^\d{4}-\d{2}-\d{2}$/.test(addedOn)) throw new Error('year は 4 桁、date は YYYY-MM-DD');

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const KINDS = ['cover', 'toc', 'total-table', 'detail-table'] as const;
const yearDir = `budget-request/${yearArg}`;

interface FreezeDoc { localPdfPath: string; sourceUrl: string; publisherDomain: string; publisherAuthority: string; pdfSha256: string; bytes: number; pageCount: number; acquisition: string }
interface Manifest {
  origin: Record<string, unknown> & { additions?: unknown[] };
  summary: { pdfSources: number; files: number; bytes: number; sourcesByTerms: Record<string, number> } & Record<string, unknown>;
  files: Record<string, FileEntry>;
  sources: (SourceRecord & { addition?: { date: string; note: string } })[];
}
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
if (stringifyManifest(manifest as never) !== manifestBytes.toString('utf8')) throw new Error('manifest の書式が、読んで書き戻すと同じにならない（先にそこを直す）');
const terms = JSON.parse(fs.readFileSync(termsPath, 'utf8')) as TermsFile;

const freezeNew = fs.readFileSync(path.join(dataset, yearDir, 'pdf-corpus-freeze.json'));
const docs = (JSON.parse(freezeNew.toString('utf8')) as { documents: FreezeDoc[] }).documents;
const known = new Set(manifest.sources.filter(s => s.year === yearArg).map(s => s.slug));
const added = docs.filter(d => !known.has(slugOf(d.localPdfPath)));
if (added.length === 0) throw new Error('足す書が無い（凍結記録の書は、すべて manifest にある）');
for (const s of known) if (!docs.some(d => slugOf(d.localPdfPath) === s)) throw new Error(`manifest にある書が、凍結記録に無い: ${s}`);

const files = manifest.files;
const copy = (rel: string, src: string, overwrite: boolean): void => {
  const bytes = fs.readFileSync(src);
  const dest = path.join(dataset, rel);
  if (!overwrite && files[rel]) throw new Error(`既にある: ${rel}`);
  if (!overwrite && fs.existsSync(dest)) throw new Error(`既にファイルがある: ${rel}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  files[rel] = { sha256: sha256(bytes), bytes: bytes.length };
};

// 1. 既存の書の CSV・plain text が、抽出の出力と同じことを確かめる（足すだけ）
const textOut = path.join(outRoot, 'plain-text');
for (const [rel, e] of Object.entries(files)) {
  const m = new RegExp(`^${yearDir}/(plain-text|cover/sources|toc/sources|total-table/sources|detail-table/sources)/(.+)$`).exec(rel);
  if (!m) continue;
  const src = m[1] === 'plain-text' ? path.join(textOut, m[2]!) : path.join(outRoot, m[1]!.replace('/sources', ''), 'sources', m[2]!);
  if (!fs.existsSync(src)) throw new Error(`抽出の出力に、既存のファイルが無い: ${rel}`);
  if (sha256(fs.readFileSync(src)) !== e.sha256) throw new Error(`抽出の出力が、既存のファイルと違う（既存の書は変えない）: ${rel}`);
}
const oldTextManifest = JSON.parse(fs.readFileSync(path.join(dataset, yearDir, 'plain-text-manifest.json'), 'utf8')) as { documents: { localPdfPath: string }[] };
const newTextManifest = JSON.parse(fs.readFileSync(path.join(textOut, 'plain-text-manifest.json'), 'utf8')) as { documents: { localPdfPath: string }[] };
const oldByPath = new Map(oldTextManifest.documents.map(d => [d.localPdfPath, JSON.stringify(d)]));
for (const d of newTextManifest.documents) if (oldByPath.has(d.localPdfPath) && oldByPath.get(d.localPdfPath) !== JSON.stringify(d)) throw new Error(`plain-text-manifest.json の既存の書の記録が違う: ${d.localPdfPath}`);

// 2. 足す書
const newSources: SourceRecord[] = [];
for (const d of added) {
  const slug = slugOf(d.localPdfPath);
  const t = termsOf(terms, d.publisherDomain);
  if (t.basis !== 'page-read' || t.status === 'unconfirmed') throw new Error(`利用条件が確かめられていないドメイン: ${d.publisherDomain}`);
  const rels: Record<string, string> = {};
  const textRel = `${yearDir}/plain-text/${slug}.txt`;
  copy(textRel, path.join(textOut, `${slug}.txt`), false);
  rels['plain-text'] = textRel;
  for (const kind of KINDS) {
    const src = path.join(outRoot, kind, 'sources', `${slug}.csv`);
    if (!fs.existsSync(src)) continue;
    const rel = `${yearDir}/${kind}/sources/${slug}.csv`;
    copy(rel, src, false);
    rels[kind] = rel;
  }
  newSources.push({
    year: yearArg, slug, domain: d.publisherDomain, authority: d.publisherAuthority, sourceUrl: d.sourceUrl,
    pdf: { sha256: d.pdfSha256, bytes: d.bytes, pageCount: d.pageCount, acquisition: d.acquisition },
    evidence: { pdfLocalHashMatchesRecord: true, pdfComparedWithOfficialSite: false, plainTextMatchesRecord: true, csvLinkedToPdfBy: 'file-name' },
    terms: { status: t.status, basis: t.basis },
    files: Object.fromEntries(Object.entries(rels).sort(([a], [b]) => (a < b ? -1 : 1))),
    addition: { date: addedOn, note: addedNote },
  } as SourceRecord);
}

// 3. 置き換える 3 ファイル（凍結記録は置き場に既にある。plain-text-manifest と unresolved は抽出の出力から）
files[`${yearDir}/pdf-corpus-freeze.json`] = { sha256: sha256(freezeNew), bytes: freezeNew.length };
copy(`${yearDir}/plain-text-manifest.json`, path.join(textOut, 'plain-text-manifest.json'), true);
copy(`${yearDir}/detail-table/unresolved.csv`, path.join(outRoot, 'detail-table', 'unresolved.csv'), true);

// 4. manifest の更新
manifest.sources = [...manifest.sources, ...newSources].sort((a, b) => (a.year < b.year ? -1 : a.year > b.year ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
manifest.summary.pdfSources = manifest.sources.length;
manifest.summary.files = Object.keys(files).length;
manifest.summary.bytes = Object.values(files).reduce((n, e) => n + e.bytes, 0);
manifest.summary.sourcesByTerms = termsSummary(manifest.sources);
manifest.origin.additions = [...(manifest.origin.additions ?? []), { date: addedOn, year: yearArg, sources: newSources.length, note: addedNote }];
fs.writeFileSync(manifestPath, stringifyManifest(manifest as never));
fs.copyFileSync(manifestPath, path.join(dataset, 'manifest.json'));

// 5. 全ファイルの SHA-256 を、書いた manifest と照合する
const problems: string[] = [];
for (const [rel, e] of Object.entries(files)) {
  const p = path.join(dataset, rel);
  if (!fs.existsSync(p)) { problems.push(`無い: ${rel}`); continue; }
  const b = fs.readFileSync(p);
  if (b.length !== e.bytes || sha256(b) !== e.sha256) problems.push(`合わない: ${rel}`);
}
if (problems.length > 0) throw new Error(`照合に失敗: ${problems.slice(0, 10).join(', ')}（${problems.length} 件）`);
console.log(`added ${newSources.length} sources (${Object.values(files).length} files in total), manifest: ${manifestPath}`);
for (const s of newSources) console.log(`  ${s.slug}: ${Object.keys(s.files).join(', ')}`);
