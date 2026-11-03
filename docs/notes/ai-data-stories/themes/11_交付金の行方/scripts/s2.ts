// 当初（政府案）と補正後を、画面用のデータ（lifecycle/data.json.gz）から取り、決算の歳出予算額と照らす
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const s1 = JSON.parse(readFileSync('s1.json', 'utf8'));
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const out: any[] = [];
for (const k of s1.kou) {
  const hits = d.kous.map((x: any, i: number) => [x, i]).filter(([x]: any) => x.year === k.y && x.account === 'general' && x.name === k.kou && x.ministry === k.min);
  if (hits.length !== 1) { console.log('項が 1 つに決まらない', k.y, k.min, k.kou, hits.length); continue; }
  const [x, i] = hits[0];
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  const budget = v.budget_amount ?? null, revised = v.revised_amount ?? null;
  const after = revised ?? budget;
  out.push({ y: k.y, min: k.min, stream: k.stream, id: x.id, budget, revised, approp: k.approp, diff: after === null ? null : k.approp - after, groups: lifecycleGroupsOf(x) });
}
for (const o of out) console.log(o.y, o.min, o.stream, '当初', o.budget, '補正後', o.revised, '決算の歳出予算額', o.approp, '差', o.diff);
writeFileSync('s2.json', JSON.stringify(out, null, 1));
