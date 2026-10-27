/**
 * 予算書【XML版】の「(参考) コード番号について」のページから、分類コードの表を取り出して、JSON に書く。仕様: docs/guides/budget-codes.md
 *
 * 使い方: node packages/pipeline/src/build/code-tables-cli.ts <出力の JSON> <XML のディレクトリ>...
 * XML のディレクトリは、`mof_{年}/xml`（`data/download/mof-xml/` と、前のリポジトリの `data/download_old/`）。XML は Shift_JIS（宣言のとおりに読む）。
 * 同じ名前のファイルが複数のディレクトリにあるときは、SHA-256 が同じならひとつにまとめる（違えば止まる）。
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { codeTableFileInfo, parseCodeNumberPage, type CodeTablePage } from '@nihon-no-yosan/core';

const [out, ...dirs] = process.argv.slice(2);
if (!out || dirs.length === 0) throw new Error('usage: code-tables-cli.ts <out.json> <xml dir>...');

const pages = new Map<string, CodeTablePage>();
let scanned = 0;
for (const dir of dirs) {
  for (const file of fs.readdirSync(dir).filter(f => /^\d{9}\d+a\.xml$/.test(f)).sort()) {
    const bytes = fs.readFileSync(path.join(dir, file));
    scanned++;
    // コード番号のページは、ほかの頁より前の方（目次の次）にある。全部を文字に直すのは重いので、宣言の文字コードで読むのは、見出しの語を持つ XML だけ
    const enc = /encoding="([^"]+)"/.exec(bytes.subarray(0, 200).toString('latin1'))?.[1] ?? 'utf-8';
    const text = new TextDecoder(enc).decode(bytes);
    if (!text.includes('コード番号')) continue;
    const sections = parseCodeNumberPage(text);
    if (!sections) continue;
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const dup = pages.get(file);
    if (dup) {
      if (dup.sha256 !== sha256) throw new Error(`同じ名前の XML の中身が違う: ${file}`);
      continue;
    }
    pages.set(file, { ...codeTableFileInfo(file), file, sha256, sections });
  }
}
const sorted = [...pages.values()].sort((a, b) => a.year - b.year || a.form.localeCompare(b.form) || a.file.localeCompare(b.file));
const json = {
  note: '財務省の予算書【XML版】（https://www.bb.mof.go.jp/server/{年}/xml/）の「(参考) コード番号について」のページから取り出した、分類コードの表。XML は Shift_JIS。出どころは、予算書・決算書データベース（利用条件は datasets/terms.json の bb.mof.go.jp）。取得日の記録は無い（手元にあった XML。FY2025・FY2026 の補正予算は 2026-10-27 に取得）。',
  pages: sorted,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
// 表の 1 行（[コード, 名称]）は 1 行に収める
fs.writeFileSync(out, JSON.stringify(json, null, 1).replace(/\[\n\s+("[^"\n]*"),\n\s+("[^"\n]*")\n\s+\]/g, '[$1, $2]') + '\n');
console.log(`XML ${scanned} 件を見て、コード番号のページ ${sorted.length} 件を書いた: ${out}`);
