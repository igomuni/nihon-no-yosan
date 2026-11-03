// 一般会計の「産業投資支出財政投融資特別会計へ繰入」と、財投特会から一般会計への繰入（項名に「一般会計へ繰入」）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const out: any = { toFilp: {}, toGeneral: {} };
d.kous.forEach((k: any, i: number) => {
  if (k.year > 2026) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  const a = lifecycleRowAmounts(v);
  const row = { budget: a.budget ?? null, revised: a.revised ?? null, spent: a.spent ?? null };
  if (k.account === 'general' && k.name.includes('財政投融資特別会計へ繰入')) out.toFilp[k.year] = row;
  if (k.account === 'special' && k.specialAccount === '財政投融資' && k.name.includes('一般会計へ繰入')) (out.toGeneral[k.year] ??= []).push({ sub: k.subAccount, name: k.name, ...row });
});
writeFileSync(new URL('./a3.json', import.meta.url), JSON.stringify(out));
for (const [y, r] of Object.entries(out.toFilp) as any) console.log('一般→財投', y, r.budget / 1e8, r.revised === null ? '-' : r.revised / 1e8, r.spent === null ? '-' : r.spent / 1e8, '億円');
for (const [y, l] of Object.entries(out.toGeneral) as any) for (const r of l) console.log('財投→一般', y, r.sub, r.name, (r.budget ?? 0) / 1e8, r.spent === null ? '-' : r.spent / 1e8, '億円');
