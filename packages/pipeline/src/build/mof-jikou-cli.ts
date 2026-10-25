/**
 * 財務省の予算書【XML版】（当初予算）から、事項の CSV を年度ごとに作る。仕様: docs/guides/mof-history.md
 *
 * 使い方:
 *   記録を作る: node packages/pipeline/src/build/mof-jikou-cli.ts record <XML の置き場> <記録の JSON> <年度>...
 *   CSV を作る: node packages/pipeline/src/build/mof-jikou-cli.ts build  <XML の置き場> <記録の JSON> <出力ディレクトリ> <年度>...
 * - XML の置き場は、`mof_{年度}/xml/`（XML と `{帳票}menu.html` が並ぶ）を持つ（前のリポジトリの `data/download_old`）。
 * - 記録は、帳票ごとの目次・XML の集合の SHA-256 と件数。`build` は、記録と違えば止まる。
 * - 出力: `<出力>/mof-archive/{年度}/jikou-{general,special}.csv`。`<出力>/manifest.json` に、SHA-256 を足す（`mof-archive-cli.ts` の出力と同じ manifest）。
 * - 事項と項の突き合わせ: 事項の額の合計が、項の CSV（`kou-{general,special}.csv`）の額と、項ごとに一致することを確かめる（一致しなければ止まる）。
 */
import { parseCsv } from '@nihon-no-yosan/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildJikou, documentIdOf, type JikouAccount, type JikouRecord } from './mof-jikou.ts';

const [mode, xmlRoot, recordPath, ...rest] = process.argv.slice(2);
const usage = 'usage: mof-jikou-cli.ts record <xmlRoot> <record.json> <year>... | build <xmlRoot> <record.json> <outDir> <year>...';
if (!mode || !xmlRoot || !recordPath) throw new Error(usage);
const ACCOUNTS: JikouAccount[] = ['general', 'special'];
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const target = (year: string, account: JikouAccount) => {
  const xmlDir = path.join(xmlRoot, `mof_${year}`, 'xml');
  return { year: Number(year), account, xmlDir, menuPath: path.join(xmlDir, `${documentIdOf(Number(year), account)}menu.html`) };
};
interface RecordFile { schema: string; note: string; jikou: Record<string, JikouRecord> }

if (mode === 'record') {
  const jikou: RecordFile['jikou'] = {};
  for (const y of rest) for (const a of ACCOUNTS) jikou[documentIdOf(Number(y), a)] = buildJikou(target(y, a)).record;
  const rec: RecordFile = {
    schema: 'nihon-no-yosan/mof-jikou-inputs/v0',
    note: '財務省の予算書【XML版】（当初予算）の目次と XML（手元にあったもの）の SHA-256 と、最初に作ったときの件数。件数は、パーサーが読んだ結果で、独立に確かめたものではない。取得日の記録は無い。取得元の URL の形（https://www.bb.mof.go.jp/server/{年}/xml/{ファイル名}）は、年度ごとに 6 件を無作為に選んだ XML 計 48 件について、サイトにあり、バイト数が一致することを確かめた（2026-10-25、ヘッダだけ）',
    jikou,
  };
  fs.writeFileSync(recordPath, JSON.stringify(rec, null, 1) + '\n');
  console.log(`recorded ${Object.keys(jikou).length} documents`);
} else if (mode === 'build') {
  const [outDir, ...years] = rest;
  if (!outDir || years.length === 0) throw new Error(usage);
  const rec = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as RecordFile;
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { files: Record<string, { sha256: string; bytes: number }> };
  for (const y of years) {
    for (const a of ACCOUNTS) {
      const expected = rec.jikou[documentIdOf(Number(y), a)];
      if (!expected) throw new Error(`STOP: ${y} ${a} の記録が無い`);
      const b = buildJikou(target(y, a), expected);
      // 事項の額の合計 = 項の額（項ごと）
      const kouRows = parseCsv(fs.readFileSync(path.join(outDir, 'mof-archive', y, `kou-${a}.csv`), 'utf8').replace(/^\uFEFF/, ''));
      const kh = kouRows[0]!;
      const jr = parseCsv(b.csv);
      const jh = jr[0]!;
      // 特別会計の所管は、項の CSV では共管の府省をつないだ文字列、事項の CSV では目次の所管で、表記が違うので、鍵に入れない
      const kKeyCols = a === 'general' ? ['所管', '組織', '項コード', '項名'] : ['特別会計', '勘定', '項コード', '項名'];
      const kAmt = kh.findIndex(h => /要求額|予定額/.test(h) && h.includes('合計'));
      const jAmt = jh.findIndex(h => /要求額|予定額/.test(h));
      const sums = new Map<string, number>();
      for (const r of jr.slice(1)) {
        if (r.length < 2) continue;
        const key = JSON.stringify(kKeyCols.map(c => r[jh.indexOf(c)]));
        sums.set(key, (sums.get(key) ?? 0) + Number(r[jAmt]));
      }
      const kou = new Map<string, number>();
      for (const r of kouRows.slice(1)) {
        if (r.length < 2) continue;
        const key = JSON.stringify(kKeyCols.map(c => r[kh.indexOf(c)]));
        kou.set(key, (kou.get(key) ?? 0) + Number(r[kAmt]));
      }
      const onlyJikou = [...sums.keys()].filter(k => !kou.has(k));
      const onlyKou = [...kou.keys()].filter(k => !sums.has(k));
      const differ = [...sums].filter(([k, v]) => kou.has(k) && kou.get(k) !== v);
      if (onlyJikou.length || onlyKou.length || differ.length) {
        throw new Error(`STOP: ${y} ${a}: 事項と項が合わない（事項だけ ${onlyJikou.length}、項だけ ${onlyKou.length}、額が違う ${differ.length}）。例: ${JSON.stringify([onlyJikou[0], onlyKou[0], differ[0]])}`);
      }
      const name = `jikou-${a}.csv`;
      fs.writeFileSync(path.join(outDir, 'mof-archive', y, name), b.csv);
      manifest.files[`mof-archive/${y}/${name}`] = { sha256: sha256(b.csv), bytes: Buffer.byteLength(b.csv) };
      console.log(`${y} ${a}: 事項 ${b.record.records} 行、項 ${kou.size}（項ごとの合計が一致）`);
    }
  }
  manifest.files = Object.fromEntries(Object.entries(manifest.files).sort(([x], [y]) => (x < y ? -1 : 1)));
  fs.writeFileSync(manifestPath, JSON.stringify({ schema: 'nihon-no-yosan/mof-archive-manifest/v0', ...manifest }, null, 1) + '\n');
} else throw new Error(usage);
