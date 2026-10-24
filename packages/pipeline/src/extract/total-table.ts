/**
 * 歳出概算要求額総表の plain text から、行（論理行）の CSV を作る。仕様: docs/guides/extract.md
 *
 * 入力は `plain-text/{slug}.txt`（読み取りのみ）。`--year` 相当の `year` で、頁の突き合わせ記録・出力の範囲ラベル・金額の列名の年度の数字が決まる。
 * 頁の突き合わせ記録（plain-text-manifest.json）は、診断のためだけに使う（パーサーの入力は plain text）。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AMOUNT_FIELDS,
  arithmeticMismatches,
  csvCell,
  parseTotalTableSource,
  renderTotalTableAuditCsv,
  renderTotalTableRowsCsv,
  renderTotalTableUnresolvedCsv,
  requestYearLabel,
  type TotalTableRow,
  type TotalTableSourceResult,
} from '@nihon-no-yosan/core';

const sha256 = (v: Buffer | string): string => createHash('sha256').update(v).digest('hex');
const count = <T>(items: T[], key: (t: T) => string): Record<string, number> =>
  Object.fromEntries([...items.reduce((m, t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** 出力ファイル名（出力ディレクトリからの相対）→ 内容。`output-manifest.json` は含む */
export function buildTotalTable(opts: { inputDir: string; manifestPath: string; year: number; inputLabel: string }): Record<string, string> {
  const { inputDir, manifestPath, year, inputLabel } = opts;
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) throw new Error(`input directory not found: ${inputDir}`);
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.txt')).sort();
  if (files.length === 0) throw new Error(`no *.txt files in ${inputDir}`);
  // 出力の source_file は `budget-request-plain-text/{年度}/{ファイル}` の形（前のリポジトリの出力と同じ）
  const entries = files.map(f => `budget-request-plain-text/${year}/${f}`);
  const inputBytes = new Map(files.map(f => [f, fs.readFileSync(path.join(inputDir, f))]));
  const inputSha256 = sha256([...inputBytes].map(([f, b]) => `${f}\t${sha256(b)}\n`).join(''));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { documents: { status: string; localPdfPath: string; pageCount: number; pageTextSha256: string[] }[] };
  const manifestBySlug = new Map(
    manifest.documents
      .filter(d => d.status === 'EXTRACTED')
      .map(d => [d.localPdfPath.replace(/^data\/download\//u, '').replace(/\.pdf$/iu, '').replace(/\//gu, '__'), d] as const),
  );

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const results: TotalTableSourceResult[] = [];
  const integrity: { source_file: string; status: string }[] = [];
  for (const entry of entries) {
    const text = decoder.decode(inputBytes.get(path.basename(entry))!);
    const slug = path.basename(entry, '.txt');
    results.push(parseTotalTableSource(text, entry, slug));
    const frozen = manifestBySlug.get(slug);
    const pages = text.split('\f');
    if (text.endsWith('\f')) pages.pop();
    integrity.push({
      source_file: entry,
      status: !frozen ? 'NOT_IN_FROZEN_MANIFEST'
        : frozen.pageCount !== pages.length ? 'PAGE_COUNT_MISMATCH'
          : pages.every((p, i) => sha256(p) === frozen.pageTextSha256[i]) ? 'MATCH' : 'PAGE_HASH_MISMATCH',
    });
  }

  const out: Record<string, string> = {};
  const allRows = results.flatMap(r => r.rows);
  const allUnresolved = results.flatMap(r => r.unresolved);
  for (const r of results) {
    if (r.blocks.length === 0) continue;
    out[`sources/${path.basename(r.source_file, '.txt')}.csv`] = renderTotalTableRowsCsv(r.rows, requestYearLabel(year));
  }
  out['unresolved.csv'] = renderTotalTableUnresolvedCsv(allUnresolved);
  out['line-audit.csv'] = renderTotalTableAuditCsv(results.flatMap(r => r.audit));
  const diagnostics = allRows.flatMap(row => arithmeticMismatches(row).map(m => ({ row, ...m })));
  out['arithmetic-diagnostics.csv'] = [
    'source_file,source_page,source_line_start,table_block_id,row_index,row_type,check,expected_from_other_cells,extracted_value',
    ...diagnostics.map(d => [d.row.source_file, d.row.source_page, d.row.source_line_start, d.row.table_block_id, d.row.row_index, d.row.row_type, d.check, d.expected, d.actual].map(csvCell).join(',')),
  ].join('\n') + '\n';

  const audit = results.flatMap(r => r.audit);
  const summary = {
    scope: `FY${year} 令和${year - 2018}年度歳出概算要求額総表 raw text → logical rows (v0 deterministic parser; descriptive counts, not an accuracy score)`,
    input: { inputDir: inputLabel, inputSha256, txtEntries: entries.length },
    frozenManifestIntegrity: count(integrity, i => i.status),
    frozenManifestIntegrityDetail: integrity.filter(i => i.status !== 'MATCH'),
    sourceFileCount: results.length,
    candidateTotalTableSourceCount: results.filter(r => r.candidatePages.length > 0).length,
    candidateTotalTablePageCount: results.reduce((n, r) => n + r.candidatePages.length, 0),
    tableBlockCount: results.reduce((n, r) => n + r.blocks.length, 0),
    titleOnlyPageCount: results.reduce((n, r) => n + r.titleOnlyPages.length, 0),
    logicalRowCount: allRows.length,
    rowTypeCounts: count(allRows, r => r.row_type),
    parseStatusCounts: count(allRows, r => r.parse_status),
    rowsWithContinuation: count(allRows.filter(r => r.continuationLines > 0), r => r.row_type),
    continuationLineCount: count(audit.filter(a => a.line_class === 'CONTINUATION'), a => a.detail),
    unresolvedCount: allUnresolved.length,
    unresolvedByReason: count(allUnresolved, u => u.reason),
    numericTailFailureCount: allUnresolved.filter(u => u.reason === 'MALFORMED_NUMERIC_TAIL').length,
    unknownRowHeadCount: allUnresolved.filter(u => u.reason === 'UNMATCHED_NUMERIC_HEAD' || u.reason === 'NUMERIC_TAIL_AMBIGUOUS_HEAD_ENDS_WITH_NUMBER').length,
    lineClassCounts: count(audit, a => a.line_class),
    blankLinesInCandidatePages: results.reduce((n, r) => n + r.blankLinesInCandidatePages, 0),
    signedCellsByColumn: Object.fromEntries(AMOUNT_FIELDS.map(f => [f, allRows.filter(r => r.cells[f].sign_raw === '△').length])),
    detailPageShape: count(allRows, (r: TotalTableRow) => (r.detail_page_raw === '' ? '<blank>' : r.detail_page_raw.replace(/[0-9]+/gu, 'N'))),
    arithmeticDiagnostics: { rowsWithMismatch: new Set(diagnostics.map(d => d.row)).size, byCheck: count(diagnostics, d => d.check) },
    sources: results.map(r => ({
      source_file: r.source_file,
      pageCount: r.pageCount,
      endsWithFormFeed: r.endsWithFormFeed,
      candidatePages: r.candidatePages,
      titleOnlyPages: r.titleOnlyPages,
      blocks: r.blocks,
      rows: r.rows.length,
      unresolved: r.unresolved.length,
    })),
  };
  out['summary.json'] = JSON.stringify(summary, null, 2) + '\n';
  out['output-manifest.json'] = JSON.stringify(
    Object.fromEntries(Object.keys(out).sort().map(rel => [rel, sha256(out[rel]!)])), null, 2) + '\n';
  return out;
}
