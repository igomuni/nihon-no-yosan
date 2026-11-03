import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
for (const y of [2023, 2026]) { let r = 0, b = 0; d.kous.forEach((k: any, i: number) => { if (k.year !== y || k.account !== 'general') return; const a = lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))); if (a.request !== undefined && a.budget !== undefined) { r += a.request; b += a.budget; } }); console.log(y, (r / 1e12).toFixed(2), (b / 1e12).toFixed(2), ((b - r) / 1e12).toFixed(2), (b / r * 100).toFixed(1)); }
