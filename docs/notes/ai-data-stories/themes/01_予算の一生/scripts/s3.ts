// 主要経費別（目の分類コード）の現額・支出済・繰越・不用。目の合計が項の合計と一致するかも確かめる
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, codeNameOf, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const m = rd('moku.json.gz'), codes = rd('codes.json.gz'), s1 = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t1-lifecycle/s1.json', 'utf8'));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const K = ['current', 'spent', 'carried', 'unused', 'carriedIn'] as const;
const tot: Record<number, Record<string, number>> = {}; const by = new Map<string, Record<number, Record<string, number>>>(); let noCode = 0;
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:') || !Y.includes(n[1])) continue;
  const c = codesOfMoku(n[3], 'general').major || '(なし)';
  for (const k of K) { const v = mokuValue(n, k); if (v === null) continue; const t = (tot[n[1]] ??= {}); t[k] = (t[k] ?? 0) + v; const r = by.get(c) ?? by.set(c, {}).get(c)!; const ry = (r[n[1]] ??= {}); ry[k] = (ry[k] ?? 0) + v; if (c === '(なし)') noCode++; }
}
const T = (x: number) => (x / 1e9).toFixed(2);
console.log('目の合計 vs 項の合計（兆円、千円単位の差）');
for (const y of Y) console.log(y, 'current', T(tot[y].current), (tot[y].current - s1.tot[y].current_amount / 1000), 'spent', (tot[y].spent - s1.tot[y].spent / 1000), 'carried', (tot[y].carried - s1.tot[y].carryover_out / 1000), 'unused', (tot[y].unused - s1.tot[y].unused / 1000));
console.log('コードの無い目の値', noCode);
const rows = [...by].map(([c, r]) => { const s = (k: string) => Y.reduce((a, y) => a + (r[y]?.[k] ?? 0), 0); return { c, n: codeNameOf(codes, 'major', c, 2024, 'general')?.name ?? c, cur: s('current'), spent: s('spent'), out: s('carried'), unused: s('unused'), y: Object.fromEntries(Y.map(y => [y, r[y] ?? {}])) }; });
console.log('\n主要経費別 8 年合計: 現額 支出済 繰越 不用 不用率 繰越率（不用の大きい順）');
rows.sort((a, b) => b.unused - a.unused).slice(0, 14).forEach(x => console.log(x.c, x.n, T(x.cur), T(x.spent), T(x.out), T(x.unused), (x.unused / x.cur * 100).toFixed(1) + '%', (x.out / x.cur * 100).toFixed(1) + '%'));
console.log('\n繰越率の高い順（現額 1兆円以上）');
rows.filter(x => x.cur >= 1e9).sort((a, b) => b.out / b.cur - a.out / a.cur).slice(0, 8).forEach(x => console.log(x.c, x.n, T(x.cur), T(x.out), (x.out / x.cur * 100).toFixed(1) + '%'));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t1-lifecycle/s3.json', JSON.stringify(rows));
