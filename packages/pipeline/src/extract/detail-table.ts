/**
 * 歳出概算要求額明細表（備考を除く）の plain text から、行（論理行）の CSV を作る。仕様: docs/guides/extract.md
 *
 * 入力は `plain-text/{slug}.txt`（読み取りのみ）。パーサーは FY2024 の v0 のまま（見出しの語彙は ６年度 のまま）で、`year` は
 * 入力の範囲・頁の突き合わせ記録・範囲ラベルを決めるだけ。頁の突き合わせ記録（plain-text-manifest.json）は診断のためだけに使う。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { csvCell, parseDetailSource, renderDetailTableRowsCsv, renderDetailTableUnresolvedCsv, type DetailRow, type DetailTableSourceResult } from '@nihon-no-yosan/core';

const sha256 = (v: Buffer | string): string => createHash('sha256').update(v).digest('hex');
const count = <T>(items: T[], key: (t: T) => string): Record<string, number> =>
  Object.fromEntries([...items.reduce((m, t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** 出力ファイル名（出力ディレクトリからの相対）→ 内容。`output-manifest.json` は含む */
export function buildDetailTable(opts: { inputDir: string; manifestPath: string; year: number; inputLabel: string }): Record<string, string> {
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
  const results: DetailTableSourceResult[] = [];
  const integrity: { source_file: string; status: string }[] = [];
  const noTextLayer: { source_file: string; pageCount: number }[] = [];
  for (const entry of entries) {
    const text = decoder.decode(inputBytes.get(path.basename(entry))!);
    const slug = path.basename(entry, '.txt');
    results.push(parseDetailSource(text, entry));
    const frozen = manifestBySlug.get(slug);
    const pages = text.split('\f');
    if (text.endsWith('\f')) pages.pop();
    if (pages.every(p => p.trim() === '')) noTextLayer.push({ source_file: entry, pageCount: pages.length });
    integrity.push({
      source_file: entry,
      status: !frozen ? 'NOT_IN_FROZEN_MANIFEST'
        : frozen.pageCount !== pages.length ? 'PAGE_COUNT_MISMATCH'
          : pages.every((p, i) => sha256(p) === frozen.pageTextSha256[i]) ? 'MATCH' : 'PAGE_HASH_MISMATCH',
    });
  }

  const out: Record<string, string> = {};
  const allRows: DetailRow[] = results.flatMap(r => r.rows);
  const allUnresolved = results.flatMap(r => r.unresolved);
  for (const r of results) {
    if (r.detailPages.length === 0) continue;
    out[`sources/${path.basename(r.source_file, '.txt')}.csv`] = renderDetailTableRowsCsv(r.rows);
  }
  out['unresolved.csv'] = renderDetailTableUnresolvedCsv(allUnresolved);
  const mismatches = results.flatMap(r => r.arithmeticMismatchRows);
  out['arithmetic-diagnostics.csv'] = [
    'source_file,source_page,source_line_start,row_index,request_total-previous_total=difference,expected_from_other_cells,extracted_value',
    ...mismatches.map(r => [r.source_file, r.source_page, r.source_line_start, r.row_index, 'request-previous=difference', '', `${r.cells.previous} / ${r.cells.request} / ${r.cells.difference}`].map(csvCell).join(',')),
  ].join('\n') + '\n';

  const classCounts: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.lineClassCounts)) classCounts[k] = (classCounts[k] ?? 0) + v;
  const accounted = Object.values(classCounts).reduce((a, b) => a + b, 0);
  const nonBlank = results.reduce((n, r) => n + r.nonBlankLinesInDetailPages, 0);
  // 明細表の頁の空でない物理行は、行・折り返し・既知の枠や備考の行・読めなかった行のどれかに数える
  if (accounted !== nonBlank) throw new Error(`line accounting mismatch: classified ${accounted} != non-blank ${nonBlank}`);

  const summary = {
    scope: `FY${year} 令和${year - 2018}年度歳出概算要求額明細表 (excluding 備考) raw text → logical rows (v0 deterministic parser; descriptive counts, not an accuracy score)`,
    input: { inputDir: inputLabel, inputSha256, txtEntries: entries.length },
    frozenManifestIntegrity: count(integrity, i => i.status),
    frozenManifestIntegrityDetail: integrity.filter(i => i.status !== 'MATCH'),
    sourceFileCount: results.length,
    detailTableSourceCount: results.filter(r => r.detailPages.length > 0).length,
    detailTablePageCount: results.reduce((n, r) => n + r.detailPages.length, 0),
    sourcesWithoutDetailTable: results.filter(r => r.detailPages.length === 0).length,
    sourcesWithNoTextLayer: noTextLayer,
    pagesWithoutHeaderBoundary: results.reduce((n, r) => n + r.pagesWithoutBoundary.length, 0),
    nonBlankLinesInDetailPages: nonBlank,
    lineClassCounts: classCounts,
    logicalRowCount: allRows.length,
    rowTypeCounts: count(allRows, r => r.row_type),
    parseStatusCounts: count(allRows, r => r.parse_status),
    rowsByBlankCells: count(allRows, r => `blank:${(['previous', 'request', 'difference'] as const).filter(c => r.cells[c] === '').join('+') || 'none'}`),
    rowsWithContinuation: allRows.filter(r => r.continuationLines > 0).length,
    unresolvedCount: allUnresolved.length,
    unresolvedByReason: count(allUnresolved, u => u.reason),
    arithmeticDiagnostics: { rowsWithMismatch: mismatches.length },
    sources: results.filter(r => r.detailPages.length > 0).map(r => ({
      source_file: r.source_file,
      pageCount: r.pageCount,
      detailPages: r.detailPages.length,
      pagesWithoutBoundary: r.pagesWithoutBoundary,
      rows: r.rows.length,
      unresolved: r.unresolved.length,
      lineClassCounts: r.lineClassCounts,
    })),
  };
  out['summary.json'] = JSON.stringify(summary, null, 2) + '\n';
  out['output-manifest.json'] = JSON.stringify(
    Object.fromEntries(Object.keys(out).sort().map(rel => [rel, sha256(out[rel]!)])), null, 2) + '\n';
  return out;
}
