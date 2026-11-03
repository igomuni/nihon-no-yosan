import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
const EDU = ['11', '14', '15', '16'];
const t = (x: number) => +(x / 1e9).toFixed(3); // 千円 → 兆円
type Agg = Record<string, Record<number, Record<string, number>>>;
const agg: Agg = {}; // code -> year -> measure -> sum
const add = (c: string, y: number, k: string, v: number | null) => { if (v === null || v === undefined) return; ((agg[c] ??= {})[y] ??= {})[k] = (agg[c][y][k] ?? 0) + v; };
const kouName = (i: number) => (m.kous[i] as string);
const rows26: any[] = []; const giga: any[] = []; const shushoku: any[] = [];
for (const n of m.nodes) {
  const id = kouName(n[0]); if (!id.includes(':general:')) continue;
  const c = codesOfMoku(n[3], 'general').major; const y = n[1];
  const kou = id.split('|').pop()!; const min = id.split(':')[2].split('|')[0];
  if (/修学支援/.test(kou)) shushoku.push({ y, min, kou, moku: n[2], c, b: n[5], req: n[12] });
  if (/GIGA|学校情報通信|1人1台|情報端末/.test(n[2] + kou)) giga.push({ y, min, kou, moku: n[2], c, b: n[5], supp: n[7], req: n[12] });
  if (!EDU.includes(c)) continue;
  for (const [k, col] of [['budget', 5], ['revised', 6], ['suppNet', 7], ['current', 8], ['spent', 9], ['carried', 10], ['unused', 11], ['request', 12]] as const) add(c, y, k, n[col]);
  add('edu', y, 'budget', n[5]); add('edu', y, 'suppNet', n[7]); add('edu', y, 'request', n[12]);
  for (const k of ['current', 'spent', 'carried', 'unused'] as const) add('edu', y, k, n[({ current: 8, spent: 9, carried: 10, unused: 11 } as any)[k]]);
  if (y === 2025 || y === 2026) rows26.push({ y, c, min, kou, moku: n[2], b: n[5] ?? 0 });
}
console.log('== 教育 4 区分（兆円）');
for (const c of [...EDU, 'edu']) console.log(c, Y.map(y => `${y}:${agg[c]?.[y]?.budget !== undefined ? t(agg[c][y].budget) : '-'}`).join(' '));
console.log('補正(差引)', Y.map(y => `${y}:${agg.edu?.[y]?.suppNet !== undefined ? t(agg.edu[y].suppNet) : '-'}`).join(' '));
console.log('要求', Y.map(y => `${y}:${agg.edu?.[y]?.request !== undefined ? t(agg.edu[y].request) : '-'}`).join(' '));
console.log('決算 現額/支出/繰越/不用', [2017, 2020, 2024].map(y => `${y}:${['current', 'spent', 'carried', 'unused'].map(k => t(agg.edu[y][k] ?? 0)).join('/')}`).join(' '));
// FY2026-FY2025 by 項|目
const key = (r: any) => `${r.c}|${r.min}|${r.kou}|${r.moku}`; const mp = new Map<string, { a: number; b: number; r: any }>();
for (const r of rows26) { const o = mp.get(key(r)) ?? mp.set(key(r), { a: 0, b: 0, r }).get(key(r))!; if (r.y === 2025) o.a += r.b; else o.b += r.b; }
const ds = [...mp.values()].map(o => ({ ...o.r, a: o.a, b: o.b, d: o.b - o.a })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
console.log('\n== FY2026−FY2025 目（上位）'); ds.slice(0, 15).forEach(x => console.log(x.c, x.min, x.kou, '/', x.moku, t(x.a), '→', t(x.b), 'Δ', t(x.d)));
console.log('\n== 修学支援'); shushoku.filter(s => s.b).forEach(s => console.log(s.y, s.min, s.kou, s.moku, s.c, t(s.b)));
console.log('\n== GIGA 等'); giga.forEach(s => console.log(s.y, s.min, s.kou, s.moku, s.c, s.b === null ? '-' : t(s.b), 'supp', s.supp === null ? '-' : t(s.supp)));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r5e-education/e1.json', JSON.stringify({ agg, ds: ds.slice(0, 40), shushoku, giga }));
