// LP に埋め込む値（億円に丸める）
import { readFileSync, writeFileSync } from 'node:fs';
const c1 = JSON.parse(readFileSync('c1.json', 'utf8')), c2 = JSON.parse(readFileSync('c2.json', 'utf8')), c5 = JSON.parse(readFileSync('c5.json', 'utf8'));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const oku = (x: number) => Math.round(x / 1e8);
const per = Y.map(y => { const o = c2.perYear[y]; return { y, cur: oku(o.cur), st: oku(o.cout.steady), sp: oku(o.cout.spike), mx: oku(o.cout.mixed), us: oku(o.un.steady), up: oku(o.un.spike) }; });
const yearly = (r: any, f: string) => Y.map(y => (r.years[y] ? oku(r.years[y][f]) : null));
const top = [...c1.rows].sort((a: any, b: any) => b.cout - a.cout).slice(0, 14).map((r: any) => ({ n: r.name, g: r.group, c: oku(r.cout), cur: oku(r.cur), k: r.outKind, yrs: r.coutYears, ny: r.nYears, cy: yearly(r, 'cout'), uy: yearly(r, 'un') }));
const topU = [...c1.rows].sort((a: any, b: any) => b.un - a.un).slice(0, 12).map((r: any) => ({ n: r.name, g: r.group, u: oku(r.un), cur: oku(r.cur), k: r.unKind, uy: yearly(r, 'un'), res: /予備費/.test(r.name) }));
const prog = Object.fromEntries(Object.entries(c5).map(([k, v]: any) => [k, { label: v.label, new: oku(v.new), spent: oku(v.spent), un: oku(v.un), start: oku(v.start), end: oku(v.end), years: v.years.map((x: any) => ({ y: x.y, cur: oku(x.cur), spent: oku(x.spent), cout: oku(x.cout), un: oku(x.un), cin: oku(x.cin), tr: oku(x.tr) })) }]));
const naikaku = c1.rows.filter((r: any) => r.group === '内閣府');
const nk = { cur: oku(naikaku.reduce((a: number, r: any) => a + r.cur, 0)), c: oku(naikaku.reduce((a: number, r: any) => a + r.cout, 0)), u: oku(naikaku.reduce((a: number, r: any) => a + r.un, 0)) };
const nkCovid = naikaku.filter((r: any) => /新型コロナウイルス感染症対応地方創生推進費|物価高騰対応地方創生推進費/.test(r.name));
const nkx = { cur: oku(nkCovid.reduce((a: number, r: any) => a + r.cur, 0)), c: oku(nkCovid.reduce((a: number, r: any) => a + r.cout, 0)), u: oku(nkCovid.reduce((a: number, r: any) => a + r.un, 0)) };
const h = c2.handoff;
const page = { Y, per, top, topU, prog, nk, nkx, total: { cur: oku(c1.sumCur), c: oku(c1.sumOut), u: oku(c1.sumUn) }, hand: { n: h.pairs + h.noNext, eq: h.eq, out: oku(h.outSum), eqSum: oku(h.eqSum), noNext: h.noNext, noNextSum: oku(h.noNextSum) }, flows: c1.rows.length, flowsOut: c1.rows.filter((r: any) => r.cout > 0).length };
writeFileSync('page-data.json', JSON.stringify(page));
console.log(JSON.stringify({ nk, nkx, total: page.total, hand: page.hand }), JSON.stringify(page).length);
