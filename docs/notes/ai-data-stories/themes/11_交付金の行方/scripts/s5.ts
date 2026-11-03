// FY2025・FY2026 の予算書（政府案・補正後）に、同じ項があるか
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const out: any[] = [];
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || !/地方創生推進費$/.test(k.name) || !/(新型コロナ|物価高騰)/.test(k.name)) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  out.push({ y: k.year, min: k.ministry, name: k.name, request: v.request_amount ?? null, budget: v.budget_amount ?? null, revised: v.revised_amount ?? null, seen: k.seenIn });
});
out.sort((a, b) => a.y - b.y); for (const o of out) console.log(JSON.stringify(o));
writeFileSync('s5.json', JSON.stringify(out, null, 1));
