// 防衛省所管の項を、グループに分けて年度ごとに足す（当初・決算）。2024 の決算を項ごとに
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const d = JSON.parse(gunzipSync(readFileSync(L + 'data.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const group = (name: string): string => {
  if (/^(平成|令和)(元|\d+)年度.*(建造費)$/.test(name) || name === '艦船建造費') return '艦船・潜水艦の建造';
  if (['武器車両等整備費', '航空機整備費', '艦船整備費'].includes(name)) return '装備品の整備（購入・修理）';
  if (['防衛力基盤整備費', '防衛力基盤強化推進費'].includes(name)) return '防衛力基盤整備費・強化推進費';
  if (/施設整備費|施設費/.test(name)) return '施設整備';
  if (['自衛官給与費'].includes(name)) return '自衛官給与費';
  return 'その他（本省・機関の共通費など）';
};
const G: Record<string, Record<number, any>> = {}; const names: Record<string, Set<string>> = {};
const s24: any[] = [];
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || k.ministry !== '防衛省' || !Y.includes(k.year)) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  const g = group(k.name); (names[g] ??= new Set()).add(k.name);
  const r = ((G[g] ??= {})[k.year] ??= {});
  for (const key of ['budget_amount', 'revised_amount', 'current_amount', 'spent', 'carryover_out', 'unused']) if ((v as any)[key] !== undefined) r[key] = (r[key] ?? 0) + (v as any)[key];
  if (k.year === 2024 && v.current_amount !== undefined) s24.push({ name: k.name, org: k.org, cur: v.current_amount, spent: v.spent, carried: v.carryover_out, unused: v.unused });
});
const t = (x?: number) => (x === undefined ? '   -  ' : (x / 1e12).toFixed(3));
for (const [g, r] of Object.entries(G)) { console.log(g.padEnd(24), Y.map(y => t(r[y]?.budget_amount)).join(' '), '| 決算2024 現額', t(r[2024]?.current_amount), '支出', t(r[2024]?.spent), '繰越', t(r[2024]?.carryover_out), '不用', t(r[2024]?.unused)); console.log('   ', [...names[g]!].slice(0, 12).join('、'), names[g]!.size > 12 ? `ほか ${names[g]!.size - 12}` : ''); }
console.log('\n2024 決算 翌年度繰越の大きい項');
s24.sort((a, b) => b.carried - a.carried).slice(0, 8).forEach(x => console.log(x.name, x.org, '現額', t(x.cur), '支出', t(x.spent), '繰越', t(x.carried), `(${(x.carried / x.cur * 100).toFixed(1)}%)`, '不用', t(x.unused)));
// 年度ごとの執行率（支出済/現額）
const all: Record<number, any> = {};
for (const r of Object.values(G)) for (const y of Y) for (const [k, v] of Object.entries(r[y] ?? {})) (all[y] ??= {})[k] = ((all[y] ??= {})[k] ?? 0) + (v as number);
console.log('\n防衛省 支出済/現額, 繰越/現額, 不用/現額');
for (const y of Y.slice(0, 8)) { const a = all[y]; console.log(y, (a.spent / a.current_amount * 100).toFixed(1), (a.carryover_out / a.current_amount * 100).toFixed(1), (a.unused / a.current_amount * 100).toFixed(1)); }
writeFileSync(process.argv[2] ?? '/dev/null', JSON.stringify({ G, names: Object.fromEntries(Object.entries(names).map(([k, s]) => [k, [...s]])), s24, all }));
