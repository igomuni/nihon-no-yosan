// 項（確定した対応でたどった流れ）ごとの、繰越・不用（一般会計 FY2017〜FY2024。円）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleGroupsOf, lifecycleChains } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const chainOf = lifecycleChains(d.kous, d.links, d.years);
const V = new Map<number, any>();
d.kous.forEach((k: any, i: number) => { if (k.account === 'general' && Y.includes(k.year)) V.set(i, lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))); });
// 流れごとにまとめる（流れの代表 = 流れの最初の項の添字）
type Row = { key: string; name: string; group: string; years: Record<number, { i: number; cur: number; spent: number; cout: number; un: number; cin: number; budget?: number }> };
const flows = new Map<string, Row>(); const assigned = new Set<number>(); let multiChain = 0;
let settleKous = 0, sumCur = 0, sumOut = 0, sumUn = 0;
for (const [i, v] of V) {
  if (v.current_amount === undefined) continue;
  settleKous++;
  const k = d.kous[i]; const key = chainOf(i).members.join(',');
  let r = flows.get(key);
  if (r && r.years[k.year]) { multiChain++; r = undefined; }
  r = r ?? flows.get(key + '#' + i) ?? undefined;
  const kk = r ? r.key : (flows.has(key) ? key + '#' + i : key);
  r = r ?? flows.get(kk) ?? flows.set(kk, { key: kk, name: k.name, group: lifecycleGroupsOf(k).join('・'), years: {} }).get(key)!;
  r.years[k.year] = { i, cur: v.current_amount, spent: v.spent ?? 0, cout: v.carryover_out ?? 0, un: v.unused ?? 0, cin: v.carryover_in ?? 0, budget: v.budget_amount };
  if (k.year >= (Math.max(...Object.keys(r.years).map(Number)))) { r.name = k.name; r.group = lifecycleGroupsOf(k).join('・'); }
  sumCur += v.current_amount; sumOut += v.carryover_out ?? 0; sumUn += v.unused ?? 0;
}
console.log('同じ流れに同じ年度が重なり、別の流れにした項', multiChain);
console.log('決算のある項', settleKous, '流れ', flows.size, '現額', (sumCur / 1e12).toFixed(2), '繰越', (sumOut / 1e12).toFixed(2), '不用', (sumUn / 1e12).toFixed(2));
const rows = [...flows.values()].map(r => {
  const ys = Object.keys(r.years).map(Number);
  const s = (f: 'cur' | 'cout' | 'un' | 'spent' | 'cin') => ys.reduce((a, y) => a + r.years[y]![f], 0);
  const coutYears = ys.filter(y => r.years[y]!.cout > 0).length;
  const maxOut = Math.max(0, ...ys.map(y => r.years[y]!.cout)); const maxOutY = ys.find(y => r.years[y]!.cout === maxOut);
  const maxUn = Math.max(0, ...ys.map(y => r.years[y]!.un)); const maxUnY = ys.find(y => r.years[y]!.un === maxUn);
  return { ...r, nYears: ys.length, cur: s('cur'), cout: s('cout'), un: s('un'), spent: s('spent'), cin: s('cin'), coutYears, maxOut, maxOutY, maxUn, maxUnY };
});
// 区分: 続く（繰越が 6 年以上、かつ最大の年度が 8 年計の 50% 未満）／偏る（最大の年度が 50% 以上）
const kind = (n: number, max: number, tot: number, yrs: number) => (tot <= 0 ? 'none' : max / tot >= 0.5 ? 'spike' : yrs >= 6 ? 'steady' : 'mixed');
for (const r of rows as any[]) { r.outKind = kind(r.cout, r.maxOut, r.cout, r.coutYears); r.unKind = r.un <= 0 ? 'none' : r.maxUn / r.un >= 0.5 ? 'spike' : 'steady'; }
const T = (x: number) => (x / 1e12).toFixed(3);
const top = (f: 'cout' | 'un', n: number) => [...rows].sort((a, b) => b[f] - a[f]).slice(0, n);
console.log('\n繰越 8 年計の上位');
for (const r of top('cout', 20) as any[]) console.log(r.group, r.name, '繰越', T(r.cout), '現額', T(r.cur), '率', (r.cout / r.cur * 100).toFixed(1), r.outKind, '最大', r.maxOutY, T(r.maxOut), '年数', r.coutYears + '/' + r.nYears);
console.log('\n不用 8 年計の上位');
for (const r of top('un', 20) as any[]) console.log(r.group, r.name, '不用', T(r.un), '現額', T(r.cur), '率', (r.un / r.cur * 100).toFixed(1), r.unKind, '最大', r.maxUnY, T(r.maxUn));
// 上位の集中度
const sorted = [...rows].sort((a, b) => b.cout - a.cout); let acc = 0; const k80 = sorted.findIndex(r => (acc += r.cout) >= sumOut * 0.8) + 1;
const sortedU = [...rows].sort((a, b) => b.un - a.un); acc = 0; const k80u = sortedU.findIndex(r => (acc += r.un) >= sumUn * 0.8) + 1;
console.log('\n繰越の 80% を占める流れの数', k80, '/ 繰越のある流れ', rows.filter(r => r.cout > 0).length, '不用 80%', k80u, '/', rows.filter(r => r.un > 0).length);
// 区分ごとの額
for (const f of ['cout', 'un'] as const) { const m: Record<string, number> = {}; for (const r of rows as any[]) { const kk = f === 'cout' ? r.outKind : r.unKind; m[kk] = (m[kk] ?? 0) + r[f]; } console.log(f, Object.entries(m).map(([k, v]) => `${k}:${T(v)}`).join(' ')); }
// 年度ごと: 繰越のうち、偏る流れの分
writeFileSync('c1.json', JSON.stringify({ rows, sumCur, sumOut, sumUn }));
