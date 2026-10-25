/**
 * 財務省の予算書【XML版】の補正予算から、事項の補正の額の CSV を年度ごとに作る。仕様: docs/guides/mof-history.md
 *
 * 使い方:
 *   記録を作る: node packages/pipeline/src/build/mof-jikou-hosei-cli.ts record <XML の置き場> <記録の JSON> <年度>...
 *   CSV を作る: node packages/pipeline/src/build/mof-jikou-hosei-cli.ts build  <XML の置き場> <記録の JSON> <出力ディレクトリ> [--reference=<基準データ>] <年度>...
 * - XML の置き場は、`mof_{年度}/xml/`（XML と `{帳票}menu.html` が並ぶ）を持つ（前のリポジトリの `data/download_old`）。補正の回は、目次がある回だけ。
 * - 出力: `<出力>/mof-archive/{年度}/jikou-{general,special}-hosei{,-2,-3}.csv`。`<出力>/manifest.json` に SHA-256 を足す。
 * - 事項と項の突き合わせ: 項ごとの額（事項の行の合計。事項の行が無い項は項の行）が、項の CSV（`kou-{general,special}-hosei{,-2,-3}.csv`）の 5 つの額と一致することを確かめる（一致しなければ止まる）。
 *   項の CSV は、出力ディレクトリに無い年度（基準データの FY2023・FY2024）は、`--reference` の基準データから読む。
 */
import { parseCsv } from '@nihon-no-yosan/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { JikouAccount, JikouRecord } from './mof-jikou.ts';
import { buildJikouHosei, hoseiDocumentIdOf, hoseiFileName } from './mof-jikou-hosei.ts';

const args = process.argv.slice(2);
const reference = args.find(a => a.startsWith('--reference='))?.slice('--reference='.length);
const [mode, xmlRoot, recordPath, ...rest] = args.filter(a => !a.startsWith('--reference='));
const usage = 'usage: mof-jikou-hosei-cli.ts record <xmlRoot> <record.json> <year>... | build <xmlRoot> <record.json> <outDir> [--reference=<dataset>] <year>...';
if (!mode || !xmlRoot || !recordPath) throw new Error(usage);
const ACCOUNTS: JikouAccount[] = ['general', 'special'];
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const target = (year: string, account: JikouAccount, round: number) => {
  const xmlDir = path.join(xmlRoot, `mof_${year}`, 'xml');
  return { year: Number(year), account, round, xmlDir, menuPath: path.join(xmlDir, `${hoseiDocumentIdOf(Number(year), account, round)}menu.html`) };
};
const roundsOf = (year: string, account: JikouAccount): number[] => [1, 2, 3, 4, 5].filter(r => fs.existsSync(target(year, account, r).menuPath));
interface RecordFile { schema: string; note: string; hosei: Record<string, JikouRecord> }

if (mode === 'record') {
  const hosei: RecordFile['hosei'] = {};
  for (const y of rest) for (const a of ACCOUNTS) for (const r of roundsOf(y, a)) hosei[hoseiDocumentIdOf(Number(y), a, r)] = buildJikouHosei(target(y, a, r)).record;
  const rec: RecordFile = {
    schema: 'nihon-no-yosan/mof-jikou-hosei-inputs/v0',
    note: '財務省の予算書【XML版】（補正予算）の目次と XML（手元にあったもの）の SHA-256 と、最初に作ったときの件数。件数は、パーサーが読んだ結果で、独立に確かめたものではない。取得日の記録は無い。取得元の URL の形（https://www.bb.mof.go.jp/server/{年}/xml/{ファイル名}）は、年度ごとに 6 件を無作為に選んだ XML 計 48 件について、サイトにあり、バイト数が一致することを確かめた（2026-10-25、ヘッダだけ）',
    hosei,
  };
  fs.writeFileSync(recordPath, JSON.stringify(rec, null, 1) + '\n');
  console.log(`recorded ${Object.keys(hosei).length} documents`);
} else if (mode === 'build') {
  const [outDir, ...years] = rest;
  if (!outDir || years.length === 0) throw new Error(usage);
  const rec = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as RecordFile;
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { files: Record<string, { sha256: string; bytes: number }> };
  const AMOUNT_NAMES = ['成立予算額', '追加額', '修正減少額', '差引額', '改'] as const;
  for (const y of years) {
    const yearSummary: Record<string, { kou: number; withJikou: number; kouWithoutJikou: string[][]; amountsMatched: number }> = {};
    for (const a of ACCOUNTS) {
      for (const round of roundsOf(y, a)) {
        const id = hoseiDocumentIdOf(Number(y), a, round);
        const expected = rec.hosei[id];
        if (!expected) throw new Error(`STOP: ${id} の記録が無い`);
        const b = buildJikouHosei(target(y, a, round), expected);
        // 項ごとの額の突き合わせ
        const name = hoseiFileName(a, round);
        const kouName = name.replace('jikou-', 'kou-');
        const own = path.join(outDir, 'mof-archive', y, kouName);
        const kouPath = fs.existsSync(own) ? own : reference ? path.join(reference, 'mof-archive', y, kouName) : '';
        if (!kouPath || !fs.existsSync(kouPath)) throw new Error(`STOP: ${y} の ${kouName} が無い（--reference が要る）`);
        const kr = parseCsv(fs.readFileSync(kouPath, 'utf8').replace(/^\uFEFF/, ''));
        const kh = kr[0]!;
        const jr = parseCsv(b.csv);
        const jh = jr[0]!;
        const keyCols = a === 'general' ? ['所管', '組織', '項コード', '項名'] : ['特別会計', '勘定', '項コード', '項名'];
        const kIx = AMOUNT_NAMES.map(n => kh.findIndex(h => h.includes('合計') && (n === '改' ? h.startsWith('改') : h.includes(n))));
        const jIx = AMOUNT_NAMES.map(n => jh.findIndex(h => (n === '改' ? h.startsWith('改') : h.includes(n))));
        if (kIx.includes(-1) || jIx.includes(-1)) throw new Error(`STOP: ${id}: 額の列が見つからない`);
        const total = (rows: string[][], head: string[], ix: number[]): Map<string, number[]> => {
          const m = new Map<string, number[]>();
          for (const r of rows.slice(1)) {
            if (r.length < 2) continue;
            const key = JSON.stringify(keyCols.map(c => r[head.indexOf(c)]));
            const cur = m.get(key) ?? [0, 0, 0, 0, 0];
            ix.forEach((i, k) => { cur[k] = cur[k]! + Number(r[i]); });
            m.set(key, cur);
          }
          return m;
        };
        const jt = total(jr, jh, jIx);
        const kt = total(kr, kh, kIx);
        const onlyJ = [...jt.keys()].filter(k => !kt.has(k));
        const onlyK = [...kt.keys()].filter(k => !jt.has(k));
        const differ = [...jt].filter(([k, v]) => kt.has(k) && v.some((x, i) => x !== kt.get(k)![i]));
        // 事項の表が XML に無い項（項の CSV だけにある）は、XML に事項の表が無いという原本の事実として数えて残す。事項の CSV にだけある項と、額が違う項は、止まる
        if (onlyJ.length || differ.length) {
          throw new Error(`STOP: ${id}: 事項と項が合わない（事項だけ ${onlyJ.length}、額が違う ${differ.length}）。例（事項だけ・額が違う）: ${JSON.stringify([onlyJ.slice(0, 3), differ.slice(0, 2)])}`);
        }
        yearSummary[name] = { kou: kt.size, withJikou: jt.size, kouWithoutJikou: onlyK.map(k => JSON.parse(k) as string[]), amountsMatched: jt.size };
        fs.mkdirSync(path.join(outDir, 'mof-archive', y), { recursive: true });
        fs.writeFileSync(path.join(outDir, 'mof-archive', y, name), b.csv);
        manifest.files[`mof-archive/${y}/${name}`] = { sha256: sha256(b.csv), bytes: Buffer.byteLength(b.csv) };
        console.log(`${y} ${a} 第${round}回: ${b.record.records} 行、項 ${kt.size} のうち ${jt.size} 項に事項の表があり、5 つの額が一致${onlyK.length ? `（事項の表が無い項 ${onlyK.length}）` : ''}`);
      }
    }
    const sumName = 'jikou-hosei-summary.json';
    fs.writeFileSync(path.join(outDir, 'mof-archive', y, sumName), JSON.stringify({ year: Number(y), files: yearSummary }, null, 1) + '\n');
    manifest.files[`mof-archive/${y}/${sumName}`] = { sha256: sha256(fs.readFileSync(path.join(outDir, 'mof-archive', y, sumName))), bytes: fs.statSync(path.join(outDir, 'mof-archive', y, sumName)).size };
  }
  manifest.files = Object.fromEntries(Object.entries(manifest.files).sort(([x], [y]) => (x < y ? -1 : 1)));
  fs.writeFileSync(manifestPath, JSON.stringify({ schema: 'nihon-no-yosan/mof-archive-manifest/v0', ...manifest }, null, 1) + '\n');
} else throw new Error(usage);
