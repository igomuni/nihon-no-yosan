// 目の政府案（当初）を、経済性質別コードで集計する。80〜86 = 対地方政府移転
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue, codeNameOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const m = rd('moku.json.gz'), d = rd('data.json.gz'), codes = rd('codes.json.gz');
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const kouOf = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const econOf = (n: any, acct: string) => { const c = n[3] === '' ? [] : String(n[3]).split('|'); return (acct === 'general' ? c[3] : c[2]) ?? ''; };
const add = (o: any, k: string, y: number, v: number) => { (o[k] ??= {})[y] = (o[k][y] ?? 0) + v; };
const econAll: any = { general: {}, special: {} }, loc: any = { general: {}, special: {} };
const genByMin: any = {}, genByMajor: any = {}, spByAcct: any = {}, spByAcctKou: any = {}, genByMoku: any = {};
const kofuKou: any = {}, kofuMoku: any = {};
const tot: any = { general: {}, special: {} };
let noCode: any = { general: {}, special: {} };
for (const n of m.nodes) {
  const y = n[1]; if (!Y.includes(y)) continue;
  const v = mokuValue(n, 'budget'); if (v === null) continue;
  const kid = m.kous[n[0]] as string; const acct = kid.split(':')[1]; const k = kouOf.get(kid);
  tot[acct][y] = (tot[acct][y] ?? 0) + v;
  const e = econOf(n, acct);
  if (e === '') add(noCode, acct, y, v);
  add(econAll[acct], e || '(なし)', y, v);
  if (k && k.account === 'special' && k.specialAccount === '交付税及び譲与税配付金') { add(kofuKou, k.name, y, v); add(kofuMoku, `${k.name} / ${n[2]} [${e}]`, y, v); }
  if (!/^8[0-6]$/.test(e)) continue;
  add(loc[acct], e, y, v);
  if (acct === 'general') {
    add(genByMin, k ? k.ministry + (k.ministry === '内閣府' && k.org !== '内閣本府' ? '/' + k.org : '') : '?', y, v);
    const mj = String(n[3]).split('|')[0];
    add(genByMajor, mj, y, v);
    add(genByMoku, `${k?.ministry ?? '?'} / ${k?.name ?? '?'} / ${n[2]}`, y, v);
  } else {
    add(spByAcct, k ? k.specialAccount : '?', y, v);
    add(spByAcctKou, `${k?.specialAccount} / ${k?.name}`, y, v);
  }
}
const t = (x?: number) => x === undefined ? '-' : (x / 1e9).toFixed(2);
console.log('合計（兆円）一般/特別', Y.map(y => `${y}:${t(tot.general[y])}/${t(tot.special[y])}`).join(' '));
console.log('経済性質コード無し 一般/特別', Y.map(y => `${t(noCode.general[y])}/${t(noCode.special[y])}`).join(' '));
for (const a of ['general', 'special']) { console.log(`\n== ${a} 経済性質別（2017→2026）`); Object.entries(econAll[a]).sort((x: any, z: any) => (z[1][2026] ?? 0) - (x[1][2026] ?? 0)).forEach(([c, r]: any) => console.log(c, t(r[2017]), '→', t(r[2026]))); }
for (const a of ['general', 'special']) console.log(`\n== ${a} 対地方 8x`, Y.map(y => `${y}:${t(Object.values(loc[a]).reduce((s: number, r: any) => s + (r[y] ?? 0), 0))}`).join(' '), JSON.stringify(Object.fromEntries(Object.entries(loc[a]).map(([c, r]: any) => [c, `${t(r[2017])}→${t(r[2026])}`]))));
const top = (o: any, n = 12) => Object.entries(o).sort((x: any, z: any) => (z[1][2026] ?? 0) - (x[1][2026] ?? 0)).slice(0, n).forEach(([c, r]: any) => console.log('  ', c, t(r[2017]), '→', t(r[2026]), '|', Y.map(y => t(r[y])).join(' ')));
console.log('\n一般会計 対地方 府省別'); top(genByMin, 20);
console.log('\n一般会計 対地方 主要経費別'); Object.entries(genByMajor).sort((x: any, z: any) => (z[1][2026] ?? 0) - (x[1][2026] ?? 0)).slice(0, 15).forEach(([c, r]: any) => console.log('  ', c, codeNameOf(codes, 'major', c, 2026, 'general')?.name, t(r[2017]), '→', t(r[2026])));
console.log('\n一般会計 対地方 目（2026 上位）'); top(genByMoku, 15);
console.log('\n特別会計 対地方 会計別'); top(spByAcct, 15);
console.log('\n特別会計 対地方 会計/項'); top(spByAcctKou, 15);
console.log('\n交付税特会 項'); top(kofuKou, 20);
console.log('\n交付税特会 目'); top(kofuMoku, 30);
writeFileSync(process.argv[2] ?? '/dev/null', JSON.stringify({ Y, tot, noCode, econAll, loc, genByMin, genByMajor, genByMoku, spByAcct, spByAcctKou, kofuKou, kofuMoku }));
