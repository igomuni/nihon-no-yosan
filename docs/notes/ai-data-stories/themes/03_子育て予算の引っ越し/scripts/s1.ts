// こども家庭庁 FY2023 の項 → 事項。事項の前年度予算額と、FY2022 からの確定した対応（事項の links）
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { JIKOU_EVIDENCE, JIKOU_AMOUNT, lifecycleGroupsOf, lifecycleValues, lifecycleRowAmounts } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), j = rd('jikou.json.gz');
const kouById = new Map(d.kous.map((k: any) => [k.id, k]));
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const kouIdx = new Map(d.kous.map((k: any, i: number) => [k.id, i]));
const kouBudget = (id: string) => lifecycleRowAmounts(lifecycleValues((ev.get(kouIdx.get(id) as number) ?? []).filter((e: any) => e[1] !== 'derived'))).budget;
const inL = new Map<number, any>(); for (const l of j.links) inL.set(l[1], l);
const ev2s = (b: number) => JIKOU_EVIDENCE.filter((_, i) => b & (1 << i)).join('+');
const t = (x: number | null) => x === null ? 'null' : (x / 1e9).toFixed(3);
let tot = 0, totPrev = 0, linkedB = 0;
const byFrom = new Map<string, number>();
const cfaKou = j.kous.map((id: string, i: number) => [id, i]).filter(([id]: any) => { const k: any = kouById.get(id); return k && k.year === 2023 && k.account === 'general' && lifecycleGroupsOf(k)[0] === 'こども家庭庁'; });
for (const [id, ki] of cfaKou as any[]) {
  const k: any = kouById.get(id);
  const ns = j.nodes.map((n: any, i: number) => [n, i]).filter(([n]: any) => n[0] === ki);
  console.log(`\n■ ${k.name} 項の政府案 ${t((kouBudget(id) ?? 0) / 1000)}兆  事項 ${ns.length}`);
  for (const [n, i] of ns as any[]) {
    tot += n[3] ?? 0; totPrev += n[4] ?? 0;
    const l = inL.get(i);
    let from = '（確定した対応なし）';
    if (l) { const p = j.nodes[l[0]]; const pk: any = kouById.get(j.kous[p[0]]); from = `← FY${p[1]} ${lifecycleGroupsOf(pk)[0]} ${pk.name} / ${p[2]} 政府案${t(p[3])} [${ev2s(l[2])}; ${JIKOU_AMOUNT[l[3]]}]`; linkedB += n[3] ?? 0; const key = lifecycleGroupsOf(pk)[0]!; byFrom.set(key, (byFrom.get(key) ?? 0) + (n[3] ?? 0)); }
    else byFrom.set('(なし)', (byFrom.get('(なし)') ?? 0) + (n[3] ?? 0));
    console.log(`  ${n[2]} 政府案${t(n[3])} 前年度${t(n[4])} 主要経費${n[8]}  ${from}`);
  }
}
console.log('\n事項の政府案計', t(tot), '前年度予算額計', t(totPrev), '確定した対応がある事項の政府案', t(linkedB));
console.log('前の年度の府省（確定した対応）', [...byFrom].map(([k, v]) => `${k}:${t(v)}`).join(' / '));
