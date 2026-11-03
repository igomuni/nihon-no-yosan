// 防衛関係費（35）の補正・決算。目の単位と、防衛省所管の項の単位で突き合わせる
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, mokuValue, lifecycleValues, MOKU_FLAG } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const KEYS = ['budget', 'revised', 'carriedIn', 'current', 'spent', 'carried', 'unused'] as const;
const t = (x?: number | null) => (x === undefined || x === null ? '   -  ' : (x / 1e9).toFixed(3));
// 目（35）
const M: Record<number, any> = {};
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:') || !Y.includes(n[1])) continue;
  if (codesOfMoku(n[3], 'general').major !== '35') continue;
  const r = (M[n[1]] ??= { n: 0, suppNet: 0, suppRows: 0, agg: 0, kouOnly: 0, ident: 0, identN: 0, settleN: 0, settleNull: 0 });
  r.n++;
  for (const k of KEYS) { const v = mokuValue(n, k); if (v !== null) r[k] = (r[k] ?? 0) + v; }
  if (n[7] !== null) { r.suppNet += n[7]; r.suppRows++; }
  if (n[13] & MOKU_FLAG.suppAggregated) r.agg++;
  if (n[13] & MOKU_FLAG.suppKouOnly) r.kouOnly++;
  const cur = n[8], sp = n[9], ca = n[10], un = n[11];
  if (cur !== null && sp !== null && ca !== null && un !== null) { r.identN++; const gap = cur - sp - ca - un; if (Math.abs(gap) > 0.5) r.ident++; }
  if (n[8] !== null) r.settleN++; else r.settleNull++;
}
console.log('目（35）: 年度 件数 | 政府案 補正後(個別行) 補正差引(個別行) | 前年度繰越 現額 支出済 翌年度繰越 不用 | 恒等式の外れ/対象 | 決算値なしの目 | 補正: 外N目 項行だけ');
for (const y of Y) { const r = M[y]; console.log(y, r.n, '|', t(r.budget), t(r.revised), t(r.suppNet), `(${r.suppRows})`, '|', t(r.carriedIn), t(r.current), t(r.spent), t(r.carried), t(r.unused), '|', r.ident, '/', r.identN, '|', r.settleNull, '|', r.agg, r.kouOnly); }
// 項（防衛省所管・一般会計）
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const K: Record<number, any> = {};
d.kous.forEach((k: any, i: number) => {
  if (k.account !== 'general' || k.ministry !== '防衛省' || !Y.includes(k.year)) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  const r = (K[k.year] ??= {});
  for (const key of ['budget_amount', 'revised_amount', 'supp_net', 'appropriation', 'carryover_in', 'reserve_use', 'fungible', 'transfer', 'current_amount', 'spent', 'carryover_out', 'unused'] as const) if (v[key] !== undefined) r[key] = (r[key] ?? 0) + v[key]!;
});
console.log('\n項（防衛省所管）: 年度 | 政府案 補正後 補正差引 | 歳出予算額 前年度繰越 予備費使用 流用等 移替 | 現額 支出済 翌年度繰越 不用 | 現額−(歳出予算額+前年度繰越+予備費+流用+移替)');
const y2 = (x?: number) => (x === undefined ? '   -  ' : (x / 1e12).toFixed(3));
for (const y of Y) { const r = K[y] ?? {}; const gap = r.current_amount === undefined ? undefined : r.current_amount - (r.appropriation ?? 0) - (r.carryover_in ?? 0) - (r.reserve_use ?? 0) - (r.fungible ?? 0) - (r.transfer ?? 0); const g2 = r.current_amount === undefined ? undefined : r.current_amount - r.spent - r.carryover_out - r.unused; console.log(y, '|', y2(r.budget_amount), y2(r.revised_amount), y2(r.supp_net), '|', y2(r.appropriation), y2(r.carryover_in), y2(r.reserve_use), y2(r.fungible), y2(r.transfer), '|', y2(r.current_amount), y2(r.spent), y2(r.carryover_out), y2(r.unused), '|', gap === undefined ? '-' : Math.round(gap), g2 === undefined ? '-' : Math.round(g2)); }
// 資金繰入の目
console.log('\n「防衛力強化」を含む目');
for (const n of m.nodes) if ((n[2] as string).includes('防衛力強化のための資金')) { const k = kouById.get(m.kous[n[0]]); console.log(n[1], k?.ministry, k?.org, k?.name, '/', n[2], 'codes', n[3], 'budget', n[5], 'revised', n[6], 'current', n[8], 'spent', n[9], 'carried', n[10], 'unused', n[11]); }
writeFileSync(process.argv[2] ?? '/dev/null', JSON.stringify({ M, K }));
