/**
 * 前のリポジトリ（marumie-rssystem）から、基準データ（reference dataset）の初版を作る。仕様: docs/guides/data.md
 *
 * 使い方:
 *   node packages/pipeline/src/migrate/freeze.ts <前のリポジトリの作業ツリー> <commit> <出力ディレクトリ> <manifest の出力先> <terms.json>
 *
 * - fixtures（概算要求の CSV、予算書の CSV、PDF の記録）は `git archive <commit>` で読む。
 * - plain text は git の外（作業ツリーの `data/work/budget-request-plain-text/`）。PDF は SHA-256 を照合するだけで、コピーしない。
 * - コピーはバイト同一。記録の SHA-256 と合わないものがあれば、止まる（黙って飛ばさない）。
 * - 出力ディレクトリは、無いか空であること。
 *
 * 入れるもの: 概算要求の CSV（cover・toc・total-table・detail-table の sources）、detail-table/unresolved.csv、PDF の記録、plain text とその記録、予算書の CSV とその記録。
 * 入れないもの（診断・研究の出力）は、manifest の `excluded` に件数を残す。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  excludedGroup,
  slugOf,
  sortedRecord,
  stringifyManifest,
  termsOf,
  termsSummary,
  type FileEntry,
  type SourceRecord,
  type TermsFile,
} from './dataset.ts';

const [repo, ref, outDir, manifestOut, termsPath] = process.argv.slice(2);
if (!repo || !ref || !outDir || !manifestOut || !termsPath) {
  throw new Error('usage: freeze.ts <repo> <commit> <outDir> <manifestOut> <terms.json>');
}
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) throw new Error(`出力ディレクトリが空でない: ${outDir}`);

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const sha256File = (p: string): string => {
  const h = createHash('sha256');
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(1 << 20);
  let n: number;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest('hex');
};
const listFiles = (dir: string, rel = ''): string[] =>
  fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listFiles(dir, path.join(rel, e.name)) : [path.join(rel, e.name)],
  );
const subdirs = (p: string): string[] =>
  fs.existsSync(p) ? fs.readdirSync(p).filter(d => fs.statSync(path.join(p, d)).isDirectory()).sort() : [];

const commit = execFileSync('git', ['-C', repo, 'rev-parse', ref], { encoding: 'utf8' }).trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freeze-'));
execFileSync('tar', ['-x', '-C', tmp], {
  input: execFileSync(
    'git',
    ['-C', repo, 'archive', commit, 'tests/fixtures/budget-request-csv', 'tests/fixtures/mof-archive-csv', 'tests/fixtures/budget-request-pdf-corpus'],
    { maxBuffer: 1 << 30 },
  ),
});
const FX = path.join(tmp, 'tests', 'fixtures');
const terms = JSON.parse(fs.readFileSync(termsPath, 'utf8')) as TermsFile;

const files: Record<string, FileEntry> = {};
/** バイト列を出力ディレクトリに書き、manifest の files に足す */
const put = (rel: string, bytes: Buffer): void => {
  if (files[rel]) throw new Error(`同じパスを 2 回書こうとした: ${rel}`);
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  files[rel] = { sha256: sha256(bytes), bytes: bytes.length };
};

const KINDS = ['cover', 'toc', 'total-table', 'detail-table'] as const;
const sources: SourceRecord[] = [];
const excluded: Record<string, number> = {};
const included = new Set<string>();

interface FreezeDoc {
  localPdfPath: string;
  sourceUrl: string;
  publisherDomain: string;
  publisherAuthority: string;
  pdfSha256: string;
  bytes?: number;
  pageCount: number;
  acquisition?: string;
}
interface TextDoc {
  localPdfPath: string;
  textFile: string;
  textSha256: string;
  pageCount: number;
  status: string;
}

// ---------------------------------------------------------------- 概算要求
for (const year of subdirs(path.join(FX, 'budget-request-csv')).filter(d => /^\d{4}$/.test(d))) {
  const base = path.join(FX, 'budget-request-csv', year);
  const freezeBytes = fs.readFileSync(path.join(FX, 'budget-request-pdf-corpus', year, 'pdf-corpus-freeze.json'));
  const docs = (JSON.parse(freezeBytes.toString('utf8')) as { documents: FreezeDoc[] }).documents;
  put(`budget-request/${year}/pdf-corpus-freeze.json`, freezeBytes);

  // plain text（git の外）: 記録と照合してコピーする
  const textDir = path.join(repo, 'data', 'work', 'budget-request-plain-text', year);
  const textManifestBytes = fs.readFileSync(path.join(textDir, 'plain-text-manifest.json'));
  const textDocs = new Map(
    (JSON.parse(textManifestBytes.toString('utf8')) as { documents: TextDoc[] }).documents.map(d => [slugOf(d.localPdfPath), d]),
  );
  put(`budget-request/${year}/plain-text-manifest.json`, textManifestBytes);

  const bySlug = new Map(docs.map(d => [slugOf(d.localPdfPath), d]));
  if (bySlug.size !== docs.length) throw new Error(`${year}: slug が重複している`);

  const csvOf = new Map<string, Record<string, string>>();
  for (const kind of KINDS) {
    const src = path.join(base, kind, 'sources');
    for (const f of fs.existsSync(src) ? fs.readdirSync(src).sort() : []) {
      if (!f.endsWith('.csv')) throw new Error(`sources に CSV でないファイルがある: ${year}/${kind}/${f}`);
      const slug = f.slice(0, -4);
      if (!bySlug.has(slug)) throw new Error(`${year}/${kind}/${f}: PDF の一覧に無い`);
      const rel = `budget-request/${year}/${kind}/sources/${f}`;
      put(rel, fs.readFileSync(path.join(src, f)));
      included.add(path.join('budget-request-csv', year, kind, 'sources', f));
      (csvOf.get(slug) ?? csvOf.set(slug, {}).get(slug)!)[kind] = rel;
    }
  }
  const unresolved = path.join(base, 'detail-table', 'unresolved.csv');
  put(`budget-request/${year}/detail-table/unresolved.csv`, fs.readFileSync(unresolved));
  included.add(path.join('budget-request-csv', year, 'detail-table', 'unresolved.csv'));

  for (const d of docs) {
    const slug = slugOf(d.localPdfPath);
    const t = termsOf(terms, d.publisherDomain);
    // 手元の PDF を記録の SHA-256 と照合する（コピーはしない）
    const pdfPath = path.join(repo, d.localPdfPath);
    if (!fs.existsSync(pdfPath)) throw new Error(`${year}: 手元に PDF が無い: ${d.localPdfPath}`);
    if (sha256File(pdfPath) !== d.pdfSha256) throw new Error(`${year}: PDF の SHA-256 が記録と違う: ${d.localPdfPath}`);
    const rec: Record<string, string> = { ...(csvOf.get(slug) ?? {}) };
    let textOk: boolean | null = null;
    const td = textDocs.get(slug);
    if (td) {
      const bytes = fs.readFileSync(path.join(textDir, td.textFile));
      const pages = bytes.toString('utf8').split('\f').length - 1;
      if (sha256(bytes) !== td.textSha256 || pages !== td.pageCount) throw new Error(`${year}: plain text が記録と違う: ${td.textFile}`);
      put(`budget-request/${year}/plain-text/${td.textFile}`, bytes);
      rec['plain-text'] = `budget-request/${year}/plain-text/${td.textFile}`;
      textOk = true;
    }
    sources.push({
      year,
      slug,
      domain: d.publisherDomain,
      authority: d.publisherAuthority,
      sourceUrl: d.sourceUrl,
      pdf: { sha256: d.pdfSha256, bytes: d.bytes ?? null, pageCount: d.pageCount, acquisition: d.acquisition ?? null },
      evidence: {
        pdfLocalHashMatchesRecord: true,
        pdfComparedWithOfficialSite: false,
        plainTextMatchesRecord: textOk,
        csvLinkedToPdfBy: 'file-name',
      },
      terms: { status: t.status, basis: t.basis },
      files: sortedRecord(rec),
    });
  }
  if (textDocs.size !== [...textDocs.keys()].filter(k => bySlug.has(k)).length) throw new Error(`${year}: PDF の一覧に無い plain text がある`);

  // 入れなかったファイル
  for (const f of listFiles(base)) {
    if (included.has(path.join('budget-request-csv', year, f))) continue;
    const g = excludedGroup(f);
    excluded[g] = (excluded[g] ?? 0) + 1;
  }
}

// ---------------------------------------------------------------- 予算書
const mofDir = path.join(FX, 'mof-archive-csv');
const mofRecord = JSON.parse(fs.readFileSync(path.join(mofDir, 'manifest.json'), 'utf8')) as Record<string, string>;
put('mof-archive/manifest.json', fs.readFileSync(path.join(mofDir, 'manifest.json')));
let mofFiles = 0;
for (const ver of subdirs(mofDir)) {
  for (const f of fs.readdirSync(path.join(mofDir, ver)).sort()) {
    const bytes = fs.readFileSync(path.join(mofDir, ver, f));
    if (mofRecord[`${ver}/${f}`] !== sha256(bytes)) throw new Error(`予算書の CSV が記録と違う: ${ver}/${f}`);
    put(`mof-archive/${ver}/${f}`, bytes);
    mofFiles++;
  }
}
const mofTerms = termsOf(terms, 'bb.mof.go.jp');

// ---------------------------------------------------------------- manifest
const manifest = {
  schema: 'nihon-no-yosan/reference-dataset-manifest/v0',
  dataset: 'reference',
  version: 'v0',
  origin: {
    repository: 'igomuni/marumie-rssystem',
    commit,
    note: 'fixtures は git archive、plain text は作業ツリー（git の外）から、バイト同一でコピーした。',
  },
  termsFile: { path: 'datasets/terms.json', sha256: sha256(fs.readFileSync(termsPath)) },
  definitions: {
    evidence:
      'pdfLocalHashMatchesRecord: 手元の PDF の SHA-256 が前のリポジトリの記録と一致した。pdfComparedWithOfficialSite: 公式サイトから取り直して比べたか。csvLinkedToPdfBy: CSV と PDF の対応の根拠。',
    acquisition: 'manual の PDF は、前のリポジトリの記録の上で、原本とのバイト同一性を照合できない。',
  },
  summary: {
    pdfSources: sources.length,
    mofArchiveFiles: mofFiles,
    mofArchiveTerms: { domain: 'bb.mof.go.jp', status: mofTerms.status, basis: mofTerms.basis },
    sourcesByTerms: termsSummary(sources),
    files: Object.keys(files).length,
    bytes: Object.values(files).reduce((s, e) => s + e.bytes, 0),
  },
  excluded: sortedRecord(excluded),
  files,
  sources,
};
const text = stringifyManifest(manifest);
fs.writeFileSync(path.join(outDir, 'manifest.json'), text);
fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
fs.writeFileSync(manifestOut, text);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify(manifest.summary, null, 1));
