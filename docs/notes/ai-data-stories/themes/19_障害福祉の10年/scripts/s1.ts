import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts, lifecycleGroupsOf, lifecycleChains, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const vals = (i: number) => lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
// 名前に「障害」を含む項（一般会計）
const t = (x?: number) => x === undefined ? '-' : (x / 1e12).toFixed(3);
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || !/障害|障がい/.test(k.name)) return;
  const v = vals(i), a = lifecycleRowAmounts(v);
  console.log(k.year, lifecycleGroupsOf(k).join('・'), k.org, k.name, 'req', t(a.request), 'bud', t(a.budget), 'rev', t(a.revised), 'cur', t(v.current_amount), 'spent', t(a.spent));
});
