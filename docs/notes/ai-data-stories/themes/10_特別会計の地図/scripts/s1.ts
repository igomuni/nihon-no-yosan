// 特別会計の会計別・年度別の政府案（項）と、目の合計の照合
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const acc = new Map<string, Record<number, number>>(); const tot: Record<number, number> = {}; const gen: Record<number, number> = {};
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
d.kous.forEach((k: any, i: number) => {
  if (!Y.includes(k.year)) return;
  const b = lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))).budget; if (b === undefined) return;
  if (k.account === 'general') { gen[k.year] = (gen[k.year] ?? 0) + b; return; }
  const r = acc.get(k.specialAccount) ?? acc.set(k.specialAccount, {}).get(k.specialAccount)!; r[k.year] = (r[k.year] ?? 0) + b; tot[k.year] = (tot[k.year] ?? 0) + b;
});
// 目の合計（特別会計）
const mt: Record<number, number> = {};
for (const n of m.nodes) { const id = m.kous[n[0]] as string; if (!id.includes(':special:') || !Y.includes(n[1])) continue; const v = mokuValue(n, 'budget'); if (v !== null) mt[n[1]] = (mt[n[1]] ?? 0) + v; }
const t = (x?: number) => x === undefined ? '-' : (x / 1e12).toFixed(2);
console.log('特別会計 項計 / 目計（兆円）', Y.map(y => `${y}:${t(tot[y])}/${t(mt[y] * 1000)}`).join(' '));
console.log('一般会計', Y.map(y => `${y}:${t(gen[y])}`).join(' '));
console.log('\n会計別（兆円）');
[...acc].sort((a, b) => (b[1][2026] ?? 0) - (a[1][2026] ?? 0)).forEach(([n, r]) => console.log(n.padEnd(14), Y.map(y => t(r[y]).padStart(6)).join(' '), ' Δ', t((r[2026] ?? 0) - (r[2017] ?? 0))));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2e-special/s1.json', JSON.stringify({ Y, tot, gen, mt, acc: [...acc] }));
