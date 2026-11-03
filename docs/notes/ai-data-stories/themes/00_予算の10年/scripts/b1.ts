import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const g = new Map<string, Record<number, number>>(), raw = new Map<string, Record<number, number>>(), multi: string[] = [];
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || !Y.includes(k.year)) return;
  const b = lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))).budget; if (b === undefined) return;
  const gs = lifecycleGroupsOf(k); if (gs.length > 1) multi.push(k.id);
  const r = g.get(gs[0]!) ?? g.set(gs[0]!, {}).get(gs[0]!)!; r[k.year] = (r[k.year] ?? 0) + b / 1000;
  const q = raw.get(k.ministry) ?? raw.set(k.ministry, {}).get(k.ministry)!; q[k.year] = (q[k.year] ?? 0) + b / 1000;
});
console.log('複数所管の一般会計の項', multi.length);
const t = (x?: number) => x === undefined ? '  -  ' : (x / 1e9).toFixed(2);
for (const [lab, m] of [['府省（外局を分ける）', g], ['所管の原文', raw]] as const) {
  console.log('\n==', lab);
  [...m].sort((a, b) => ((b[1][2026] ?? 0) - (b[1][2017] ?? 0)) - ((a[1][2026] ?? 0) - (a[1][2017] ?? 0))).forEach(([n, r]) => console.log(n.padEnd(10), t(r[2017]), '→', t(r[2026]), 'Δ', t((r[2026] ?? 0) - (r[2017] ?? 0)), '|', Y.map(y => t(r[y])).join(' ')));
}
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/b1.json', JSON.stringify({ g: [...g], raw: [...raw] }));
