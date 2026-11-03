// 育児休業給付の移動（労働保険特会 雇用勘定 → 子ども・子育て支援特会 育児休業等給付勘定）の額
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const v = (i: number) => lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')) as any;
d.kous.forEach((k: any, i: number) => { if (/^育児休業給付(費|資金へ繰入)$/.test(k.name) && k.year >= 2022 && k.year <= 2026) { const x = v(i); console.log(k.year, k.specialAccount, k.subAccount, k.name, '政府案', (lifecycleRowAmounts(x).budget ?? NaN) / 1e12, '補正後', (x.revised_amount ?? NaN) / 1e12); } });
