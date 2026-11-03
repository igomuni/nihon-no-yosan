import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const bud = (i: number) => lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))).budget ?? 0;
// 2023 のこども家庭庁の項に入る 2022 の項（リンクの状態ごと）
const into = new Map<string, number>(); let toCfa = 0, cfaKous = 0, linkedKous = 0;
const cfa = new Set(d.kous.map((k: any, i: number) => [k, i]).filter(([k]: any) => k.year === 2023 && k.account === 'general' && lifecycleGroupsOf(k)[0] === 'こども家庭庁').map(([, i]: any) => i));
for (const i of cfa) { toCfa += bud(i as number); cfaKous++; }
const seen = new Set<number>();
for (const l of d.links) { if (!cfa.has(l.to) || l.from < 0) continue; const k = d.kous[l.from]; const key = `${lifecycleGroupsOf(k)[0]} [${l.status}]`; if (seen.has(l.from)) continue; seen.add(l.from); linkedKous++; into.set(key, (into.get(key) ?? 0) + bud(l.from)); }
console.log('2023 こども家庭庁の項', cfaKous, '政府案計', (toCfa / 1e12).toFixed(2), '兆');
console.log('2022 の側（つながる候補の項の 2022 政府案）', [...into].map(([k, v]) => `${k}: ${(v / 1e12).toFixed(2)}兆`).join(' / '), '項数', linkedKous);
const k22 = d.kous.map((k: any, i: number) => [k, i]).filter(([k]: any) => k.year === 2022 && k.account === 'general');
let matched = 0; const from = new Map<string, number>();
for (const i of cfa) { const k = d.kous[i as number]; const hits = k22.filter(([x]: any) => x.name === k.name); const tag = hits.length === 1 ? lifecycleGroupsOf(hits[0][0])[0] : hits.length === 0 ? '(同名なし)' : '(同名が複数)'; from.set(tag, (from.get(tag) ?? 0) + bud(i as number)); if (hits.length === 1) matched++; console.log(`  ${k.name} ${(bud(i as number) / 1e12).toFixed(2)} ← ${tag}`); }
console.log('同名で 1 つに決まる', matched, [...from].map(([k, v]) => `${k}: ${(v / 1e12).toFixed(2)}兆`).join(' / '));
