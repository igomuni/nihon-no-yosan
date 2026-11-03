import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const m = rd('moku.json.gz'), j = rd('jikou.json.gz');
const KOU = /\|(障害保健福祉費|障害児支援等対策費)$/;
const by = new Map<string, Record<number, number>>();
for (const n of m.nodes) { const id = m.kous[n[0]] as string; if (!id.includes(':general:') || !KOU.test(id)) continue; const v = mokuValue(n, 'budget'); if (v === null) continue; const key = `${id.split('|').pop()} / ${n[2]}`; (by.get(key) ?? by.set(key, {}).get(key)!)[n[1]] = (by.get(key)![n[1]] ?? 0) + v; }
const t = (x?: number) => x === undefined ? '  -  ' : (x / 1e9).toFixed(3);
[...by].sort((a, b) => Math.max(...Object.values(b[1])) - Math.max(...Object.values(a[1]))).slice(0, 30).forEach(([k, r]) => console.log(k.padEnd(50), [2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map(y => t(r[y])).join(' ')));
console.log('jikou fields sample', JSON.stringify(j.nodes[0]), j.kous[j.nodes[0][0]]);
const jb = new Map<string, Record<number, number>>();
j.nodes.forEach((n: any) => { const id = j.kous[n[0]] as string; if (!id.includes(':general:') || !KOU.test(id)) return; const key = `${id.split('|').pop()} / ${n[2]}`; if (n[3] === null) return; (jb.get(key) ?? jb.set(key, {}).get(key)!)[n[1]] = n[3]; });
console.log('--- 事項');
[...jb].forEach(([k, r]) => console.log(k.padEnd(60), [2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map(y => t(r[y])).join(' ')));
