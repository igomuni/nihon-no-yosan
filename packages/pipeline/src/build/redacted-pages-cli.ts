/**
 * 概算要求書の黒塗り頁の一覧（CSV）を作る。仕様: docs/guides/redacted-pages.md
 *
 * 使い方: node packages/pipeline/src/build/redacted-pages-cli.ts <基準データのディレクトリ> <PDF の置き場> <出力の CSV>
 * - PDF の置き場は、記録の `localPdfPath` の先頭 `data/download/` に当たるディレクトリ。`pdftoppm`（poppler）が要る。
 * - 全 PDF の全頁を 25dpi のグレー画像にして、黒い面（`core/redacted-pages.ts`）の大きさが `REDACTED_MIN` 以上の頁を挙げる。
 *   頁が属する項は、概算要求の項の表（`trend.ts` の `kou.csv`）の開始頁から決める。
 * - 出力の列: 年度、要求書、PDF 頁、黒い面（窓の数）、所管、組織、項名、項コード、項の割り当て（`頁の範囲` / `頁を推定` / `特定できず`）、項の開始頁、次の項の開始頁、PDF の URL。
 */
import { REDACTED_MIN, kouOfPage, parseCsv, solidDark, type KouPageRow } from '@nihon-no-yosan/core';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { deterministicPdfSlug } from '../extract/plain-text.ts';
import { buildBudgetRequestTrend, matchesFromDataset } from './trend.ts';

const [datasetArg, pdfRootArg, outPathArg] = process.argv.slice(2);
if (!datasetArg || !pdfRootArg || !outPathArg) throw new Error('usage: redacted-pages-cli.ts <dataset> <pdfRoot> <out.csv>');
const dataset: string = datasetArg, pdfRoot: string = pdfRootArg, outPath: string = outPathArg;
const YEARS = [2023, 2024, 2025, 2026, 2027];
const DPI = 25;
const PARALLEL = 8;

/** PGM（P5）を読む */
function readPgm(buf: Buffer): { w: number; h: number; data: Uint8Array } {
  let pos = 0;
  const token = (): string => {
    while (/\s/.test(String.fromCharCode(buf[pos]!))) pos++;
    if (buf[pos] === 0x23) { while (buf[pos] !== 0x0a) pos++; return token(); }
    let s = '';
    while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]!))) s += String.fromCharCode(buf[pos++]!);
    return s;
  };
  if (token() !== 'P5') throw new Error('PGM（P5）でない');
  const w = Number(token()), h = Number(token()), max = Number(token());
  if (max !== 255) throw new Error(`PGM の最大値が 255 でない: ${max}`);
  pos++;
  return { w, h, data: new Uint8Array(buf.buffer, buf.byteOffset + pos, w * h) };
}

const run = (cmd: string, args: string[]): Promise<void> => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'ignore'] });
  p.on('error', reject);
  p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} が終了コード ${code}: ${args.join(' ')}`))));
});

interface Flag { year: number; localPdfPath: string; page: number; solid: number }

async function scan(year: number, localPdfPath: string): Promise<{ flags: Flag[]; pages: number }> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redact-'));
  try {
    await run('pdftoppm', ['-r', String(DPI), '-gray', path.join(pdfRoot, localPdfPath.replace(/^data\/download\//, '')), path.join(tmp, 'p')]);
    const files = fs.readdirSync(tmp).filter(f => f.endsWith('.pgm'));
    const flags: Flag[] = [];
    for (const f of files) {
      const page = Number(/p-(\d+)\.pgm$/.exec(f)![1]);
      const { w, h, data } = readPgm(fs.readFileSync(path.join(tmp, f)));
      const s = solidDark(data, w, h);
      if (s.count >= REDACTED_MIN) flags.push({ year, localPdfPath, page, solid: s.count });
    }
    return { flags, pages: files.length };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 項の開始頁（要求書ごと）
const kouCsv = buildBudgetRequestTrend({ datasetDir: dataset, matches: matchesFromDataset(dataset) }).files['kou.csv']!;
const kouRows = parseCsv(kouCsv.replace(/^\uFEFF/, ''));
const head = kouRows[0]!;
const col = (name: string): number => { const i = head.indexOf(name); if (i < 0) throw new Error(`kou.csv に列が無い: ${name}`); return i; };
const byBook = new Map<string, (KouPageRow & { ministry: string })[]>();
for (const r of kouRows.slice(1)) {
  if (r.length < 2 || !/^\d+$/.test(r[col('PDF頁')] ?? '')) continue;
  const key = `${r[col('年度')]}|${r[col('PDFの要求書')]}`;
  (byBook.get(key) ?? byBook.set(key, []).get(key)!).push({
    ministry: r[col('所管')] || (r[col('特別会計')] ?? ''), organization: r[col('組織')]!, itemName: r[col('項名')]!, itemCode: r[col('項コード')]!,
    startPage: Number(r[col('PDF頁')]), basis: r[col('PDF頁の根拠')]!, imagePage: r[col('画像頁')] === '1',
  });
}

const jobs: { year: number; localPdfPath: string; url: string }[] = [];
for (const year of YEARS) {
  const freeze = JSON.parse(fs.readFileSync(path.join(dataset, 'budget-request', String(year), 'pdf-corpus-freeze.json'), 'utf8')) as { documents: { localPdfPath: string; sourceUrl: string }[] };
  for (const d of freeze.documents) jobs.push({ year, localPdfPath: d.localPdfPath, url: d.sourceUrl });
}
const flags: Flag[] = [];
let pages = 0, next = 0, done = 0;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (;;) {
    const j = jobs[next++];
    if (!j) return;
    const r = await scan(j.year, j.localPdfPath);
    flags.push(...r.flags);
    pages += r.pages;
    if (++done % 100 === 0) console.log(`${done}/${jobs.length} PDFs, ${pages} pages, ${flags.length} flagged`);
  }
}));
flags.sort((a, b) => a.year - b.year || a.localPdfPath.localeCompare(b.localPdfPath) || a.page - b.page);

const urlOf = new Map(jobs.map(j => [`${j.year}|${j.localPdfPath}`, j.url]));
const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const lines: unknown[][] = [['年度', '要求書', 'PDF頁', '黒い面（窓の数）', '所管', '組織', '項名', '項コード', '項の割り当て', '項の開始頁', '次の項の開始頁', 'PDFのURL']];
const count: Record<string, number> = {};
for (const f of flags) {
  const slug = deterministicPdfSlug(f.localPdfPath);
  const m = kouOfPage(byBook.get(`${f.year}|${slug}`) ?? [], f.page);
  const url = urlOf.get(`${f.year}|${f.localPdfPath}`);
  const label = m.kind === 'range' ? '頁の範囲' : m.kind === 'estimated' ? '頁を推定' : '特定できず';
  count[label] = (count[label] ?? 0) + 1;
  if (m.rows.length === 0) lines.push([f.year, slug, f.page, f.solid, '', '', '', '', label, '', m.nextStart ?? '', url]);
  for (const r of m.rows as (KouPageRow & { ministry: string })[]) lines.push([f.year, slug, f.page, f.solid, r.ministry, r.organization, r.itemName, r.itemCode, label, r.startPage, m.nextStart ?? '', url]);
}
fs.writeFileSync(outPath, lines.map(r => r.map(cell).join(',')).join('\n') + '\n');
console.log(`scanned ${pages} pages of ${jobs.length} PDFs; flagged ${flags.length} pages; ${JSON.stringify(count)} → ${outPath}`);
