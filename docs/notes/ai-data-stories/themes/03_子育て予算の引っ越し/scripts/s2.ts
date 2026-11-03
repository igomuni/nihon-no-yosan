// FY2023 こども家庭庁の事項・目の名前で、FY2022 の事項・目を探す（候補）
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleGroupsOf, nameKey } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), j = rd('jikou.json.gz'), m = rd('moku.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const t = (x: number | null) => x === null ? 'null' : (x / 1e9).toFixed(3);
const isCfa = (id: string) => { const k = kouById.get(id); return k && k.year === 2023 && k.account === 'general' && lifecycleGroupsOf(k)[0] === 'こども家庭庁'; };
const g = (id: string) => { const k = kouById.get(id); return k ? `${lifecycleGroupsOf(k)[0]}/${k.name}` : id; };
console.log('=== 事項名の一致（FY2022 一般会計）');
const j22 = j.nodes.filter((n: any) => n[1] === 2022 && (j.kous[n[0]] as string).includes(':general:'));
for (const n of j.nodes) { if (n[1] !== 2023 || !isCfa(j.kous[n[0]]) || n[3] === null) continue;
  const hits = j22.filter((p: any) => nameKey(p[2]) === nameKey(n[2]));
  console.log(`${g(j.kous[n[0]])} / ${n[2]} ${t(n[3])} ← ${hits.length ? hits.map((p: any) => `${g(j.kous[p[0]])} ${t(p[3])}`).join(' | ') : '一致なし'}`); }
console.log('\n=== 目（名前＋分類コード）の一致（FY2022 一般会計）。FY2023 こども家庭庁の目の政府案を、FY2022 の府省ごとに');
const m22 = new Map<string, any[]>();
for (const n of m.nodes) { if (n[1] !== 2022) continue; const id = m.kous[n[0]] as string; if (!id.includes(':general:') || n[5] === null) continue; const key = `${nameKey(n[2])}|${n[3]}`; (m22.get(key) ?? m22.set(key, []).get(key)!).push(n); }
const agg = new Map<string, Map<string, { b23: number; b22: number; n: number }>>();
for (const n of m.nodes) { if (n[1] !== 2023 || !isCfa(m.kous[n[0]]) || n[5] === null) continue;
  const kou = kouById.get(m.kous[n[0]]).name;
  const hits = m22.get(`${nameKey(n[2])}|${n[3]}`) ?? [];
  const from = hits.length === 0 ? '(一致なし)' : [...new Set(hits.map((p: any) => lifecycleGroupsOf(kouById.get(m.kous[p[0]]))[0]))].join('+') + (hits.length > 1 ? `(${hits.length}件)` : '');
  const a = agg.get(kou) ?? agg.set(kou, new Map()).get(kou)!; const r = a.get(from) ?? { b23: 0, b22: 0, n: 0 }; r.b23 += n[5]; r.b22 += hits.reduce((s: number, p: any) => s + p[5], 0); r.n++; a.set(from, r);
}
for (const [kou, a] of agg) console.log(kou, [...a].map(([f, r]) => `${f}: 目${r.n} FY23=${t(r.b23)} FY22候補=${t(r.b22)}`).join(' / '));
