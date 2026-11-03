// LP に埋め込む値（億円）
import { readFileSync, writeFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('f1.json', 'utf8'));
const f3 = JSON.parse(readFileSync('f3.json', 'utf8'));
const f4 = JSON.parse(readFileSync('f4.json', 'utf8'));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const oku = (v: number) => Math.round(v / 1e5); // 千円 → 億円
const C = ['fund', 'invest', 'reserve'];
const year = Y.map(y => ({ y, ...Object.fromEntries(C.flatMap(c => { const rs = rows.filter((r: any) => r.year === y && r.cls === c); return [[c + 'B', oku(rs.reduce((s: number, r: any) => s + (r.budget ?? 0), 0))], [c + 'S', oku(rs.reduce((s: number, r: any) => s + (r.supp ?? 0), 0))]]; })) }));
const groupBy = (key: string) => { const m = new Map<string, any>(); for (const r of rows) { const k = r[key]; const o = m.get(k) ?? { n: k, B: 0, S: 0, fund: 0, invest: 0, reserve: 0 }; o.B += r.budget ?? 0; o.S += r.supp ?? 0; o[r.cls] += (r.budget ?? 0) + (r.supp ?? 0); m.set(k, o); } return [...m.values()].map(o => ({ n: o.n, B: oku(o.B), S: oku(o.S), fund: oku(o.fund), invest: oku(o.invest), reserve: oku(o.reserve) })).sort((a, b) => b.B + b.S - a.B - a.S); };
const moku = new Map<string, any>();
for (const r of rows) { const k = r.cls + '|' + r.name; const o = moku.get(k) ?? { cls: r.cls, n: r.name, group: new Set(), major: r.majorName, B: 0, S: 0, years: {} }; o.group.add(r.group); o.B += r.budget ?? 0; o.S += r.supp ?? 0; o.years[r.year] = oku((r.budget ?? 0) + (r.supp ?? 0)) + (o.years[r.year] ?? 0); moku.set(k, o); }
const mokuList = [...moku.values()].map(o => ({ cls: o.cls, n: o.n, g: [...o.group].join('・'), major: o.major, B: oku(o.B), S: oku(o.S), v: Y.map(y => o.years[y] ?? null) })).sort((a, b) => b.B + b.S - a.B - a.S);
const cand = { n: f3.list.length, sum: oku(f3.list.reduce((s: number, x: any) => s + x.supp, 0)), byYear: Object.fromEntries(Object.entries(f3.byYear).map(([y, v]: any) => [y, { n: v.n, s: oku(v.supp) }])), top: f3.list.slice(0, 12).map((x: any) => ({ y: x.year, n: x.name, s: oku(x.supp), major: x.major })),
  ev: f4.cand_ev.evidence.map((x: any) => ({ y: x.year, n: x.name, s: oku(x.supp), jig: x.jig })), noev: f4.cand_ev.no_evidence.map((x: any) => ({ y: x.year, n: x.name, s: oku(x.supp), jig: x.jig })), nolinkN: f4.cand_ev.not_linked.length, nolinkS: oku(f4.cand_ev.not_linked.reduce((s: number, x: any) => s + x.supp, 0)) };
const rs = { byCls: Object.fromEntries(Object.entries(f4.by_cls).map(([k, v]: any) => [k, Object.fromEntries(Object.entries(v).map(([a, b]: any) => [a, Math.round(b / 1e8)]))])), jigN: Object.fromEntries(Object.entries(f4.jig_cls).map(([k, v]: any) => [k, v.length])), recips: [...f4.recips.reduce((m: Map<string, number>, r: any) => m.set(r[0], (m.get(r[0]) ?? 0) + r[2]), new Map()).entries()].sort((x: any, y: any) => y[1] - x[1]).slice(0, 10).map(([n, v]: any) => ({ n, v: Math.round(v / 1e8) })), nameIds: f4.name_ids, blkIds: f4.blk_ids, fundIds: f4.fund_ids_2024_25, overlap: f4.overlap };
const nNodes = rows.length;
writeFileSync('page-data.json', JSON.stringify({ Y, year, group: groupBy('group'), major: groupBy('majorName'), moku: mokuList, cand, rs, nNodes }));
const tot = (k: string) => year.reduce((s, r: any) => s + r[k], 0);
console.log('10年計 億円', C.map(c => `${c} 当初${tot(c + 'B')} 補正${tot(c + 'S')}`).join(' / '));
console.log('府省 top', groupBy('group').slice(0, 6).map(g => `${g.n} ${g.B}+${g.S}`).join(' | '));
console.log('主要経費 top', groupBy('majorName').slice(0, 6).map(g => `${g.n} ${g.B}+${g.S}`).join(' | '));
console.log('目 nodes', nNodes, '目の種類', mokuList.length);
