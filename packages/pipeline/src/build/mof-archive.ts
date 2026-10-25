/**
 * 財務省の予算書・決算書データベース（`www.bb.mof.go.jp`）の公式 CSV（`DL{年}{帳票}.zip`）から、項・目の CSV を作る。仕様: docs/guides/mof-history.md
 *
 * 原本の形のまま（行は `source_row` を足すだけ。値の補正・推測・足し算はしない）。項は目を項のキーで集計したもの。
 * 当初予算（`11001` 一般、`12001` 特別）、補正予算（`21001`・`22001`。複数回あるときは `…002`・`…003`）、決算（`77001` 一般、`78001` 特別）の歳出（b.csv）を読む。
 * 入力の zip の SHA-256 が記録と違えば、何も出さずに止まる。
 */
import { parseCsv } from '@nihon-no-yosan/core';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Account = 'general' | 'special';
export const ACCOUNTS: readonly Account[] = ['general', 'special'];
/** 当初予算の帳票 ID の末尾 */
const BUDGET_DOC: Record<Account, string> = { general: '11001', special: '12001' };
/** 補正予算の帳票 ID の頭 2 桁（末尾 3 桁が回） */
const SUPP_DOC: Record<Account, string> = { general: '21', special: '22' };
const SETTLE_DOC: Record<Account, string> = { general: '77001', special: '78001' };

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const cell = (v: string | number): string => { const s = String(v); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (header: string[], rows: (string | number)[][]): string => [header, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
const fail = (m: string): never => { throw new Error(`STOP: ${m}`); };

/** zip の入力。`sha256` は記録の値（違えば止まる） */
export interface ZipInput {
  zipPath: string;
  sha256: string;
}

/** zip の中の 1 つの CSV を、見出しと行にする（UTF-8、BOM と改行を正規化） */
function readMember(zipPath: string, member: string): { header: string[]; rows: string[][]; text: string } {
  const raw = execFileSync('unzip', ['-p', zipPath, member], { maxBuffer: 1 << 30 });
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const all = parseCsv(text);
  return { header: all[0]!, rows: all.slice(1).filter(r => r.length > 0), text };
}

function checkZip(z: ZipInput): void {
  if (sha256(fs.readFileSync(z.zipPath)) !== z.sha256) fail(`${z.zipPath} SHA-256 mismatch`);
}

/** 当初予算の項・目。`doc` は `11001`/`12001`。返り値は出力ファイル名 → 内容と、件数の記録 */
export function buildBudgetCsv(year: number, account: Account, zip: ZipInput): { files: Record<string, string>; summary: Record<string, unknown> } {
  checkZip(zip);
  const doc = `${year}${BUDGET_DOC[account]}`;
  const { header, rows } = readMember(zip.zipPath, `DL${doc}b.csv`);
  const ix = new Map(header.map((h, i) => [h, i]));
  const keyCols = account === 'general'
    ? ['所管', '組織', '項コード', '項名']
    : ['所管', '特別会計', '勘定', '項コード', '項名', '共管所管名', '共管組織名'];
  const miss = keyCols.filter(c => !ix.has(c));
  if (miss.length) fail(`${zip.zipPath} lacks columns ${miss.join(',')}`);
  const cur = header.length - 3, prv = header.length - 2; // 末尾 3 列が 当年度・前年度・比較増△減（見出しは版で違う）
  const int = (s: string): number => { if (!/^-?\d+$/.test(s)) fail(`${zip.zipPath} 整数でない値 ${JSON.stringify(s)}`); return Number(s); };
  for (const r of rows) {
    if (r.length !== header.length) fail(`${zip.zipPath} row length ${r.length} != ${header.length}`);
    for (const i of [cur, prv, cur + 2]) int(r[i]!);
  }
  const kou = new Map<string, { key: string[]; rows: number; cur: number; prv: number }>();
  for (const r of rows) {
    const key = keyCols.map(c => r[ix.get(c)!]!);
    const k = JSON.stringify(key);
    const e = kou.get(k) ?? { key, rows: 0, cur: 0, prv: 0 };
    e.rows++; e.cur += int(r[cur]!); e.prv += int(r[prv]!); kou.set(k, e);
  }
  if (account === 'special') { // 共管の列は 1 つの項の中で一定でなければならない
    const base = new Map<string, Set<string>>();
    for (const e of kou.values()) { const b = JSON.stringify(e.key.slice(0, 5)); (base.get(b) ?? base.set(b, new Set()).get(b)!).add(JSON.stringify(e.key.slice(5))); }
    const bad = [...base].filter(([, s]) => s.size > 1).map(([b]) => b);
    if (bad.length) fail(`${zip.zipPath} 共管 columns vary within a 項: ${bad.slice(0, 3).join(' ')}`);
  }
  const totCur = rows.reduce((s, r) => s + int(r[cur]!), 0), totPrv = rows.reduce((s, r) => s + int(r[prv]!), 0);
  if (totCur !== [...kou.values()].reduce((s, e) => s + e.cur, 0) || totPrv !== [...kou.values()].reduce((s, e) => s + e.prv, 0)) fail(`${zip.zipPath} 項の合計が総計と一致しない`);
  const topCols = account === 'general' ? ['所管', '組織'] : ['所管', '特別会計'];
  return {
    files: {
      [`kou-${account}.csv`]: toCsv([...keyCols, '目の行数', `${header[cur]}の合計`, `${header[prv]}の合計`], [...kou.values()].map(e => [...e.key, e.rows, e.cur, e.prv])),
      [`moku-${account}.csv`]: toCsv([...header, 'source_row'], rows.map((r, n) => [...r, String(n + 1)])),
    },
    summary: {
      zip: path.basename(zip.zipPath), zip_sha256: zip.sha256, moku_rows: rows.length, kou: kou.size,
      所管: new Set(rows.map(r => r[ix.get('所管')!])).size,
      [account === 'general' ? '組織' : '特別会計']: new Set(rows.map(r => JSON.stringify(topCols.map(c => r[ix.get(c)!])))).size,
      columns: header, 'total_current(千円)': totCur, 'total_previous(千円)': totPrv, sum_of_kou_totals_equals_total: true,
    },
  };
}

/** 補正予算・決算の目・項。`round` は補正の回（1 から。決算では 1）。出力名の接尾辞は、補正の 2 回目以降だけ `-{回}` */
export function buildHoseiKessanCsv(kind: 'hosei' | 'kessan', year: number, account: Account, round: number, zip: ZipInput): { files: Record<string, string>; summary: Record<string, unknown> } {
  checkZip(zip);
  const docId = kind === 'hosei' ? `${SUPP_DOC[account]}${String(round).padStart(3, '0')}` : SETTLE_DOC[account];
  const doc = `${year}${docId}`;
  // 歳出の表は zip の中の b.csv が普通だが、FY2025 の特別会計の補正予算では a.csv と b.csv が入れ替わっている（b.csv が歳入）。
  // 見出しに `主要経費別分類コード` を持つ（歳出の）ファイルを選ぶ。ちょうど 1 つでなければ止まる
  const spending = ['a', 'b'].filter(x => /主要経費別分類コード/.test(readMember(zip.zipPath, `DL${doc}${x}.csv`).text.split('\n', 1)[0]!));
  if (spending.length !== 1) fail(`${zip.zipPath} 歳出の表（見出しに主要経費別分類コードを持つ csv）がちょうど 1 つでない: ${spending.join(',')}`);
  const { header, rows } = readMember(zip.zipPath, `DL${doc}${spending[0]}.csv`);
  // 金額の列＝見出しが `(円)` か `(千円)` で終わる列（特別会計の決算には `予算総則の規定による経費増額` の列が 1 つ多い）
  const amountIx = header.map((h, i) => (/\((千円|円)\)$/.test(h) ? i : -1)).filter(i => i >= 0);
  const firstAmount = amountIx[0]!;
  if (amountIx.length === 0 || amountIx.some((i, k) => i !== firstAmount + k) || amountIx[amountIx.length - 1] !== header.length - 1) fail(`${zip.zipPath} 金額の列が末尾に連続していない`);
  const num = (s: string): number | null => (/^-?\d+$/.test(s) ? Number(s) : null);
  for (const r of rows) {
    if (r.length !== header.length) fail(`${zip.zipPath} row length ${r.length} != ${header.length}`);
    for (const i of amountIx) if (r[i] !== '' && num(r[i]!) === null) fail(`${zip.zipPath} 整数でない金額 ${JSON.stringify(r[i])}`);
  }
  // 原本の列の恒等式（成否の件数だけ報告。直さない）。全部が空欄の行は、検算の対象にしない（0 として足さない）
  const col = (re: RegExp): number => { const i = amountIx.find(k => re.test(header[k]!)); if (i === undefined) fail(`${zip.zipPath} 見出し ${re} がない`); return i as number; };
  const v = (r: string[], i: number): number => num(r[i]!) ?? 0;
  let holds = 0, fails = 0, blank = 0;
  const base = kind === 'hosei' ? col(/成立予算額/) : col(/^歳出予算額/);
  for (const r of rows) {
    if (amountIx.every(i => r[i] === '')) { blank++; continue; }
    if (kind === 'hosei') {
      const add = col(/追加額/), sub = col(/修正減少額/), diff = col(/差引額/), after = col(/^改/);
      if (v(r, after) === v(r, base) + v(r, diff) && v(r, diff) === v(r, add) + v(r, sub)) holds++;
      else fails++;
    } else {
      const current = col(/歳出予算現額/), paid = col(/支出済歳出額/), carry = col(/翌年度繰越額/), unused = col(/不用額/);
      let between = 0; for (let i = base + 1; i < current; i++) between += v(r, i);
      if (v(r, current) === v(r, base) + between && v(r, unused) === v(r, current) - v(r, paid) - v(r, carry)) holds++;
      else fails++;
    }
  }
  const suffix = kind === 'hosei' && round > 1 ? `${kind}-${round}` : kind;
  const KOU_KEY = ['所管', '組織', '特別会計', '勘定', '款コード', '項コード', '款名', '項名', '共管所管名', '共管組織名'].filter(c => header.includes(c));
  const kou = new Map<string, { key: string[]; rows: number; sums: number[] }>();
  for (const r of rows) {
    const key = KOU_KEY.map(c => r[header.indexOf(c)]!); const k = JSON.stringify(key);
    const e = kou.get(k) ?? { key, rows: 0, sums: amountIx.map(() => 0) }; e.rows++; amountIx.forEach((i, j) => { e.sums[j]! += v(r, i); }); kou.set(k, e);
  }
  for (let j = 0; j < amountIx.length; j++) {
    const total = rows.reduce((t, r) => t + v(r, amountIx[j]!), 0);
    if (total !== [...kou.values()].reduce((t, e) => t + e.sums[j]!, 0)) fail(`${zip.zipPath} 項の合計が総計と一致しない ${header[amountIx[j]!]}`);
  }
  return {
    files: {
      [`moku-${account}-${suffix}.csv`]: toCsv([...header, 'source_row'], rows.map((r, i) => [...r, String(i + 1)])),
      [`kou-${account}-${suffix}.csv`]: toCsv([...KOU_KEY, '目の行数', ...amountIx.map(i => `${header[i]}の合計`)], [...kou.values()].map(e => [...e.key, String(e.rows), ...e.sums.map(String)])),
    },
    summary: { source_file: `DL${doc}${spending[0]}.csv`, kou: kou.size, zip: path.basename(zip.zipPath), zip_sha256: zip.sha256, rows: rows.length, amount_columns: header.slice(firstAmount), identity_holds: holds, identity_fails: fails, all_blank_rows: blank },
  };
}
