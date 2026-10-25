/**
 * 財務省の公式 CSV の zip から、項・目の CSV（当初予算・補正予算・決算）を年度ごとに作る。仕様: docs/guides/mof-history.md
 *
 * 使い方:
 *   記録を作る: node packages/pipeline/src/build/mof-archive-cli.ts record <zip のディレクトリ> <記録の JSON> <年度>...
 *   CSV を作る: node packages/pipeline/src/build/mof-archive-cli.ts build  <zip のディレクトリ> <記録の JSON> <出力ディレクトリ> <年度>...
 * - zip のディレクトリには `DL{年}{帳票}.zip` が並ぶ。記録（入力の zip の名前・SHA-256・バイト数）と違えば止まる。
 * - 出力: `<出力>/mof-archive/{年度}/{kou,moku}-{general,special}{,-hosei,-hosei-2,…,-kessan}.csv` と `summary.json`、`<出力>/manifest.json`（全ファイルの SHA-256）。
 * - 読む帳票: 当初予算 11001・12001、補正予算 21xxx・22xxx（回ごと）、決算 77001・78001（歳出の表のみ。政府関係機関の帳票は読まない）。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ACCOUNTS, buildBudgetCsv, buildHoseiKessanCsv, type Account } from './mof-archive.ts';

const [mode, zipDir, recordPath, ...rest] = process.argv.slice(2);
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const usage = 'usage: mof-archive-cli.ts record <zipDir> <record.json> <year>... | build <zipDir> <record.json> <outDir> <year>...';
if (!mode || !zipDir || !recordPath) throw new Error(usage);

interface Record_ { schema: string; note: string; inputs: Record<string, { sha256: string; bytes: number }> }
/** 帳票 ID（年を除く）が読む対象か */
const READ = /^(11001|12001|21\d{3}|22\d{3}|77001|78001)$/;
const zipsOfYear = (year: string): string[] =>
  fs.readdirSync(zipDir).filter(f => new RegExp(`^DL${year}\\d{5}\\.zip$`).test(f) && READ.test(f.slice(6, 11))).sort();

if (mode === 'record') {
  const years = rest;
  if (years.length === 0) throw new Error(usage);
  const inputs: Record_['inputs'] = {};
  for (const y of years) for (const f of zipsOfYear(y)) {
    const b = fs.readFileSync(path.join(zipDir, f));
    inputs[f] = { sha256: sha256(b), bytes: b.length };
  }
  const rec: Record_ = {
    schema: 'nihon-no-yosan/mof-archive-inputs/v0',
    note: '財務省の予算書・決算書データベースの公式 CSV の zip（手元にあったもの）。取得元の URL・取得日は記録がない（URL の形は https://www.bb.mof.go.jp/server/{年}/csv/{ファイル名} と推測、未確認）。ここに無い帳票は、手元の取得物に無かったもので、サイトに無いとは確かめていない',
    inputs: Object.fromEntries(Object.entries(inputs).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  fs.writeFileSync(recordPath, JSON.stringify(rec, null, 1) + '\n');
  console.log(`recorded ${Object.keys(inputs).length} zips`);
} else if (mode === 'build') {
  const [outDir, ...years] = rest;
  if (!outDir || years.length === 0) throw new Error(usage);
  const rec = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record_;
  const manifest: Record<string, { sha256: string; bytes: number }> = {};
  for (const y of years) {
    const yearDir = path.join(outDir, 'mof-archive', y);
    fs.mkdirSync(yearDir, { recursive: true });
    const summary: Record<string, unknown> = { year: Number(y), missing: [] as string[] };
    const write = (name: string, text: string): void => {
      fs.writeFileSync(path.join(yearDir, name), text);
      manifest[`mof-archive/${y}/${name}`] = { sha256: sha256(text), bytes: Buffer.byteLength(text) };
    };
    const zip = (docId: string) => {
      const name = `DL${y}${docId}.zip`;
      const r = rec.inputs[name];
      if (!r) return null;
      if (!fs.existsSync(path.join(zipDir, name))) throw new Error(`STOP: 記録にある zip が無い: ${name}`);
      return { zipPath: path.join(zipDir, name), sha256: r.sha256 };
    };
    for (const account of ACCOUNTS as readonly Account[]) {
      const budget = zip(account === 'general' ? '11001' : '12001');
      if (!budget) throw new Error(`STOP: ${y} の当初予算の zip が記録に無い`);
      const b = buildBudgetCsv(Number(y), account, budget);
      for (const [n, t] of Object.entries(b.files)) write(n, t);
      summary[`budget-${account}`] = b.summary;
      const rounds: unknown[] = [];
      for (let round = 1; round <= 9; round++) {
        const z = zip(`${account === 'general' ? '21' : '22'}${String(round).padStart(3, '0')}`);
        if (!z) break;
        const h = buildHoseiKessanCsv('hosei', Number(y), account, round, z);
        for (const [n, t] of Object.entries(h.files)) write(n, t);
        rounds.push({ round, ...h.summary });
      }
      summary[`hosei-${account}`] = rounds;
      const settle = zip(account === 'general' ? '77001' : '78001');
      if (settle) {
        const k = buildHoseiKessanCsv('kessan', Number(y), account, 1, settle);
        for (const [n, t] of Object.entries(k.files)) write(n, t);
        summary[`kessan-${account}`] = k.summary;
      } else (summary['missing'] as string[]).push(`kessan-${account}`);
      if (rounds.length === 0) (summary['missing'] as string[]).push(`hosei-${account}`);
    }
    write('summary.json', JSON.stringify(summary, null, 2) + '\n');
  }
  const prev = fs.existsSync(path.join(outDir, 'manifest.json')) ? (JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')) as { files: typeof manifest }).files : {};
  const files = Object.fromEntries(Object.entries({ ...prev, ...manifest }).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ schema: 'nihon-no-yosan/mof-archive-manifest/v0', inputs: recordPath.split('/').pop(), files }, null, 1) + '\n');
  console.log(`wrote ${Object.keys(manifest).length} files to ${outDir}`);
} else throw new Error(usage);
