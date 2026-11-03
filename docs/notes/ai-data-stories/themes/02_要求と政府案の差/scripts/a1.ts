// テーマ 2: 概算要求と政府案（項の単位）。年度 × 会計 × 府省の要求額・政府案
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleValues, lifecycleGroupsOf, lifecyclePublishersOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const OUT = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t2-request/';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const YS = [2023, 2024, 2025, 2026, 2027];
type Row = { i: number; id: string; year: number; account: string; ministry: string; pubs: string[]; name: string; ro: string | null; req?: number; prev?: number; bud?: number };
const rows: Row[] = [];
d.kous.forEach((k: any, i: number) => {
  if (!YS.includes(k.year)) return;
  const v = lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'));
  rows.push({ i, id: k.id, year: k.year, account: k.account, ministry: lifecycleGroupsOf(k).join('・'), pubs: [...lifecyclePublishersOf(k)], name: k.name, ro: k.requestOnly ?? null, req: v.request_amount, prev: v.request_prev, bud: v.budget_amount });
});
const t = (x: number) => (x / 1e12).toFixed(2);
const sum = (a: Row[], f: (r: Row) => number | undefined) => a.reduce((s, r) => s + (f(r) ?? 0), 0);
const summary: any = {};
for (const y of YS) for (const acc of ['general', 'special']) {
  const a = rows.filter(r => r.year === y && r.account === acc);
  const both = a.filter(r => r.req !== undefined && r.bud !== undefined);
  const reqOnly = a.filter(r => r.req !== undefined && r.bud === undefined);
  const budOnly = a.filter(r => r.req === undefined && r.bud !== undefined);
  const s = { kous: a.length, both: both.length, reqBoth: sum(both, r => r.req), budBoth: sum(both, r => r.bud), reqOnlyN: reqOnly.length, reqOnly: sum(reqOnly, r => r.req), budOnlyN: budOnly.length, budOnly: sum(budOnly, r => r.bud), reqAll: sum(a, r => r.req), budAll: sum(a, r => r.bud), prevAll: sum(a, r => r.prev), over: both.filter(r => r.bud! > r.req!).length, under: both.filter(r => r.bud! < r.req!).length, same: both.filter(r => r.bud === r.req).length, reqZeroBudPos: both.filter(r => r.req === 0 && r.bud! > 0).length };
  summary[`${y}:${acc}`] = s;
  console.log(y, acc, `項${s.kous} 両方${s.both}（要求${t(s.reqBoth)} 政府案${t(s.budBoth)} 差${t(s.budBoth - s.reqBoth)} 比${(s.budBoth / s.reqBoth * 100).toFixed(1)}%） 要求のみ${s.reqOnlyN}(${t(s.reqOnly)}) 予算のみ${s.budOnlyN}(${t(s.budOnly)}) 要求計${t(s.reqAll)} 前年度予算額計${t(s.prevAll)} 政府案計${t(s.budAll)} 増${s.over}/減${s.under}/同${s.same} 要求0→予算あり${s.reqZeroBudPos}`);
}
// 府省別（一般会計、両方ある項）
const byMin: any = {};
for (const y of [2023, 2024, 2025, 2026]) {
  const a = rows.filter(r => r.year === y && r.account === 'general' && r.req !== undefined && r.bud !== undefined);
  for (const r of a) { const m = (byMin[r.ministry] ??= {}); const c = (m[y] ??= { req: 0, bud: 0, n: 0 }); c.req += r.req!; c.bud += r.bud!; c.n++; }
}
console.log('\n府省別（一般会計、要求と政府案が両方ある項）政府案−要求（兆円）と比');
for (const [m, v] of Object.entries<any>(byMin).sort((a, b) => (a[1][2026]?.bud - a[1][2026]?.req || 0) - (b[1][2026]?.bud - b[1][2026]?.req || 0))) console.log(m.padEnd(10), [2023, 2024, 2025, 2026].map(y => v[y] ? `${t(v[y].bud - v[y].req)}(${(v[y].bud / v[y].req * 100).toFixed(1)}%)` : '-').join(' '));
// 項: 削られた・上回った（一般会計 4 年）
const both = rows.filter(r => r.account === 'general' && r.year <= 2026 && r.req !== undefined && r.bud !== undefined);
console.log('\n削られた項（政府案−要求の小さい順）');
both.sort((a, b) => (a.bud! - a.req!) - (b.bud! - b.req!)).slice(0, 12).forEach(r => console.log(r.year, r.ministry, r.name, t(r.req!), '→', t(r.bud!), t(r.bud! - r.req!)));
console.log('\n要求を上回った項');
both.sort((a, b) => (b.bud! - b.req!) - (a.bud! - a.req!)).slice(0, 15).forEach(r => console.log(r.year, r.ministry, r.name, t(r.req!), '→', t(r.bud!), '+' + t(r.bud! - r.req!)));
// FY2027 要求（府省別、要求所管）と FY2026 要求
const req27: any = {}; for (const r of rows.filter(r => (r.year === 2027 || r.year === 2026) && r.account === 'general' && r.req !== undefined)) { const p = r.pubs.length === 1 ? r.pubs[0]! : r.pubs.length ? '複数' : '(なし)'; (req27[p] ??= {})[r.year] = (req27[p][r.year] ?? 0) + r.req!; }
console.log('\n一般会計の要求額（要求所管別）FY2026 / FY2027');
Object.entries<any>(req27).sort((a, b) => (b[1][2027] ?? 0) - (a[1][2027] ?? 0)).forEach(([p, v]) => console.log(p.padEnd(12), t(v[2026] ?? 0), t(v[2027] ?? 0)));
writeFileSync(OUT + 'a1.json', JSON.stringify({ summary, byMin, rows }));
