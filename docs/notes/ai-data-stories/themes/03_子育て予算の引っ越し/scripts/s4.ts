// 流れ: 一般会計の繰入、特別会計（年金特会 子ども・子育て支援勘定 → 子ども・子育て支援特会）、こども家庭庁、少子化対策費、出どころの項の前後
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleGroupsOf, lifecycleValues, lifecycleRowAmounts, codesOfMoku, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const vals = (i: number) => lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
const bud = (i: number) => lifecycleRowAmounts(vals(i)).budget; // 円
const t = (x?: number | null) => x === undefined || x === null ? '-' : (x / 1e12).toFixed(3);
const out: any = {};
// 1) 一般会計 → 子ども・子育て支援の特別会計への繰入の項
console.log('== 一般会計の繰入の項');
const tr: Record<string, Record<number, number>> = {};
d.kous.forEach((k: any, i: number) => { if (k.account !== 'general' || !Y.includes(k.year) || !/子ども・子育て支援.*繰入/.test(k.name)) return; const key = `${lifecycleGroupsOf(k)[0]}|${k.name}`; (tr[key] ??= {})[k.year] = bud(i) ?? NaN; });
for (const [k, r] of Object.entries(tr)) console.log(k, Y.map(y => `${y}:${t(r[y])}`).join(' '));
out.transfers = tr;
// 2) 特別会計
console.log('\n== 特別会計（勘定ごとの政府案の項の計）');
const sp: Record<string, Record<number, number>> = {};
d.kous.forEach((k: any, i: number) => { if (k.account !== 'special' || !Y.includes(k.year)) return; if (!(k.specialAccount === '子ども・子育て支援' || (k.specialAccount === '年金' && k.subAccount === '子ども・子育て支援勘定'))) return; const key = `${k.specialAccount}特別会計|${k.subAccount}`; const b = bud(i); if (b === undefined) return; (sp[key] ??= {})[k.year] = (sp[key][k.year] ?? 0) + b; });
for (const [k, r] of Object.entries(sp)) console.log(k, Y.map(y => `${y}:${t(r[y])}`).join(' '));
out.special = sp;
// 特会の項（2024 年金/子ども勘定 と 2025 子ども特会/子ども勘定）
for (const [y, acc, sub] of [[2024, '年金', '子ども・子育て支援勘定'], [2025, '子ども・子育て支援', '子ども・子育て支援勘定'], [2026, '子ども・子育て支援', '子ども・子育て支援勘定'], [2025, '子ども・子育て支援', '育児休業等給付勘定']] as const) {
  console.log(`  -- FY${y} ${acc}特会 ${sub}`);
  d.kous.forEach((k: any, i: number) => { if (k.year === y && k.specialAccount === acc && k.subAccount === sub) console.log('    ', k.name, t(bud(i))); });
}
// 3) こども家庭庁 一般会計の計、少子化対策費（主要経費 05）
const cfa: Record<number, number> = {};
d.kous.forEach((k: any, i: number) => { if (k.account === 'general' && Y.includes(k.year) && lifecycleGroupsOf(k)[0] === 'こども家庭庁') cfa[k.year] = (cfa[k.year] ?? 0) + (bud(i) ?? 0); });
const c05: Record<number, number> = {}, c05cfa: Record<number, number> = {};
for (const n of m.nodes) { if (!Y.includes(n[1])) continue; const id = m.kous[n[0]] as string; if (!id.includes(':general:')) continue; const v = mokuValue(n, 'budget'); if (v === null) continue; if (codesOfMoku(n[3], 'general').major !== '05') continue; c05[n[1]] = (c05[n[1]] ?? 0) + v * 1000; }
console.log('\nこども家庭庁', Y.map(y => `${y}:${t(cfa[y])}`).join(' '));
console.log('少子化対策費(05)', Y.map(y => `${y}:${t(c05[y])}`).join(' '));
out.cfa = cfa; out.c05 = c05;
// こども家庭庁の主要経費別内訳 FY2023/FY2026
const mix: Record<number, Record<string, number>> = {};
for (const n of m.nodes) { if (n[1] !== 2023 && n[1] !== 2026) continue; const id = m.kous[n[0]] as string; const k = d.kous.find((x: any) => x.id === id); if (!k || k.account !== 'general' || lifecycleGroupsOf(k)[0] !== 'こども家庭庁') continue; const v = mokuValue(n, 'budget'); if (v === null) continue; const c = codesOfMoku(n[3], 'general').major || '(なし)'; (mix[n[1]] ??= {})[c] = (mix[n[1]][c] ?? 0) + v * 1000; }
console.log('こども家庭庁の主要経費別', JSON.stringify(Object.fromEntries(Object.entries(mix).map(([y, r]) => [y, Object.fromEntries(Object.entries(r).map(([c, v]) => [c, +(v / 1e12).toFixed(3)]))]))));
out.mix = mix;
// 4) 出どころの項の、FY2022 → FY2023（同じ府省の同じ名前の項）
console.log('\n== 出どころの項の FY2021〜FY2024');
for (const [g, name] of [['厚生労働省', '障害保健福祉費'], ['内閣府', '大学等修学支援費'], ['内閣府', '子ども・子育て支援年金特別会計へ繰入'], ['厚生労働省', '母子家庭等対策費'], ['厚生労働省', '児童虐待等防止対策費'], ['厚生労働省', '保育対策費'], ['文部科学省', '大学等修学支援費']]) {
  const r: Record<number, number | undefined> = {}; d.kous.forEach((k: any, i: number) => { if (k.account === 'general' && k.name === name && lifecycleGroupsOf(k)[0] === g && k.year >= 2021 && k.year <= 2024) r[k.year] = bud(i); });
  console.log(g, name, [2021, 2022, 2023, 2024].map(y => `${y}:${t(r[y])}`).join(' '));
}
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t3-kodomo/s4.json', JSON.stringify(out));
