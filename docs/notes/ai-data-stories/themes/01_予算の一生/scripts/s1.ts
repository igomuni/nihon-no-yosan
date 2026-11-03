// 一般会計の年度ごとの「一生」: 当初 → 補正後 → 現額の内訳 → 支出済・繰越・不用（項の値。円）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const M = ['budget_amount', 'revised_amount', 'appropriation', 'carryover_in', 'reserve_use', 'fungible', 'transfer', 'current_amount', 'spent', 'carryover_out', 'unused'] as const;
const tot: Record<number, Record<string, number>> = {}; const cnt: Record<number, Record<string, number>> = {};
const byMin: Record<number, Map<string, Record<string, number>>> = {};
let idA = 0, idB = 0, nSettle = 0, badA: string[] = [], badB: string[] = [];
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || !Y.includes(k.year)) return;
  const v: any = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  const t = (tot[k.year] ??= {}), c = (cnt[k.year] ??= {});
  for (const m of M) if (v[m] !== undefined) { t[m] = (t[m] ?? 0) + v[m]; c[m] = (c[m] ?? 0) + 1; }
  if (v.current_amount !== undefined) {
    nSettle++;
    const a = v.appropriation + v.carryover_in + v.reserve_use + v.fungible + v.transfer - v.current_amount;
    const b = v.spent + v.carryover_out + v.unused - v.current_amount;
    if (a === 0) idA++; else badA.push(`${k.id} ${a}`);
    if (b === 0) idB++; else badB.push(`${k.id} ${b}`);
    const g = lifecycleGroupsOf(k)[0]!; const mm = (byMin[k.year] ??= new Map()); const r = mm.get(g) ?? mm.set(g, {}).get(g)!;
    for (const m of M) if (v[m] !== undefined) r[m] = (r[m] ?? 0) + v[m];
  }
});
console.log('決算のある項', nSettle, '現額 = 歳出予算額+前年度繰越+予備費使用+流用等+移替: 一致', idA, '不一致', badA.length, badA.slice(0, 3));
console.log('現額 = 支出済+翌年度繰越+不用: 一致', idB, '不一致', badB.length, badB.slice(0, 3));
const T = (x?: number) => x === undefined ? '-' : (x / 1e12).toFixed(2);
console.log('年度 | ' + M.join(' | '));
for (const y of Y) console.log(y, M.map(m => `${T(tot[y][m])}(${cnt[y][m] ?? 0})`).join(' '));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t1-lifecycle/s1.json', JSON.stringify({ tot, cnt, byMin: Object.fromEntries(Object.entries(byMin).map(([y, m]) => [y, [...m]])) }));
