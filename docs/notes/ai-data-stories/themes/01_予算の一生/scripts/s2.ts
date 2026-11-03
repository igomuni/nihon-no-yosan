// 予備費の使用（プラス = 使った側、マイナス = 予備費の項）と、府省別の繰越・不用
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const T = (x: number) => (x / 1e12).toFixed(2);
const out: any = { reserve: {}, reserveKou: {}, reserveTo: {}, min: {} };
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || !Y.includes(k.year)) return;
  const v: any = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  if (v.reserve_use === undefined) return;
  const r = (out.reserve[k.year] ??= { plus: 0, minus: 0 });
  if (v.reserve_use > 0) { r.plus += v.reserve_use; const g = lifecycleGroupsOf(k)[0]; const to = (out.reserveTo[k.year] ??= {}); to[g] = (to[g] ?? 0) + v.reserve_use; }
  if (v.reserve_use < 0) { r.minus += v.reserve_use; (out.reserveKou[k.year] ??= []).push([k.name, v.appropriation, v.reserve_use, v.current_amount, v.unused]); }
  const g = lifecycleGroupsOf(k)[0]; const mm = ((out.min[k.year] ??= {})[g] ??= { cur: 0, spent: 0, out: 0, unused: 0, budget: 0 });
  mm.cur += v.current_amount; mm.spent += v.spent; mm.out += v.carryover_out; mm.unused += v.unused; mm.budget += v.budget_amount ?? 0;
});
for (const y of Y) {
  const r = out.reserve[y]; console.log(y, '予備費使用 プラス', T(r.plus), 'マイナス', T(r.minus));
  for (const x of out.reserveKou[y] ?? []) console.log('   予備費の項', x[0], '歳出予算額', T(x[1]), '使用', T(x[2]), '現額', T(x[3]), '不用', T(x[4]));
  console.log('   使った府省 上位', Object.entries(out.reserveTo[y] ?? {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([g, v]: any) => `${g} ${T(v)}`).join(' / '));
}
// 8 年合計の府省別
const agg: Record<string, any> = {};
for (const y of Y) for (const [g, m] of Object.entries(out.min[y]) as any) { const a = (agg[g] ??= { cur: 0, spent: 0, out: 0, unused: 0 }); for (const k of ['cur', 'spent', 'out', 'unused']) a[k] += m[k]; }
console.log('\n府省別 8 年合計（現額・支出済・繰越・不用・不用率）');
Object.entries(agg).sort((a: any, b: any) => b[1].unused - a[1].unused).slice(0, 12).forEach(([g, a]: any) => console.log(g, T(a.cur), T(a.spent), T(a.out), T(a.unused), (a.unused / a.cur * 100).toFixed(1) + '%', '繰越率', (a.out / a.cur * 100).toFixed(1) + '%'));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t1-lifecycle/s2.json', JSON.stringify(out));
