/**
 * 概算要求書の PDF から、頁ごとに区切った plain text（pdftotext -layout）を作る。仕様: docs/guides/extract.md
 *
 * 使い方: node packages/pipeline/src/extract/plain-text-cli.ts <基準データのディレクトリ> <年度> <PDF の置き場> <出力ディレクトリ>
 * - PDF の一覧は `<基準データ>/budget-request/{年度}/pdf-corpus-freeze.json`。PDF の置き場は、記録の `localPdfPath` の先頭 `data/download/` に当たるディレクトリ
 * - PDF の SHA-256 と頁数が記録と違えば止まる（読み取り専用。処理の前後で PDF が変わっていないことも確かめる）
 * - pdftotext と pdfinfo（poppler）が要る
 * 出力: {slug}.txt、plain-text-manifest.json
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertUniqueSlugs, sha256, splitAndValidatePdfText } from './plain-text.ts';

const [dataset, yearArg, pdfRoot, outDir] = process.argv.slice(2);
if (!dataset || !yearArg || !pdfRoot || !outDir) throw new Error('usage: plain-text-cli.ts <dataset> <year> <pdfRoot> <outDir>');
if (!/^\d{4}$/.test(yearArg)) throw new Error(`year must be a 4-digit fiscal year: ${yearArg}`);
const year = Number(yearArg);

interface FrozenDocument { localPdfPath: string; pdfSha256: string; pageCount: number; pageTextSha256?: string[] }
const freezePath = path.join(dataset, 'budget-request', yearArg, 'pdf-corpus-freeze.json');
const freezeBytes = fs.readFileSync(freezePath);
const frozen = JSON.parse(freezeBytes.toString('utf8')) as { documents: FrozenDocument[] };

const slugs = assertUniqueSlugs(frozen.documents.map(d => d.localPdfPath));
const pdfPathOf = (localPdfPath: string): string => {
  if (!localPdfPath.startsWith('data/download/')) throw new Error(`unexpected localPdfPath: ${localPdfPath}`);
  return path.join(pdfRoot, localPdfPath.slice('data/download/'.length));
};

fs.mkdirSync(outDir, { recursive: true });
let pages = 0;
const produced: unknown[] = [];
for (const record of frozen.documents) {
  const file = pdfPathOf(record.localPdfPath);
  const before = sha256(fs.readFileSync(file));
  if (before !== record.pdfSha256) throw new Error(`source PDF SHA-256 differs from the frozen record: ${record.localPdfPath}`);
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const match = /^Pages:\s+(\d+)/m.exec(info);
  if (!match) throw new Error(`pdfinfo did not report the page count: ${record.localPdfPath}`);
  const pageCount = Number(match[1]);
  if (pageCount !== record.pageCount) throw new Error(`pdfinfo page count differs from the frozen record: ${record.localPdfPath}`);
  const result = spawnSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: null, maxBuffer: 1 << 30 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pdftotext failed for ${record.localPdfPath}: ${result.stderr?.toString('utf8') ?? ''}`);
  const chunks = splitAndValidatePdfText(result.stdout, pageCount, record.pageTextSha256);
  const after = sha256(fs.readFileSync(file));
  if (after !== before) throw new Error(`source PDF changed during extraction: ${record.localPdfPath}`);
  const textFile = `${slugs.get(record.localPdfPath)}.txt`;
  fs.writeFileSync(path.join(outDir, textFile), result.stdout);
  pages += chunks.length;
  produced.push({
    localPdfPath: record.localPdfPath, textFile, pdfSha256: before, pageCount,
    status: chunks.every(c => c.toString('utf8').trim() === '') ? 'EMPTY' : 'EXTRACTED',
    textSha256: sha256(result.stdout), pageTextSha256: chunks.map(c => sha256(c)),
  });
}
fs.writeFileSync(path.join(outDir, 'plain-text-manifest.json'), JSON.stringify({
  schema: 'budget-request-plain-text-manifest/v0',
  fiscalYear: year,
  frozenPdfCorpus: { path: path.relative(dataset, freezePath), sha256: sha256(freezeBytes) },
  extraction: { tool: spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).stderr.split('\n')[0], args: ['-layout', '-enc', 'UTF-8'] },
  physicalPdfs: produced.length,
  physicalPages: pages,
  documents: produced,
}, null, 2) + '\n');
console.log(`wrote ${produced.length} files (${pages} pages) to ${outDir}`);
