import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
d.kous.forEach((k: any, i: number) => { if (k.account === 'general' && ['障害保健福祉費', '障害児支援等対策費'].includes(k.name) && k.year >= 2022) { const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')); console.log(k.year, k.org, k.name, 'budget_prev', v.budget_prev, 'request_prev', v.request_prev, 'request', v.request_amount); } });
// 年度をまたぐ対応（確定）
const idx = new Map(d.kous.map((k: any, i: number) => [i, k]));
for (const l of d.links) { const a = idx.get(l.from) as any, b = idx.get(l.to) as any; if (!a || !b) continue; if ([a.name, b.name].some(n => ['障害保健福祉費', '障害児支援等対策費'].includes(n)) && a.account === 'general' && b.year >= 2022 && b.year <= 2024) console.log('link', a.year, a.org, a.name, '→', b.year, b.org, b.name, l.status, (l.evidence || []).join(',')); }
