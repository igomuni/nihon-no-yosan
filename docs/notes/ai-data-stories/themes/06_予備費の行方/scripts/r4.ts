// LP 用のデータを作る（r1.json・r3.json から）。単位は億円（円 / 1e8 を四捨五入）
import { readFileSync, writeFileSync } from 'node:fs';
const o = JSON.parse(readFileSync('r1.json', 'utf8')), s = JSON.parse(readFileSync('r3.json', 'utf8'));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const oku = (x: number | null) => (x === null ? null : Math.round(x / 1e8));
const years = Y.map(y => ({
  y, used: oku(o[y].pos),
  reserves: o[y].reserves.map((r: any) => ({ name: r.name, normal: r.name === '予備費', initialName: r.initialName, initial: oku(r.initial), budget: oku(r.budget), used: oku(-r.used), unused: oku(r.unused) })),
  usersMoku: o[y].users, kouCount: null,
  onlyRes: { cnt: s[y].cnt, all: s[y].allCnt, res: oku(s[y].res), sp: oku(s[y].sp), co: oku(s[y].co), un: oku(s[y].un) },
}));
// 府省・主要経費・項の 8 年合計と年度別
const acc = (key: 'byGroup' | 'byMajor') => { const m = new Map<string, number[]>(); for (const [i, y] of Y.entries()) for (const row of o[y][key]) { const name = key === 'byMajor' ? row[1] : row[0]; const v = key === 'byMajor' ? row[2] : row[1]; const a = m.get(name) ?? m.set(name, Y.map(() => 0)).get(name)!; a[i] += v; } return [...m].map(([n, a]) => ({ n, v: a.map(x => oku(x)), total: oku(a.reduce((p, q) => p + q, 0)) })).sort((a, b) => b.total! - a.total!); };
const kous = new Map<string, any>();
for (const [i, y] of Y.entries()) for (const k of o[y].byKou) { const key = `${k.group}|${k.kou}`; const a = kous.get(key) ?? kous.set(key, { group: k.group, kou: k.kou, v: Y.map(() => 0), mokus: new Map<string, number>() }).get(key)!; a.v[i] += k.v; for (const [mn, mv] of k.mokus) a.mokus.set(mn, (a.mokus.get(mn) ?? 0) + mv); }
const kouList = [...kous.values()].map(k => ({ group: k.group, kou: k.kou, v: k.v.map((x: number) => oku(x)), total: oku(k.v.reduce((p: number, q: number) => p + q, 0)), mokus: [...k.mokus].sort((a: any, b: any) => b[1] - a[1]).slice(0, 2).map(([n, v]: any) => [n, oku(v)]) })).sort((a, b) => b.total! - a.total!).slice(0, 12);
// 受け取った目の上位（目全体の現額・支出・繰越・不用。予備費の分だけではない）
const mokus: any[] = []; for (const y of Y) for (const u of o[y].userList) mokus.push({ y, group: u.group, kou: u.kou, moku: u.moku, v: oku(u.v), current: oku(u.current), spent: oku(u.spent), carried: oku(u.carried), unused: oku(u.unused) });
mokus.sort((a, b) => b.v - a.v);
const data = { Y, years, groups: acc('byGroup'), majors: acc('byMajor'), kous: kouList, topMokus: mokus.slice(0, 10) };
writeFileSync('page-data.json', JSON.stringify(data));
const tot = (f: (r: any) => number | null) => years.reduce((p, y) => p + y.reserves.reduce((q: number, r: any) => q + (f(r) ?? 0), 0), 0);
console.log('8年 計上', tot(r => r.budget), '使用', tot(r => r.used), '不用', tot(r => r.unused), '使用(目)', years.reduce((p, y) => p + y.used!, 0));
console.log('府省', data.groups.slice(0, 6).map(g => `${g.n} ${g.total}`).join(' / '));
console.log('主要経費', data.majors.slice(0, 6).map(g => `${g.n} ${g.total}`).join(' / '));
console.log('項', data.kous.slice(0, 8).map(g => `${g.group} ${g.kou} ${g.total}`).join(' / '));
console.log('目', data.topMokus.slice(0, 6).map(m => `${m.y} ${m.kou}/${m.moku} 予備費${m.v} 現額${m.current} 支出${m.spent} 繰越${m.carried} 不用${m.unused}`).join('\n'));
const norm = years.map(y => y.reserves.filter((r: any) => r.normal)[0]); console.log('通常の予備費 使用率', norm.map((r: any, i) => `${Y[i]} ${r.used}/${r.budget}`).join(' '));
