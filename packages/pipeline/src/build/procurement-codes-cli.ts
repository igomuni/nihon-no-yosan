/**
 * 落札実績オープンデータのファイル仕様（PDF）から、コード表を作る。仕様: docs/guides/procurement.md
 *
 * 使い方: node packages/pipeline/src/build/procurement-codes-cli.ts <仕様書の PDF> <出力 JSON> [PDF の URL]
 * 例: node packages/pipeline/src/build/procurement-codes-cli.ts data/download/p-portal/rakusatsuopendata.pdf datasets/p-portal-code-tables/code-tables.json
 * `pdftotext`（poppler）が要る。出力は git に入れる（小さい。PDF は入れない）。
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseProcurementCodeTables } from './procurement-codes.ts';

const [pdf, out, url = 'https://www.p-portal.go.jp/pps-web-biz/resources/app/pdf/rakusatsuopendata.pdf'] = process.argv.slice(2);
if (!pdf || !out) throw new Error('usage: procurement-codes-cli.ts <spec.pdf> <out.json> [url]');
const bytes = fs.readFileSync(pdf);
const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
const tables = parseProcurementCodeTables(text);
const json = {
  schema: 'nihon-no-yosan/p-portal-code-tables/v0',
  source: { name: '落札実績オープンデータ ファイル仕様 3.1 府省コード・3.2 入札方式コード', url, edition: tables.edition, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
  ministries: tables.ministries,
  methods: tables.methods,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(json, null, 1) + '\n');
console.log(`${out}: ${tables.edition}、府省 ${tables.ministries.length}、入札方式 ${tables.methods.length}`);
