/**
 * 指定した1ページだけをpdf.jsで読み、SourceTokenを返す（PDF全ページは走査しない）。
 * pdf-parse 2.4.5 の公開API（getText/getTable等）はページ文字列のみでbboxを返さないため、
 * pdf.js（pdfjs-dist）を直接使う。pdfjs-dist は packages/pipeline の直接 dependency（5.4.296 に固定。出力のバイト一致は、この版が前提）。
 *
 * disableNormalization: true — pdf.jsのUnicode正規化（NFKC）を無効にしてrawTextを原本のまま保持する。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertValidPage, pageMetaFrom, toSourceTokens, type PageMeta, type RawTextItem, type RawTextStyles, type SourceToken } from '@nihon-no-yosan/core';

const PDFJS_ROOT = path.join('node_modules', 'pdfjs-dist');

export interface PageExtraction {
  page: PageMeta;
  tokens: SourceToken[];
  /** 経過時間（ms）。PDF read / open / page取得+text content取得 */
  timingMs: { read: number; open: number; page: number };
}

/** pdfPath の pageNumber（1始まり）だけを読む。範囲外は例外 */
export async function extractPageTokens(pdfPath: string, pageNumber: number): Promise<PageExtraction> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const t0 = Date.now();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const t1 = Date.now();
  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: `${PDFJS_ROOT}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ROOT}/standard_fonts/`,
    verbosity: 0,
  }).promise;
  try {
    const t2 = Date.now();
    assertValidPage(pageNumber, doc.numPages);
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent({ disableNormalization: true });
    const meta = pageMetaFrom(pageNumber, doc.numPages, page.view, page.rotate);
    const items = content.items.filter((i): i is typeof i & RawTextItem => 'str' in i) as unknown as RawTextItem[];
    const tokens = toSourceTokens(items, meta, content.styles as unknown as RawTextStyles);
    return { page: meta, tokens, timingMs: { read: t1 - t0, open: t2 - t1, page: Date.now() - t2 } };
  } finally {
    await doc.destroy();
  }
}

export async function pdfjsVersion(): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.version;
}
