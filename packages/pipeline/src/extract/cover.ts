/**
 * 概算要求書の表紙（所管・会計の見出し、表題、目次の行）の CSV を作る。仕様: docs/guides/extract.md
 *
 * 表紙の頁は、頁分類で COVER になった頁。読み取りは表紙のパーサー（`request-cover.ts`）。値の補完・推測はしない。
 * 名称の空白（均等割付）は除いて出力する（他の概算要求の CSV と同じ）。
 */
import { parseCoverPage, type CoverObservation, type PageClassificationRecord } from '@nihon-no-yosan/core';
import { createHash } from 'node:crypto';
import { loadYearPages, nonEmptyLinesOf } from './page-classification.ts';

const sha256 = (v: Buffer | string): string => createHash('sha256').update(v).digest('hex');
const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const nospace = (parts: string[]): string => parts.join('').replace(/[\s\u3000]+/g, '');
const slugOf = (localPdfPath: string): string => localPdfPath.replace(/^data\/download\//, '').replace(/\.pdf$/i, '').replace(/\//g, '__');
const HEADER = ['source_page', 'entry_index', 'kind', 'ordinal', 'marker', 'code', 'name', 'page_ref', 'status'];

/** 出力ファイル名（出力ディレクトリからの相対）→ 内容 */
export function buildCover(opts: { datasetDir: string; year: number; records: PageClassificationRecord[] }): Record<string, string> {
  const { datasetDir, year, records } = opts;
  const { pages } = loadYearPages(datasetDir, year);
  const covers = records.filter(r => r.classification.pageType === 'COVER');
  const bySource = new Map<string, { page: number; obs: CoverObservation }[]>();
  const unclassified: string[][] = [];
  let textHashMatch = 0, textHashMismatch = 0;
  for (const c of covers) {
    const slug = slugOf(c.localPdfPath);
    const pageText = pages.get(c.localPdfPath)![c.physicalPage - 1];
    if (pageText === undefined) throw new Error(`${slug} p${c.physicalPage} が無い`);
    if (sha256(pageText) === c.rawText.textSha256) textHashMatch++; else textHashMismatch++;
    const obs = parseCoverPage({ filePath: c.localPdfPath, fileSha256: c.pdfSha256, physicalPage: c.physicalPage, textSha256: c.rawText.textSha256 }, nonEmptyLinesOf(pageText).map(l => ({ text: l.text })));
    (bySource.get(slug) ?? bySource.set(slug, []).get(slug)!).push({ page: c.physicalPage, obs });
    for (const l of obs.unclassifiedLines) unclassified.push([slug, String(c.physicalPage), l.trim()]);
  }
  const out: Record<string, string> = {};
  let rows = 0;
  const status: Record<string, number> = {}, kinds: Record<string, number> = {};
  for (const [slug, items] of [...bySource].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const lines: string[][] = [];
    for (const { page, obs } of items.sort((a, b) => a.page - b.page)) {
      status[obs.status] = (status[obs.status] ?? 0) + 1;
      lines.push([String(page), '0', 'HEADER', '', '', obs.header.codeRaw ?? '', nospace(obs.header.textRawParts), '', obs.header.status]);
      if (obs.header.titleRawParts.length) lines.push([String(page), '0', 'TITLE', '', '', '', nospace(obs.header.titleRawParts), '', obs.header.status]);
      obs.entries.forEach((e, i) => {
        if (e.kind === 'SECTION_REFERENCE') lines.push([String(page), String(i + 1), 'SECTION', e.ordinalRaw ?? '', '', '', nospace(e.labelRawParts), e.printedPageRefRaw ?? '', e.status]);
        else lines.push([String(page), String(i + 1), 'SCOPE', '', (e.markerRaw ?? '').replace(/[\s\u3000]+/g, ''), e.codeRaw ?? '', nospace(e.nameRawParts), e.printedPageRefRaw ?? '', e.status]);
      });
    }
    for (const r of lines) kinds[r[2]!] = (kinds[r[2]!] ?? 0) + 1;
    rows += lines.length;
    out[`sources/${slug}.csv`] = [HEADER, ...lines].map(r => r.map(cell).join(',')).join('\n') + '\n';
  }
  out['unclassified.csv'] = [['source', 'source_page', 'text'], ...unclassified].map(r => r.map(cell).join(',')).join('\n') + '\n';
  const summary = { year, coverPages: covers.length, sources: bySource.size, rows, rowKinds: kinds, pageStatus: status, unclassifiedLines: unclassified.length, inventoryPageTextHash: { match: textHashMatch, mismatch: textHashMismatch } };
  out['summary.json'] = JSON.stringify(summary, null, 1) + '\n';
  return out;
}
