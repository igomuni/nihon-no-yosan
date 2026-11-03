import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz'), j = rd('jikou.json.gz');
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
const CORE = new Set(['障害保健福祉費', '障害児支援等対策費']);
// 項の値（円）
const kou: any[] = [];
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || !CORE.has(k.name)) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')); const a = lifecycleRowAmounts(v);
  kou.push({ y: k.year, org: k.org, name: k.name, id: k.id, req: a.request ?? null, bud: a.budget ?? null, rev: a.revised ?? null, cur: v.current_amount ?? null, spent: a.spent ?? null, carried: v.carryover_out ?? null, unused: v.unused ?? null, carriedIn: v.carryover_in ?? null, keys: Object.keys(v) });
});
console.log('value keys', kou[0].keys.join(','));
const sum = (y: number, f: string) => { const r = kou.filter(x => x.y === y && x[f] !== null); return r.length ? r.reduce((s, x) => s + x[f], 0) : null; };
const tot = Y.map(y => ({ y, req: sum(y, 'req'), bud: sum(y, 'bud'), rev: sum(y, 'rev'), cur: sum(y, 'cur'), spent: sum(y, 'spent'), carried: sum(y, 'carried'), unused: sum(y, 'unused') }));
const t = (x: number | null) => x === null ? '-' : (x / 1e12).toFixed(3);
for (const r of tot) console.log(r.y, 'req', t(r.req), 'bud', t(r.bud), 'rev', t(r.rev), 'cur', t(r.cur), 'spent', t(r.spent), 'car', t(r.carried), 'unused', t(r.unused));
console.log('per kou'); for (const x of kou) console.log(x.y, x.org, x.name, t(x.req), t(x.bud), t(x.rev), t(x.cur), t(x.spent), t(x.unused));
// 目（千円）: 政府案・補正後・決算
const MOKU = ['障害者自立支援給付費負担金', '障害児入所給付費等負担金', '障害者医療費負担金', '特別児童扶養手当給付費', '地域生活支援事業費等補助金', '特別障害者手当等給付費負担金', '障害児入所医療費等負担金'];
const mk: Record<string, Record<number, any>> = {};
for (const n of m.nodes) { const id = m.kous[n[0]] as string; const kn = id.split('|').pop()!; if (!id.includes(':general:') || !CORE.has(kn)) continue; const name = n[2]; const key = MOKU.includes(name) ? name : 'その他';
  const r = (mk[key] ??= {})[n[1]] ??= { bud: null, rev: null, req: null, cur: null, spent: null, unused: null, carried: null };
  for (const [f, mm] of [['bud', 'budget'], ['rev', 'revised'], ['req', 'request'], ['cur', 'current'], ['spent', 'spent'], ['unused', 'unused'], ['carried', 'carried']] as const) { const v = mokuValue(n, mm as any); if (v !== null) r[f] = (r[f] ?? 0) + v; } }
for (const [k, r] of Object.entries(mk)) console.log(k.padEnd(20), Y.map(y => r[y] ? `${(r[y].bud ?? NaN) / 1e9 | 0 ? ((r[y].bud) / 1e9).toFixed(3) : (r[y].bud === null ? '-' : (r[y].bud / 1e9).toFixed(3))}` : '-').join(' '));
// 事項の前年度予算額（FY2023 のこども家庭庁）
j.nodes.forEach((n: any) => { const id = j.kous[n[0]] as string; if (n[1] === 2023 && id.includes(':general:') && CORE.has(id.split('|').pop()!)) console.log('事項 2023', id.split(':')[2].split('|')[0], n[2], 'bud', n[3], 'prev', n[4]); });
j.nodes.forEach((n: any) => { const id = j.kous[n[0]] as string; if (n[1] === 2022 && id.includes(':general:') && CORE.has(id.split('|').pop()!)) console.log('事項 2022', n[2], 'bud', n[3], 'prev', n[4]); });
writeFileSync('s3.json', JSON.stringify({ tot, kou: kou.map(({ keys, ...x }) => x), mk }));
