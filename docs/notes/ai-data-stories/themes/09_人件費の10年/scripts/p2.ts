import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { codesOfMoku, mokuValue, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const P = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2d-personnel/p1.json', 'utf8'));
// 検算: CSV 直接（v1.py の出力）と一致するか
const csvGen: Record<number, number> = { 2017: 4389898290, 2018: 4425519280, 2019: 4455316798, 2020: 4450189478, 2021: 4501961672, 2022: 4500958622, 2023: 4474674349, 2024: 4565368590, 2025: 4716152923, 2026: 4884082682 };
console.log('一般 CSV との差（千円）', Object.keys(csvGen).map(y => `${y}:${Math.round(P.tot.general[y] - csvGen[+y])}`).join(' '));
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const t = (x?: number) => x === undefined ? '-' : (x / 1e9).toFixed(3);
// 防衛省の目名
const def: any = {}, carried: any = {}, dig: any = {};
for (const n of m.nodes) {
  const kouId = m.kous[n[0]] as string; if (!kouId.includes(':general:')) continue;
  if (codesOfMoku(n[3], 'general').use !== '1') continue;
  const k = kouById.get(kouId); const g = k ? lifecycleGroupsOf(k)[0] : '?';
  const b = mokuValue(n, 'budget');
  if (g === '防衛省' && b !== null) (def[n[2]] ??= {})[n[1]] = ((def[n[2]] ??= {})[n[1]] ?? 0) + b;
  if (g === 'デジタル庁' && b !== null) dig[n[1]] = (dig[n[1]] ?? 0) + b;
  const c = mokuValue(n, 'carried');
  if (c && (n[1] === 2023 || n[1] === 2024)) { const key = `${n[1]} ${g} / ${k?.name} / ${n[2]}`; carried[key] = (carried[key] ?? 0) + c; }
}
console.log('\n防衛省の人件費の目 2017→2026'); Object.entries(def).sort((a: any, b: any) => (b[1][2026] ?? 0) - (a[1][2026] ?? 0)).slice(0, 10).forEach(([k, r]: any) => console.log(k, t(r[2017]), '→', t(r[2026]), 'Δ', t((r[2026] ?? 0) - (r[2017] ?? 0))));
console.log('\nデジタル庁', Object.entries(dig).map(([y, v]: any) => `${y}:${t(v)}`).join(' '));
console.log('\n人件費の翌年度繰越 2023/2024 上位'); Object.entries(carried).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).forEach(([k, v]: any) => console.log(k, t(v)));
// 人件費の比率、府省の割合
console.log('\n一般会計に占める人件費', P.Y.map((y: number) => `${y}:${(P.tot.general[y] / P.allUse.general[y] * 100).toFixed(2)}%`).join(' '));
console.log('防衛省の比率', P.Y.map((y: number) => `${y}:${(P.byMin.general['防衛省'][y] / P.tot.general[y] * 100).toFixed(1)}%`).join(' '));
// 決算: 当初→現額（補正等）・不用率、府省別 不用（8 年計）
console.log('\n当初→現額 の差（一般）', P.S.map((y: number) => `${y}:${t(P.settle.general.current[y] - P.tot.general[y])}`).join(' '));
console.log('不用率（一般）', P.S.map((y: number) => `${y}:${(P.settle.general.unused[y] / P.settle.general.current[y] * 100).toFixed(2)}%`).join(' '));
const mins = new Set(Object.keys(P.settleMin).map(k => k.split('|')[0]));
const rows = [...mins].map(mn => { const s = (key: string) => P.S.reduce((a: number, y: number) => a + (P.settleMin[`${mn}|${key}`]?.[y] ?? 0), 0); return { mn, cur: s('current'), un: s('unused') }; }).filter(r => r.cur > 0).sort((a, b) => b.un - a.un);
console.log('\n府省別 不用（8 年計）'); rows.slice(0, 10).forEach(r => console.log(r.mn, t(r.cur), t(r.un), (r.un / r.cur * 100).toFixed(2) + '%'));
