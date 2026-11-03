import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { mokuValue, lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const m = rd('moku.json.gz'), d = rd('data.json.gz');
for (const n of m.nodes) { const id = m.kous[n[0]] as string; if (!id.includes(':general:')) continue; if (!(n[1] === 2022 || n[1] === 2023)) continue; if (!/障害児入所(給付費等|医療費等)負担金/.test(n[2])) continue;
  console.log(n[1], id.split(':')[2], n[2], 'codes', n[3], 'bud', mokuValue(n, 'budget'), 'req', mokuValue(n, 'request'), 'cur', mokuValue(n, 'current'), 'spent', mokuValue(n, 'spent'), 'flags', n[13]); }
// こども家庭庁の障害保健福祉費（FY2023、決算だけ）の内訳
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
d.kous.forEach((k: any, i: number) => { if (k.year === 2023 && k.name === '障害保健福祉費') console.log(k.id, k.org, JSON.stringify(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')))); });
// 名前が同じ目は、FY2022 の一般会計に何件あるか
const c = m.nodes.filter((n: any) => n[1] === 2022 && (m.kous[n[0]] as string).includes(':general:') && n[2] === '障害児入所給付費等負担金').length;
console.log('FY2022 一般会計の「障害児入所給付費等負担金」の目の数', c);
