// 人件費（使途別 1）を、目のデータ（moku.json.gz）から集計する。額は千円
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, mokuValue, lifecycleGroupsOf, lifecycleAcctOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const S = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
type Acc = 'general' | 'special';
const add = (o: any, k: string, y: number, v: number) => { (o[k] ??= {})[y] = (o[k][y] ?? 0) + v; };
const tot: Record<Acc, Record<number, number>> = { general: {}, special: {} };
const allUse: Record<Acc, Record<number, number>> = { general: {}, special: {} };
const byMin: Record<Acc, any> = { general: {}, special: {} };
const byName: Record<Acc, any> = { general: {}, special: {} };
const byAcct: any = {}; // 特別会計の名前別
const settle: Record<Acc, any> = { general: {}, special: {} }; // current/spent/unused/carried
const settleMin: any = {};
const noCode: Record<number, number> = {};
for (const n of m.nodes) {
  const y = n[1]; if (!Y.includes(y)) continue;
  const kouId = m.kous[n[0]] as string; const acc = kouId.split(':')[1] as Acc;
  const k = kouById.get(kouId);
  const c = codesOfMoku(n[3], acc);
  const b = mokuValue(n, 'budget');
  if (b !== null) { allUse[acc][y] = (allUse[acc][y] ?? 0) + b; if (c.use === '') noCode[y] = (noCode[y] ?? 0) + b; }
  if (c.use !== '1') continue;
  const g = k ? lifecycleGroupsOf(k) : ['(不明)'];
  const min = g.length > 1 ? g.join('・') : g[0]!;
  if (b !== null) {
    tot[acc][y] = (tot[acc][y] ?? 0) + b;
    add(byMin[acc], min, y, b);
    add(byName[acc], n[2], y, b);
    if (acc === 'special' && k) add(byAcct, lifecycleAcctOf(k), y, b);
  }
  if (S.includes(y)) for (const key of ['current', 'spent', 'unused', 'carried'] as const) {
    const v = mokuValue(n, key); if (v === null) continue;
    add(settle[acc], key, y, v);
    if (acc === 'general') add(settleMin, `${min}|${key}`, y, v);
  }
}
const t = (x?: number) => x === undefined ? '-' : (x / 1e9).toFixed(3);
console.log('人件費 政府案（兆円）');
for (const a of ['general', 'special'] as Acc[]) console.log(a, Y.map(y => `${y}:${t(tot[a][y])}`).join(' '));
console.log('全使途の政府案 一般', Y.map(y => t(allUse.general[y])).join(' '));
console.log('使途コード無し（一般+特別）', Y.map(y => t(noCode[y])).join(' '));
const top = (o: any, a = 2017, b = 2026, n = 12) => Object.entries(o).map(([k, r]: any) => ({ k, a: r[a] ?? null, b: r[b] ?? null, d: (r[b] ?? 0) - (r[a] ?? 0), r })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, n);
for (const a of ['general', 'special'] as Acc[]) { console.log(`\n府省 ${a} 2017→2026`); for (const x of top(byMin[a], 2017, 2026, 14)) console.log(x.k, t(x.a), '→', t(x.b), 'Δ', t(x.d)); }
console.log('\n特別会計の名前別 2017→2026'); for (const x of top(byAcct, 2017, 2026, 12)) console.log(x.k, t(x.a), '→', t(x.b), 'Δ', t(x.d));
for (const a of ['general', 'special'] as Acc[]) { console.log(`\n目名 ${a} 2017→2026`); for (const x of top(byName[a], 2017, 2026, 16)) console.log(x.k, t(x.a), '→', t(x.b), 'Δ', t(x.d)); }
console.log('\nFY2025→2026 一般 府省'); for (const x of top(byMin.general, 2025, 2026, 10)) console.log(x.k, t(x.a), '→', t(x.b), 'Δ', t(x.d));
console.log('\nFY2025→2026 一般 目名'); for (const x of top(byName.general, 2025, 2026, 10)) console.log(x.k, t(x.a), '→', t(x.b), 'Δ', t(x.d));
console.log('\n決算 人件費（兆円）');
for (const a of ['general', 'special'] as Acc[]) for (const key of ['current', 'spent', 'unused', 'carried']) console.log(a, key, S.map(y => t(settle[a][key]?.[y])).join(' '));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2d-personnel/p1.json', JSON.stringify({ Y, S, tot, allUse, byMin, byName, byAcct, settle, settleMin }));
