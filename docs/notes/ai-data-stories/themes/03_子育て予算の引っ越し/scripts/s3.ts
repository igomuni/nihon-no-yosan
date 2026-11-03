// FY2023 こども家庭庁の目 → FY2022 の目（目名・分類コードが同じで、FY2022 の一般会計に 1 つだけあるもの = 候補）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleGroupsOf, nameKey } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const isCfa = (id: string) => { const k = kouById.get(id); return k && k.year === 2023 && k.account === 'general' && lifecycleGroupsOf(k)[0] === 'こども家庭庁'; };
const m22 = new Map<string, any[]>();
for (const n of m.nodes) { if (n[1] !== 2022) continue; const id = m.kous[n[0]] as string; if (!id.includes(':general:') || n[5] === null) continue; const key = `${nameKey(n[2])}|${n[3]}`; (m22.get(key) ?? m22.set(key, []).get(key)!).push(n); }
type Row = { kou23: string; moku: string; codes: string; b23: number; status: 'unique' | 'multi' | 'none'; from?: string; fromKou?: string; b22?: number };
const rows: Row[] = [];
for (const n of m.nodes) {
  if (n[1] !== 2023 || !isCfa(m.kous[n[0]]) || n[5] === null) continue;
  const hits = m22.get(`${nameKey(n[2])}|${n[3]}`) ?? [];
  const r: Row = { kou23: kouById.get(m.kous[n[0]]).name, moku: n[2], codes: n[3], b23: n[5], status: hits.length === 1 ? 'unique' : hits.length ? 'multi' : 'none' };
  if (hits.length === 1) { const pk = kouById.get(m.kous[hits[0][0]]); r.from = lifecycleGroupsOf(pk)[0]; r.fromKou = pk.name; r.b22 = hits[0][5]; }
  rows.push(r);
}
const t = (x: number) => (x / 1e9).toFixed(3);
const sum = (f: (r: Row) => boolean, k: 'b23' | 'b22' = 'b23') => rows.filter(f).reduce((s, r) => s + (r[k] ?? 0), 0);
console.log('目の数', rows.length, 'FY23 計', t(sum(() => true)));
for (const st of ['unique', 'multi', 'none'] as const) console.log(st, rows.filter(r => r.status === st).length, 'FY23', t(sum(r => r.status === st)), 'FY22候補', t(sum(r => r.status === st, 'b22')));
const byFrom = new Map<string, { b23: number; b22: number; kous: Set<string> }>();
for (const r of rows.filter(r => r.status === 'unique')) { const x = byFrom.get(r.from!) ?? { b23: 0, b22: 0, kous: new Set() }; x.b23 += r.b23; x.b22 += r.b22!; x.kous.add(r.fromKou!); byFrom.set(r.from!, x); }
for (const [f, x] of byFrom) console.log(f, 'FY23', t(x.b23), 'FY22', t(x.b22), [...x.kous].join('、'));
console.log('\n大きい目（0.01兆円以上）');
rows.filter(r => r.b23 >= 1e7).sort((a, b) => b.b23 - a.b23).forEach(r => console.log(`${r.kou23} / ${r.moku} [${r.codes}] ${t(r.b23)} ← ${r.status === 'unique' ? `${r.from} ${r.fromKou} ${t(r.b22!)}` : r.status}`));
console.log('\n一致しない・複数の目');
rows.filter(r => r.status !== 'unique' && r.b23 > 0).sort((a, b) => b.b23 - a.b23).slice(0, 12).forEach(r => console.log(`${r.kou23} / ${r.moku} [${r.codes}] ${t(r.b23)} ${r.status}`));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t3-kodomo/s3.json', JSON.stringify(rows));
