import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, codeNameOf, mokuValue, lifecycleValues, lifecycleRowAmounts } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz'), codes = rd('codes.json.gz');
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
// 項の政府案の合計（一般会計・特別会計）
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const kouTot: Record<string, Record<number, number>> = { general: {}, special: {} };
d.kous.forEach((k: any, i: number) => { const a = lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))); if (a.budget !== undefined) kouTot[k.account][k.year] = (kouTot[k.account][k.year] ?? 0) + a.budget; });
// 目の政府案を、主要経費別・使途別で
const acctOf = (n: any) => (m.kous[n[0]] as string).split(':')[1] as 'general' | 'special';
const by: Record<string, Map<string, Record<number, number>>> = { major: new Map(), use: new Map() };
const mokuTot: Record<string, Record<number, number>> = { general: {}, special: {} };
for (const n of m.nodes) {
  const y = n[1]; if (!Y.includes(y)) continue;
  const v = mokuValue(n, 'budget'); if (v === null) continue;
  const a = acctOf(n); mokuTot[a][y] = (mokuTot[a][y] ?? 0) + v;
  if (a !== 'general') continue;
  const c = codesOfMoku(n[3], a);
  for (const ax of ['major', 'use'] as const) { const key = c[ax] || '(なし)'; const r = by[ax].get(key) ?? by[ax].set(key, {}).get(key)!; r[y] = (r[y] ?? 0) + v; }
}
const t = (x: number | undefined) => x === undefined ? '-' : (x / 1e9).toFixed(2); // 千円→兆円
console.log('一般会計 政府案 項計/目計（兆円）', Y.map(y => `${y}:${t(kouTot.general[y] / 1000)}/${t(mokuTot.general[y])}`).join(' '));
console.log('特別会計 政府案 項計（兆円）', Y.map(y => `${y}:${t(kouTot.special[y] / 1000)}`).join(' '));
const out: any = {};
for (const ax of ['major', 'use'] as const) {
  const rows = [...by[ax]].map(([code, r]) => {
    const names = [...new Set(Y.filter(y => r[y] !== undefined).map(y => codeNameOf(codes, ax, code, y, 'general')?.name ?? '?'))];
    return { code, names, r, d: (r[2026] ?? 0) - (r[2017] ?? 0) };
  }).sort((a, b) => b.d - a.d);
  out[ax] = rows;
  console.log(`\n== 一般会計・${ax}（兆円）  2017 → 2026  差`);
  for (const x of rows) console.log(x.code.padEnd(4), x.names.join('／').slice(0, 40).padEnd(30), t(x.r[2017]), '→', t(x.r[2026]), ' Δ', (x.d / 1e9).toFixed(2), ' |', Y.map(y => t(x.r[y])).join(' '));
}
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/a1.json', JSON.stringify({ kouTot, mokuTot, out }));
