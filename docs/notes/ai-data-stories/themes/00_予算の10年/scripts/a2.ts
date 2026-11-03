import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { codesOfMoku, codeNameOf, mokuValue, lifecycleValues, lifecycleRowAmounts, lifecycleChains, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz'), codes = rd('codes.json.gz');
const t = (x: number) => (x / 1e9).toFixed(2);
// 物件費（使途 3）の内訳: 主要経費別 × 2017/2026
const acctOf = (n: any) => (m.kous[n[0]] as string).split(':')[1] as 'general' | 'special';
const r: Record<string, Record<number, number>> = {};
for (const n of m.nodes) { if (acctOf(n) !== 'general' || (n[1] !== 2017 && n[1] !== 2026 && n[1] !== 2022)) continue; const v = mokuValue(n, 'budget'); if (v === null) continue; const c = codesOfMoku(n[3], 'general'); if (c.use !== '3') continue; (r[c.major] ??= {})[n[1]] = (r[c.major]![n[1]] ?? 0) + v; }
console.log('物件費の主要経費別（兆円）2017/2022/2026');
for (const [c, x] of Object.entries(r).sort((a, b) => (b[1][2026] ?? 0) - (b[1][2017] ?? 0) - ((a[1][2026] ?? 0) - (a[1][2017] ?? 0))).slice(0, 6)) console.log(c, codeNameOf(codes, 'major', c, 2026, 'general')?.name, t(x[2017] ?? 0), t(x[2022] ?? 0), t(x[2026] ?? 0));
// 項: 一般会計、2017 と 2026 が確定した対応でつながる項の増減
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const bud = (i: number) => lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))).budget;
const chainOf = lifecycleChains(d.kous, d.links, d.years);
const rows: any[] = []; let linked = 0, total26 = 0;
d.kous.forEach((k: any, i: number) => {
  if (k.year !== 2026 || k.account !== 'general') return; total26++;
  const mem = chainOf(i).members; const j = mem.find((x: number) => d.kous[x].year === 2017);
  if (j === undefined) { rows.push({ k, from: null, to: bud(i) ?? 0, d: bud(i) ?? 0, new: true, first: d.kous[mem[0]].year }); return; }
  linked++; const a = bud(j) ?? 0, b = bud(i) ?? 0; rows.push({ k, k17: d.kous[j], from: a, to: b, d: b - a });
});
console.log('\nFY2026 一般会計の項', total26, 'うち FY2017 まで確定した対応でたどれる', linked);
const show = (x: any) => `${lifecycleGroupsOf(x.k).join('・')} ${x.k.name}${x.k17 && x.k17.name !== x.k.name ? `（2017: ${x.k17.name}）` : ''} ${x.from === null ? `新（${x.first}〜）` : t(x.from / 1000)} → ${t(x.to / 1000)} Δ${t(x.d / 1000)}`;
console.log('\n増えた（つながる項）'); rows.filter(x => !x.new).sort((a, b) => b.d - a.d).slice(0, 12).forEach(x => console.log(show(x)));
console.log('\n減った（つながる項）'); rows.filter(x => !x.new).sort((a, b) => a.d - b.d).slice(0, 10).forEach(x => console.log(show(x)));
console.log('\n2017 につながらない FY2026 の項（大きい順）'); rows.filter(x => x.new).sort((a, b) => b.to - a.to).slice(0, 10).forEach(x => console.log(show(x)));
// 2017 にあって 2026 につながらない項
const gone: any[] = []; d.kous.forEach((k: any, i: number) => { if (k.year !== 2017 || k.account !== 'general') return; const mem = chainOf(i).members; if (!mem.some((x: number) => d.kous[x].year === 2026)) gone.push({ k, b: bud(i) ?? 0, last: d.kous[mem[mem.length - 1]].year }); });
console.log('\nFY2017 の項で FY2026 につながらない', gone.length, '計', t(gone.reduce((s, x) => s + x.b, 0) / 1000));
gone.sort((a, b) => b.b - a.b).slice(0, 8).forEach(x => console.log(lifecycleGroupsOf(x.k).join('・'), x.k.name, t(x.b / 1000), '最後', x.last));
