// 別の方法の検算: 画面用の lifecycle/data.json.gz（パイプラインの出力）から、財投特会の当初・補正後・決算を足し、a2.json と比べる
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const A = JSON.parse(readFileSync(new URL('./a2.json', import.meta.url)).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const tot: Record<string, Record<string, number>> = {};
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'special' || k.specialAccount !== '財政投融資' || k.year > 2026) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  const a = lifecycleRowAmounts(v);
  const t = (tot[k.year] ??= { budget: 0, revised: 0, spent: 0, cur: 0, cout: 0, unused: 0 });
  t.budget += a.budget ?? 0; t.revised += a.revised ?? a.budget ?? 0; t.spent += a.spent ?? 0;
  t.cur += v.current_amount ?? 0; t.cout += v.carryover_out ?? 0; t.unused += v.unused ?? 0;
});
let bad = 0;
for (const y of Object.keys(tot)) {
  const sum = (k: string) => Object.values(A.acct).reduce((s: number, e: any) => s + (e[y]?.[k] ?? 0), 0);
  const t = tot[y]!;
  const rows: [string, number, number][] = [['budget', t.budget, sum('budget')], ['spent', t.spent, sum('spent')], ['cur', t.cur, sum('cur')], ['cout', t.cout, sum('cout')], ['unused', t.unused, sum('unused')]];
  if (+y <= 2025) rows.push(['revised', t.revised, sum('revised')]);
  for (const [k, a, b] of rows) if (Math.abs(a - b) > 1) { bad++; console.log('差', y, k, a, b); }
  console.log(y, rows.map(([k, a]) => `${k}=${(a / 1e12).toFixed(3)}`).join(' '));
}
console.log('不一致', bad);
