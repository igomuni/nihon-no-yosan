/**
 * 歳出概算要求額総表の CSV を、plain text から作る。
 *
 * 使い方: node packages/pipeline/src/extract/total-table-cli.ts <plain text のディレクトリ> <plain-text-manifest.json> <年度> <出力ディレクトリ>
 * 出力: sources/{slug}.csv、unresolved.csv、line-audit.csv、arithmetic-diagnostics.csv、summary.json、output-manifest.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildTotalTable } from './total-table.ts';

const [inputDir, manifestPath, yearArg, outDir] = process.argv.slice(2);
if (!inputDir || !manifestPath || !yearArg || !outDir) throw new Error('usage: total-table-cli.ts <plainTextDir> <plain-text-manifest.json> <year> <outDir>');
if (!/^\d{4}$/.test(yearArg)) throw new Error(`year must be a 4-digit fiscal year: ${yearArg}`);
const files = buildTotalTable({ inputDir, manifestPath, year: Number(yearArg), inputLabel: inputDir });
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'sources'), { recursive: true });
for (const [rel, text] of Object.entries(files)) fs.writeFileSync(path.join(outDir, rel), text);
console.log(`wrote ${Object.keys(files).length} files to ${outDir}`);
