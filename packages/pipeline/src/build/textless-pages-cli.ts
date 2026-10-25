/**
 * 概算要求書の、文字が取れない頁の一覧（CSV）を作る。仕様: docs/guides/textless-pages.md
 *
 * 使い方: node packages/pipeline/src/build/textless-pages-cli.ts <基準データのディレクトリ> <PDF の置き場> <黒塗り頁の CSV> <出力の CSV>
 * - 文字が取れない頁 = plain text の頁が空白だけ（文字が 0）の頁。文字のない書（`status: EMPTY`）は全頁。
 * - 頁の内容は、25dpi のグレー画像（`pdftoppm`）に非白の画素が無ければ `白紙`、あれば `pdfimages -list` に画像のある頁は `画像`、無ければ `描画のみ`（文字が曲線などで描かれている頁）。いずれも poppler。頁が属する項は、概算要求の項の表の開始頁から決める（`core/redacted-pages.ts` の `kouOfPage`）。
 * - 黒塗り頁の CSV（`redacted-pages-cli.ts` の出力）にある頁は、黒い面の大きさを添える。
 * - 出力の列: 年度、要求書、PDF 頁、文字のない範囲（書全体 / 頁のみ）、頁の内容（白紙 / 画像 / 描画のみ）、黒い面（窓の数）、所管、組織、項名、項コード、項の割り当て、項の開始頁、次の項の開始頁、PDF の URL。
 */
import { kouOfPage, parseCsv } from '@nihon-no-yosan/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deterministicPdfSlug } from '../extract/plain-text.ts';
import { loadYearPages } from '../extract/page-classification.ts';
import { kouPagesByBook, type KouPage } from './kou-pages.ts';
import { readPgm, runCapture } from './pdf-raster.ts';

const [datasetArg, pdfRootArg, redactedArg, outPathArg] = process.argv.slice(2);
if (!datasetArg || !pdfRootArg || !redactedArg || !outPathArg) throw new Error('usage: textless-pages-cli.ts <dataset> <pdfRoot> <redacted.csv> <out.csv>');
const dataset: string = datasetArg, pdfRoot: string = pdfRootArg, redactedPath: string = redactedArg, outPath: string = outPathArg;
const YEARS = [2023, 2024, 2025, 2026, 2027];
const PARALLEL = 8;

/** `pdfimages -list` で、画像のある頁の集合を得る */
async function pagesWithImages(pdf: string): Promise<Set<number>> {
  const out = (await runCapture('pdfimages', ['-list', pdf])).toString('utf8');
  const set = new Set<number>();
  for (const line of out.split('\n').slice(2)) {
    const m = /^\s*(\d+)\s+\d+\s+\S+/.exec(line);
    if (m) set.add(Number(m[1]));
  }
  return set;
}

/** 25dpi のグレー画像に、非白（250 未満）の画素があるか */
async function hasInk(pdf: string, page: number): Promise<boolean> {
  const { data } = readPgm(await runCapture('pdftoppm', ['-r', '25', '-gray', '-f', String(page), '-l', String(page), pdf]));
  return data.some(v => v < 250);
}

// 黒塗り頁（年度|要求書|PDF頁 → 黒い面）
const redacted = new Map<string, number>();
{
  const rows = parseCsv(fs.readFileSync(redactedPath, 'utf8').replace(/^\uFEFF/, ''));
  const head = rows[0]!;
  const c = (n: string): number => { const i = head.indexOf(n); if (i < 0) throw new Error(`黒塗り頁の CSV に列が無い: ${n}`); return i; };
  for (const r of rows.slice(1)) if (r.length > 3) redacted.set(`${r[c('年度')]}|${r[c('要求書')]}|${r[c('PDF頁')]}`, Number(r[c('黒い面（窓の数）')]));
}

const byBook = kouPagesByBook(dataset);
interface Job { year: number; localPdfPath: string; pages: number[]; wholeBook: boolean }
const jobs: Job[] = [];
const urlOf = new Map<string, string>();
let totalPages = 0;
for (const year of YEARS) {
  const freeze = JSON.parse(fs.readFileSync(path.join(dataset, 'budget-request', String(year), 'pdf-corpus-freeze.json'), 'utf8')) as { documents: { localPdfPath: string; sourceUrl: string }[] };
  for (const d of freeze.documents) urlOf.set(`${year}|${d.localPdfPath}`, d.sourceUrl);
  const { pages, documents } = loadYearPages(dataset, year);
  for (const d of documents) {
    totalPages += d.pageCount;
    const texts = pages.get(d.localPdfPath)!;
    const wholeBook = d.status === 'EMPTY';
    const empty = wholeBook ? texts.map((_, i) => i + 1) : texts.flatMap((t, i) => (/\S/.test(t) ? [] : [i + 1]));
    if (empty.length > 0) jobs.push({ year, localPdfPath: d.localPdfPath, pages: empty, wholeBook });
  }
}

const pdfOf = (j: Job): string => path.join(pdfRoot, j.localPdfPath.replace(/^data\/download\//, ''));
const kindOf = new Map<string, string>(); // 年度|書の PDF|頁 → 頁の内容
const work: (() => Promise<void>)[] = [];
for (const j of jobs) {
  work.push(async () => {
    const images = await pagesWithImages(pdfOf(j));
    for (const page of j.pages) kindOf.set(`${j.year}|${j.localPdfPath}|${page}`, !(await hasInk(pdfOf(j), page)) ? '白紙' : images.has(page) ? '画像' : '描画のみ');
  });
}
let next = 0;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (;;) {
    const w = work[next++];
    if (!w) return;
    await w();
  }
}));

const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const lines: unknown[][] = [['年度', '要求書', 'PDF頁', '文字のない範囲', '頁の内容', '黒い面（窓の数）', '所管', '組織', '項名', '項コード', '項の割り当て', '項の開始頁', '次の項の開始頁', 'PDFのURL']];
const count: Record<string, number> = {};
let n = 0;
for (const j of jobs.sort((a, b) => a.year - b.year || a.localPdfPath.localeCompare(b.localPdfPath))) {
  const slug = deterministicPdfSlug(j.localPdfPath);
  const url = urlOf.get(`${j.year}|${j.localPdfPath}`);
  for (const page of j.pages) {
    n++;
    const m = kouOfPage(byBook.get(`${j.year}|${slug}`) ?? [], page);
    const label = m.kind === 'range' ? '頁の範囲' : m.kind === 'estimated' ? '頁を推定' : '特定できず';
    count[label] = (count[label] ?? 0) + 1;
    const head = [j.year, slug, page, j.wholeBook ? '書全体' : '頁のみ', kindOf.get(`${j.year}|${j.localPdfPath}|${page}`)!, redacted.get(`${j.year}|${slug}|${page}`) ?? ''];
    if (m.rows.length === 0) lines.push([...head, '', '', '', '', label, '', m.nextStart ?? '', url]);
    for (const r of m.rows as KouPage[]) lines.push([...head, r.ministry, r.organization, r.itemName, r.itemCode, label, r.startPage, m.nextStart ?? '', url]);
  }
}
fs.writeFileSync(outPath, lines.map(r => r.map(cell).join(',')).join('\n') + '\n');
console.log(`pages ${totalPages}; textless ${n} in ${jobs.length} PDFs; ${JSON.stringify(count)} → ${outPath}`);
