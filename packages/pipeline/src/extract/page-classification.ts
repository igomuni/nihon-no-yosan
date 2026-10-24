/**
 * 概算要求書の plain text の全頁に、頁分類（`request-page-classification.ts`）を当てる。仕様: docs/guides/extract.md
 *
 * 入力は `budget-request/{年度}/plain-text/` と `plain-text-manifest.json`。空の頁の分類は、FY2024 だけ `datasets/reference-v0/empty-pages-2024.json`
 * （空白の頁は状態を保ち、画像の頁は状態を捨てる）。他の年度の空の頁は、理由未確定として状態を捨てる（規則は変えない）。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classifyDocument, verifyHashes, type ClassifierPageInput, type EmptyKind, type PageClassificationRecord } from '@nihon-no-yosan/core';

interface ManifestDocument { localPdfPath: string; textFile: string; pdfSha256: string; pageCount: number; status: 'EXTRACTED' | 'EMPTY'; pageTextSha256: string[] }

export const sha256 = (v: Buffer | string): string => createHash('sha256').update(v).digest('hex');

/** 頁の文字列から、空白以外を含む行（行番号つき）を取る。行は trim しない */
export const nonEmptyLinesOf = (text: string): { lineIndex: number; text: string }[] =>
  text.split('\n').flatMap((line, lineIndex) => (/\S/.test(line) ? [{ lineIndex, text: line }] : []));

/** `pdftotext` の出力を頁に分ける（各頁の末尾に Form Feed。頁数が合わなければ止まる） */
export function splitPages(raw: string, pageCount: number): string[] {
  if (!raw.endsWith('\f')) throw new Error('page boundary mismatch: pdftotext output does not end with a form feed');
  const parts = raw.split('\f');
  parts.pop();
  if (parts.length !== pageCount) throw new Error(`page boundary mismatch: pdftotext returned ${parts.length} page chunks, expected ${pageCount}`);
  return parts;
}

export interface YearPages {
  /** 書ごとの頁の文字列（添字 = 物理頁 - 1）。文字層が無い書も、頁数ぶんの空文字を持つ */
  pages: Map<string, string[]>;
  documents: ManifestDocument[];
}

export function loadYearPages(datasetDir: string, year: number): YearPages {
  const dir = path.join(datasetDir, 'budget-request', String(year));
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'plain-text-manifest.json'), 'utf8')) as { documents: ManifestDocument[] };
  const pages = new Map<string, string[]>();
  for (const d of manifest.documents) {
    const raw = fs.readFileSync(path.join(dir, 'plain-text', d.textFile), 'utf8');
    pages.set(d.localPdfPath, splitPages(raw, d.pageCount));
  }
  return { pages, documents: manifest.documents };
}

/** 年度の全頁を分類する。書の順は plain-text-manifest.json のまま */
export function classifyYear(datasetDir: string, year: number): PageClassificationRecord[] {
  const { pages, documents } = loadYearPages(datasetDir, year);
  const emptyPath = path.join('datasets', 'reference-v0', `empty-pages-${year}.json`);
  const emptyKind = new Map<string, EmptyKind>();
  if (fs.existsSync(emptyPath)) {
    const e = JSON.parse(fs.readFileSync(emptyPath, 'utf8')) as { pages: { localPdfPath: string; physicalPage: number; kind: EmptyKind }[] };
    for (const p of e.pages) emptyKind.set(`${p.localPdfPath}#${p.physicalPage}`, p.kind);
  }
  const all: PageClassificationRecord[] = [];
  for (const d of documents) {
    const texts = pages.get(d.localPdfPath)!;
    const inputs: ClassifierPageInput[] = d.status === 'EMPTY'
      ? d.pageTextSha256.map((h, i) => ({ physicalPage: i + 1, rawStatus: 'EMPTY', textSha256: h, nonEmptyLines: [], emptyKind: 'UNRESOLVED_EMPTY' }))
      : texts.map((t, i) => {
        const empty = t.replace(/\s/g, '').length === 0;
        return {
          physicalPage: i + 1, rawStatus: empty ? 'EMPTY' : 'EXTRACTED', textSha256: sha256(t), nonEmptyLines: nonEmptyLinesOf(t),
          emptyKind: empty ? (emptyKind.get(`${d.localPdfPath}#${i + 1}`) ?? 'UNRESOLVED_EMPTY') : 'NONE',
        };
      });
    if (d.status !== 'EMPTY') {
      verifyHashes(d.localPdfPath, { expectedPdfSha256: d.pdfSha256, actualPdfSha256: d.pdfSha256, expectedPageTextSha256: d.pageTextSha256, actualPageTextSha256: inputs.map(p => p.textSha256) });
    }
    all.push(...classifyDocument(d.localPdfPath, d.pdfSha256, inputs, d.pageCount));
  }
  return all;
}
