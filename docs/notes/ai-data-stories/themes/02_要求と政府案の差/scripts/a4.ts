// LP 用のデータ（億円）。一般会計、要求額と政府案が両方ある項
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t2-request/';
const a1 = JSON.parse(readFileSync(OUT + 'a1.json', 'utf8')), a3 = JSON.parse(readFileSync(OUT + 'a3.json', 'utf8'));
const oku = (yen: number) => Math.round(yen / 1e8);
const G = a1.rows.filter((r: any) => r.account === 'general');
const Y = [2023, 2024, 2025, 2026];
const cat = (r: any) => r.name === '国債費' ? 'debt' : (r.name === '地方交付税交付金' || r.name === '地方特例交付金') ? 'local' : /予備費/.test(r.name) ? 'reserve' : 'other';
const years = Y.map(y => {
  const both = G.filter((r: any) => r.year === y && r.req !== undefined && r.bud !== undefined);
  const gap: any = { debt: 0, local: 0, reserve: 0, other: 0 };
  for (const r of both) gap[cat(r)] += r.bud - r.req;
  const s = a1.summary[`${y}:general`];
  return { y, req: oku(s.reqBoth), bud: oku(s.budBoth), n: s.both, up: s.over, down: s.under, same: s.same, gap: Object.fromEntries(Object.entries(gap).map(([k, v]: any) => [k, oku(v)])), reqOnlyN: s.reqOnlyN, reqOnly: oku(s.reqOnly), budOnlyN: s.budOnlyN, budOnly: oku(s.budOnly), reqAll: oku(s.reqAll), budAll: oku(s.budAll), prevAll: oku(s.prevAll) };
});
// 府省別
const mins: any = {};
for (const r of G) { if (r.year > 2026 || r.req === undefined || r.bud === undefined) continue; const m = (mins[r.ministry] ??= { n: r.ministry, y: {} }); const c = (m.y[r.year] ??= { req: 0, bud: 0 }); c.req += r.req; c.bud += r.bud; }
const ministries = Object.values<any>(mins).map(m => ({ n: m.n, y: Object.fromEntries(Object.entries<any>(m.y).map(([y, c]) => [y, { req: oku(c.req), bud: oku(c.bud) }])) })).sort((a, b) => (b.y[2026]?.bud ?? 0) - (a.y[2026]?.bud ?? 0));
// 事項要求の注記（行の数）
const marks: any = {}; for (const y of [2023, 2024, 2025, 2026, 2027]) for (const r of a3[y]) (marks[r.pub] ??= {})[y] = r.marks;
// 2027
const req = (y: number, f: (r: any) => boolean) => G.filter((r: any) => r.year === y && r.req !== undefined && f(r)).reduce((s: number, r: any) => s + r.req, 0);
const pubOf = (r: any) => (r.pubs.length === 1 ? r.pubs[0] : r.pubs.join('|'));
const pubs = [...new Set(G.filter((r: any) => (r.year === 2026 || r.year === 2027) && r.req !== undefined).map(pubOf))] as string[];
const y27 = pubs.map(p => ({ n: p, r26: oku(req(2026, r => pubOf(r) === p)), r27: oku(req(2027, r => pubOf(r) === p)) })).sort((a, b) => b.r27 - a.r27);
// 項の例
const pick = (y: number, name: string) => { const r = G.find((r: any) => r.year === y && r.name === name); return r ? { y, name, req: r.req === undefined ? null : oku(r.req), bud: r.bud === undefined ? null : oku(r.bud) } : null; };
const examples = { debt: Y.map(y => pick(y, '国債費')).concat([pick(2027, '国債費')]), local: Y.map(y => pick(y, '地方交付税交付金')).concat([pick(2027, '地方交付税交付金')]), reserve: Y.map(y => pick(y, '予備費')) };
const budOnly = Y.map(y => ({ y, items: G.filter((r: any) => r.year === y && r.req === undefined && r.bud !== undefined).sort((a: any, b: any) => b.bud - a.bud).slice(0, 4).map((r: any) => ({ m: r.ministry, n: r.name, bud: oku(r.bud) })) }));
writeFileSync(OUT + 'lp-data.json', JSON.stringify({ years, ministries, marks, y27, examples, budOnly }));
console.log(JSON.stringify(years, null, 0)); console.log(JSON.stringify(examples)); console.log(JSON.stringify(budOnly));
