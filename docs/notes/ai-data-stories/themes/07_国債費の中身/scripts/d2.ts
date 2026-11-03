// 一般会計の国債費（項）の当初・補正後・決算。項の値（lifecycleValues）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const out: any = { gen: {}, fundKou: {} };
d.kous.forEach((k: any, i: number) => {
  if (!Y.includes(k.year)) return;
  const isGen = k.account === 'general' && k.name === '国債費';
  const isFund = k.account === 'special' && k.specialAccount === '国債整理基金';
  if (!isGen && !isFund) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')) as any;
  const pick = { request: v.request_amount, budget: v.budget_amount, revised: v.revised_amount, current: v.current_amount, spent: v.spent, carried: v.carryover_out, unused: v.unused };
  if (isGen) out.gen[k.year] = pick; else { const r = (out.fundKou[k.year] ??= {}); for (const [c, x] of Object.entries(pick)) if (x !== undefined) r[c] = (r[c] ?? 0) + (x as number); }
});
const t = (x: any) => x === undefined || x === null ? '   -  ' : (x / 1e12).toFixed(2).padStart(6);
console.log('一般会計 国債費（項）');
for (const c of ['request', 'budget', 'revised', 'current', 'spent', 'carried', 'unused']) console.log(c.padEnd(8), Y.map(y => t(out.gen[y]?.[c])).join(' '));
console.log('国債整理基金特会（項の合計）');
for (const c of ['budget', 'revised', 'current', 'spent', 'carried', 'unused']) console.log(c.padEnd(8), Y.map(y => t(out.fundKou[y]?.[c])).join(' '));
writeFileSync('d2.json', JSON.stringify(out));
