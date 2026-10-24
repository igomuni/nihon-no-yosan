/**
 * 目次（TOC）の頁を、PDF の文字層だけから CSV にする。
 *
 * 使い方: node packages/pipeline/src/extract/toc-cli.ts <基準データのディレクトリ> <年度> <PDF の置き場> <出力ディレクトリ>
 * - 目次の頁は頁分類で決める。PDF の置き場は、記録の `localPdfPath` の先頭 `data/download/` に当たるディレクトリ（読み取りのみ。出力先はその外）
 * - リポジトリのルートで動かす（pdf.js の cmaps とフォントを `node_modules/pdfjs-dist` から読む）
 * 出力: sources/{slug}.csv、sources.csv、entry-provenance.csv、unresolved.csv、token-ledger.csv、page-summary.csv、source-errors.csv、summary.json、output-hashes.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classifyYear } from './page-classification.ts';
import { buildToc } from './toc.ts';

const [dataset, yearArg, pdfRoot, outDir] = process.argv.slice(2);
if (!dataset || !yearArg || !pdfRoot || !outDir) throw new Error('usage: toc-cli.ts <dataset> <year> <pdfRoot> <outDir>');
if (!/^\d{4}$/.test(yearArg)) throw new Error(`year must be a 4-digit fiscal year: ${yearArg}`);
const rel = path.relative(path.resolve(pdfRoot), path.resolve(outDir));
if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error(`出力先は PDF の置き場の外にしてください: ${outDir}`);
const files = await buildToc({ pdfRoot, records: classifyYear(dataset, Number(yearArg)) });
for (const [name, content] of Object.entries(files)) {
  const dest = path.join(outDir, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
}
console.log(`wrote ${Object.keys(files).length} files to ${outDir}`);
