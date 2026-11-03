// 検算: 大学等修学支援費の同名の項（FY2022）、FY2025 の前年度予算額の合計、こども家庭庁 FY2023 の額のある項の数
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleGroupsOf, lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const v = (i: number) => lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')) as any;
d.kous.forEach((k: any, i: number) => { if (k.year === 2022 && k.name === '大学等修学支援費') console.log('2022 同名', k.id, lifecycleGroupsOf(k)[0], v(i).budget_amount / 1e12); });
let prev = 0; d.kous.forEach((k: any, i: number) => { if (k.year === 2025 && k.specialAccount === '子ども・子育て支援' && k.subAccount === '子ども・子育て支援勘定') prev += v(i).budget_prev ?? 0; });
console.log('2025 子ども勘定 前年度予算額の計', prev, '円');
let n = 0, z = 0; d.kous.forEach((k: any, i: number) => { if (k.year === 2023 && k.account === 'general' && lifecycleGroupsOf(k)[0] === 'こども家庭庁') { const b = v(i).budget_amount; if (b > 0) n++; else z++; } });
console.log('2023 こども家庭庁 額のある項', n, '0 または無い項', z);
