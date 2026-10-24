/**
 * 概算要求書の目次（TOC）の頁を、PDF の文字層（pdf.js の text item と位置）だけから CSV にする。仕様: docs/guides/extract.md
 *
 * 根拠が揃った項目だけを出し、判断できないものは `unresolved.csv` に理由つきで残す。Raw Text（pdftotext）・OCR・他の資料は使わない。
 * 目次の頁は、頁分類で TOC になった頁。PDF は読み取りのみで、SHA-256 が記録と違えば、その PDF は処理せず `source-errors.csv` に残す。
 */
import { convertTocPage, DEFAULT_TOC_PARAMS, extractionOptionsId, renderCsv, renderMainCsv, TOC_PDF_NATIVE_SCHEMA, type AuditKind, type PageClassificationRecord, type PageResult, type TocEntry } from '@nihon-no-yosan/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageTokens, pdfjsVersion } from './pdf-page.ts';
import { deterministicPdfSlug } from './plain-text.ts';

const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');
type Row = (string | number | null)[];

/** 出力ファイル名（出力ディレクトリからの相対）→ 内容。`pdfRoot` は記録の `localPdfPath` の先頭 `data/download/` に当たるディレクトリ */
export async function buildToc(opts: { pdfRoot: string; records: PageClassificationRecord[] }): Promise<Record<string, string>> {
  const pages = opts.records
    .filter(r => r.classification.pageType === 'TOC')
    .sort((a, b) => a.localPdfPath.localeCompare(b.localPdfPath) || a.physicalPage - b.physicalPage);
  const keys = pages.map(p => `${p.localPdfPath}\u0000${p.physicalPage}`);
  if (new Set(keys).size !== keys.length) throw new Error('重複した (PDF, 頁) があります');
  const byPdf = new Map<string, PageClassificationRecord[]>();
  for (const p of pages) byPdf.set(p.localPdfPath, [...(byPdf.get(p.localPdfPath) ?? []), p]);

  const results = new Map<string, PageResult[]>(); // localPdfPath → 頁の昇順
  const pdfVersion = await pdfjsVersion();
  const sourceErrors: { localPdfPath: string; message: string }[] = [];
  for (const [localPdfPath, pdfPages] of byPdf) {
    const abs = path.join(opts.pdfRoot, localPdfPath.replace(/^data\/download\//, ''));
    try {
      const digest = sha256(fs.readFileSync(abs));
      for (const p of pdfPages) if (p.pdfSha256 !== digest) throw new Error(`PDF SHA-256 が記録と一致しない: ${digest} != ${p.pdfSha256}`);
      const out: PageResult[] = [];
      for (const p of pdfPages) {
        const ex = await extractPageTokens(abs, p.physicalPage);
        out.push(convertTocPage({ pdfSha256: digest, physicalPage: p.physicalPage, meta: ex.page, tokens: ex.tokens }));
      }
      results.set(localPdfPath, out);
    } catch (e) {
      sourceErrors.push({ localPdfPath, message: e instanceof Error ? e.message : String(e) });
    }
  }

  const files = new Map<string, string>();
  const sourceRows: Row[] = [], provenanceRows: Row[] = [], auditRows: Row[] = [], ledgerRows: Row[] = [], pageRows: Row[] = [];
  const reasonCounts: Record<string, number> = {};
  const shapeCounts: Record<string, number> = {};
  const totals = { tokens: 0, blank: 0, headerZone: 0, entryTokens: 0, unresolvedTokens: 0, entries: 0, audits: 0, geometricRowsLeft: 0, geometricRowsRight: 0, pagesWithColumnEvidence: 0 };
  const optionsId = extractionOptionsId(pdfVersion);
  const joinIdx = (xs: number[]): string => xs.join(';');

  for (const [localPdfPath, pdfResults] of results) {
    const slug = deterministicPdfSlug(localPdfPath);
    const sha = pdfResults[0]!.pdfSha256;
    const all: TocEntry[] = [];
    for (const r of pdfResults) {
      all.push(...r.entries);
      totals.tokens += r.tokenCount;
      totals.geometricRowsLeft += r.geometricRows.left;
      totals.geometricRowsRight += r.geometricRows.right;
      if (r.columnEvidence.available) totals.pagesWithColumnEvidence++;
      for (const l of r.ledger) {
        if (l.disposition === 'BLANK') totals.blank++;
        else if (l.disposition === 'HEADER_ZONE') totals.headerZone++;
        else if (l.disposition === 'ENTRY') totals.entryTokens++;
        else totals.unresolvedTokens++;
        ledgerRows.push([slug, sha, r.physicalPage, l.tokenIndex, l.disposition, l.reason, l.ref, l.side, l.rawText]);
      }
      for (const a of r.audits) {
        reasonCounts[a.kind] = (reasonCounts[a.kind] ?? 0) + 1;
        auditRows.push([a.auditId, slug, localPdfPath, sha, r.physicalPage, a.kind, a.side, a.rowId, a.candidateOwnerRowId, a.candidateOwnerEntryId, joinIdx(a.tokenIndexes), JSON.stringify(a.rawTexts), a.detail]);
      }
      totals.audits += r.audits.length;
      for (const e of r.entries) shapeCounts[e.shape] = (shapeCounts[e.shape] ?? 0) + 1;
      pageRows.push([
        slug, sha, r.physicalPage, r.tokenCount, r.columnEvidence.available ? 'YES' : 'NO',
        r.columnEvidence.available ? r.columnEvidence.boundaryX.toFixed(3) : '', r.columnEvidence.available ? '' : r.columnEvidence.reason,
        r.geometricRows.left, r.geometricRows.right, r.entries.length, r.audits.length,
        r.ledger.filter(l => l.disposition === 'BLANK').length, r.ledger.filter(l => l.disposition === 'HEADER_ZONE').length,
        r.ledger.filter(l => l.disposition === 'ENTRY').length, r.ledger.filter(l => l.disposition === 'UNRESOLVED').length,
      ]);
    }
    totals.entries += all.length;
    files.set(`sources/${slug}.csv`, renderMainCsv(all));
    all.forEach((e, i) => {
      const page = pdfResults.find(r => r.entries.includes(e))!.physicalPage;
      provenanceRows.push([e.entryId, slug, localPdfPath, i + 1, sha, page, pdfVersion, optionsId, e.side, e.rowId, e.shape, joinIdx(e.requestNumberTokenIndexes), joinIdx(e.labelTokenIndexes), joinIdx(e.pageRefTokenIndexes)]);
    });
    sourceRows.push([slug, localPdfPath, sha, pdfResults.length, pdfResults.map(r => r.physicalPage).join(';'), all.length, pdfResults.reduce((n, r) => n + r.audits.length, 0)]);
  }

  files.set('source-errors.csv', renderCsv(['localPdfPath', 'message'], sourceErrors.map(e => [e.localPdfPath, e.message])));
  files.set('sources.csv', renderCsv(['source_slug', 'source_pdf', 'pdf_sha256', 'toc_pages', 'physical_pages', 'entries', 'audit_records'], sourceRows));
  files.set('entry-provenance.csv', renderCsv(['entry_id', 'source_slug', 'source_pdf', 'csv_row', 'pdf_sha256', 'physical_page', 'pdfjs_version', 'extraction_options_id', 'side', 'row_id', 'shape', 'request_number_item_indexes', 'label_item_indexes', 'page_ref_item_indexes'], provenanceRows));
  files.set('unresolved.csv', renderCsv(['audit_id', 'source_slug', 'source_pdf', 'pdf_sha256', 'physical_page', 'kind', 'side', 'row_id', 'candidate_owner_row_id', 'candidate_owner_entry_id', 'item_indexes', 'raw_texts_json', 'detail'], auditRows));
  files.set('token-ledger.csv', renderCsv(['source_slug', 'pdf_sha256', 'physical_page', 'item_index', 'disposition', 'reason', 'ref', 'side', 'raw_text'], ledgerRows));
  files.set('page-summary.csv', renderCsv(['source_slug', 'pdf_sha256', 'physical_page', 'items', 'column_evidence', 'boundary_x', 'no_evidence_reason', 'geometric_rows_left', 'geometric_rows_right', 'entries', 'audit_records', 'blank_items', 'header_zone_items', 'entry_items', 'unresolved_items'], pageRows));

  if (totals.tokens !== totals.blank + totals.headerZone + totals.entryTokens + totals.unresolvedTokens) throw new Error('item accounting が合わない');
  const summary = {
    schema: TOC_PDF_NATIVE_SCHEMA,
    extraction: { library: 'pdfjs-dist', version: pdfVersion, optionsId },
    parameters: DEFAULT_TOC_PARAMS,
    population: { tocPages: pages.length, pdfs: byPdf.size, pagesWithColumnEvidence: totals.pagesWithColumnEvidence, pagesWithoutColumnEvidence: pages.length - totals.pagesWithColumnEvidence },
    counts: {
      items: totals.tokens,
      itemDisposition: { blank: totals.blank, headerZone: totals.headerZone, entry: totals.entryTokens, unresolved: totals.unresolvedTokens },
      entries: totals.entries,
      entriesByShape: shapeCounts,
      auditRecords: totals.audits,
      auditRecordsByKind: reasonCounts as Record<AuditKind, number>,
      geometricRows: { left: totals.geometricRowsLeft, right: totals.geometricRowsRight },
    },
    inputs: {
      pdfs: [...byPdf.entries()].map(([localPdfPath, ps]) => ({ source_pdf: localPdfPath, pdf_sha256: ps[0]!.pdfSha256, toc_pages: ps.map(p => p.physicalPage) })),
    },
  };
  files.set('summary.json', `${JSON.stringify(summary, null, 2)}\n`);
  const hashes = Object.fromEntries([...files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
  files.set('output-hashes.json', `${JSON.stringify({ schema: `${TOC_PDF_NATIVE_SCHEMA}/output-hashes`, files: hashes }, null, 2)}\n`);
  return Object.fromEntries(files);
}
