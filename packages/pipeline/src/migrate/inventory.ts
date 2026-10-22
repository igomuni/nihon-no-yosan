/**
 * 前のリポジトリ（marumie-rssystem）の、基準データの候補の inventory（件数の記述だけ。仮説や閾値を持たない）。
 *
 * 使い方:
 *   node packages/pipeline/src/migrate/inventory.ts <前のリポジトリの作業ツリー> <ref> <出力の JSON>
 *   - fixtures は `git archive <ref> tests/fixtures/...` で読む（作業ツリーの版に依らない）。
 *   - `data/download/`（PDF）と `data/work/budget-request-plain-text/` は git の外なので、作業ツリーのものを読む。中身は SHA-256 と頁の区切りを数えるだけ。
 *
 * 数え方:
 *   - 行: `readCsv` のレコード数（ヘッダと空行を除く）。
 *   - 行の種類: `row_type` 列（表紙は `kind` 列。目次には無い）。
 *   - PDF: `budget-request-pdf-corpus/{年度}/pdf-corpus-freeze.json` の `documents`。
 *   - plain text の頁: ファイルの中の改頁（`\f`）の数。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readCsv } from '@nihon-no-yosan/core';

const [repo, ref, out] = process.argv.slice(2);
if (!repo || !ref || !out) throw new Error('usage: inventory.ts <repo> <ref> <out.json>');

const FIXTURES = ['budget-request-csv', 'mof-archive-csv', 'budget-request-pdf-corpus'];
const commit = execFileSync('git', ['-C', repo, 'rev-parse', ref], { encoding: 'utf8' }).trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-'));
const tar = execFileSync('git', ['-C', repo, 'archive', commit, ...FIXTURES.map(f => `tests/fixtures/${f}`)], {
  maxBuffer: 1 << 30,
});
execFileSync('tar', ['-x', '-C', tmp], { input: tar });
const FX = path.join(tmp, 'tests', 'fixtures');

const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const sha256File = (p: string): string => {
  const h = createHash('sha256');
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(1 << 20);
  let n: number;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest('hex');
};
const dirs = (p: string): string[] =>
  fs.existsSync(p) ? fs.readdirSync(p).filter(d => fs.statSync(path.join(p, d)).isDirectory()).sort() : [];
const filesIn = (p: string): string[] =>
  fs.existsSync(p) ? fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isFile()).sort() : [];
const tally = (xs: string[]): Record<string, number> => {
  const c: Record<string, number> = {};
  for (const x of xs) c[x] = (c[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => (a < b ? -1 : 1)));
};
/** PDF の localPdfPath → CSV・plain text の名前の元（`data/download/` を除き、`/` を `__` に、末尾の `.pdf` を除く） */
const slugOf = (localPdfPath: string): string =>
  localPdfPath.replace(/^data\/download\//, '').replaceAll('/', '__').replace(/\.pdf$/i, '');

interface PdfDoc {
  localPdfPath: string;
  pdfSha256: string;
  pageCount: number;
  acquisition?: string;
  kind: string;
  publisherDomain: string;
}
interface TextDoc {
  localPdfPath: string;
  textFile: string;
  textSha256: string;
  pageCount: number;
  status: string;
}

const inventory: Record<string, unknown> = {
  generatedFrom: { repository: 'igomuni/marumie-rssystem', ref, commit },
  definitions: {
    rows: 'readCsv のレコード数（ヘッダと空行を除く）',
    rowTypes: 'row_type 列（表紙は kind 列。目次には無い）',
    pdfs: 'pdf-corpus-freeze.json の documents',
    textPages: 'plain text のファイルの中の改頁（\\f）の数',
  },
};

// ---------------------------------------------------------------- 概算要求（年度ごと）
const requestYears: Record<string, unknown> = {};
for (const year of dirs(path.join(FX, 'budget-request-csv'))) {
  const base = path.join(FX, 'budget-request-csv', year);
  const freeze = JSON.parse(
    fs.readFileSync(path.join(FX, 'budget-request-pdf-corpus', year, 'pdf-corpus-freeze.json'), 'utf8'),
  ) as { documents: PdfDoc[] };
  const pdfs = freeze.documents;
  const slugs = new Set(pdfs.map(d => slugOf(d.localPdfPath)));
  const kinds: Record<string, unknown> = {};
  for (const kind of dirs(base)) {
    const src = path.join(base, kind, 'sources');
    const names = filesIn(src).filter(f => f.endsWith('.csv'));
    const rowTypes: string[] = [];
    let rows = 0;
    for (const f of names) {
      const recs = readCsv(fs.readFileSync(path.join(src, f), 'utf8'));
      rows += recs.length;
      for (const r of recs) rowTypes.push(r['row_type'] ?? r['kind'] ?? '(列なし)');
    }
    const side: Record<string, number | null> = {};
    for (const f of filesIn(path.join(base, kind))) {
      side[f] = f.endsWith('.csv') ? readCsv(fs.readFileSync(path.join(base, kind, f), 'utf8')).length : null;
    }
    kinds[kind] = {
      sourceFiles: names.length,
      sourceFilesWithoutPdf: names.filter(f => !slugs.has(f.slice(0, -4))).length,
      rows,
      rowTypes: tally(rowTypes),
      /** sources 以外のファイル（CSV は行数、ほかは null） */
      sideFiles: side,
    };
  }
  // 手元の PDF と plain text が、記録の SHA-256 と一致するか
  const textDir = path.join(repo, 'data', 'work', 'budget-request-plain-text', year);
  const textManifestPath = path.join(textDir, 'plain-text-manifest.json');
  const textDocs: TextDoc[] = fs.existsSync(textManifestPath)
    ? (JSON.parse(fs.readFileSync(textManifestPath, 'utf8')) as { documents: TextDoc[] }).documents
    : [];
  const pdfCheck = tally(
    pdfs.map(d => {
      const p = path.join(repo, d.localPdfPath);
      if (!fs.existsSync(p)) return 'missing';
      return sha256File(p) === d.pdfSha256 ? 'sha256_match' : 'sha256_differs';
    }),
  );
  const textCheck = tally(
    textDocs.map(d => {
      const p = path.join(textDir, d.textFile);
      if (!fs.existsSync(p)) return 'missing';
      const b = fs.readFileSync(p);
      const pages = b.toString('utf8').split('\f').length - 1;
      return `${sha(b) === d.textSha256 ? 'sha256_match' : 'sha256_differs'} / ${pages === d.pageCount ? 'pages_match' : 'pages_differ'}`;
    }),
  );
  requestYears[year] = {
    pdfs: {
      documents: pdfs.length,
      pages: pdfs.reduce((s, d) => s + d.pageCount, 0),
      bytes: pdfs.reduce((s, d) => s + ((d as unknown as { bytes?: number }).bytes ?? 0), 0),
      acquisition: tally(pdfs.map(d => d.acquisition ?? '(記録なし)')),
      kind: tally(pdfs.map(d => d.kind)),
      publisherDomains: Object.keys(tally(pdfs.map(d => d.publisherDomain))).length,
      localCheck: pdfCheck,
    },
    plainText: {
      manifest: fs.existsSync(textManifestPath),
      documents: textDocs.length,
      status: tally(textDocs.map(d => d.status)),
      textFilesWithoutPdf: textDocs.filter(d => !slugs.has(d.textFile.replace(/\.txt$/, ''))).length,
      localCheck: textCheck,
    },
    csv: kinds,
  };
}
inventory['budgetRequest'] = requestYears;

// ---------------------------------------------------------------- 予算書（版ごと）
const mofDir = path.join(FX, 'mof-archive-csv');
const mofManifest = JSON.parse(fs.readFileSync(path.join(mofDir, 'manifest.json'), 'utf8')) as Record<string, string>;
const mofVersions: Record<string, unknown> = {};
for (const ver of dirs(mofDir)) {
  const files: Record<string, unknown> = {};
  for (const f of filesIn(path.join(mofDir, ver))) {
    const b = fs.readFileSync(path.join(mofDir, ver, f));
    const recs = readCsv(b.toString('utf8'));
    files[f] = {
      rows: recs.length,
      columns: recs[0] ? Object.keys(recs[0]).length : 0,
      manifest: mofManifest[`${ver}/${f}`] === undefined ? 'not_listed' : mofManifest[`${ver}/${f}`] === sha(b) ? 'sha256_match' : 'sha256_differs',
    };
  }
  mofVersions[ver] = files;
}
inventory['mofArchive'] = mofVersions;

fs.writeFileSync(out, JSON.stringify(inventory, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} (commit ${commit})`);
