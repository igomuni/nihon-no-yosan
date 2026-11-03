// 年度ごとの区分の内訳、繰越の受け渡し（項単位）、府省の内訳、上位の流れの目
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const { rows, sumOut, sumUn } = JSON.parse(readFileSync('c1.json', 'utf8'));
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz')).toString());
const m = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/moku.json.gz')).toString());
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const T = (x: number) => (x / 1e12).toFixed(3);
// 1) 年度ごとの繰越・不用を、流れの区分で分ける
const perYear: any = {};
for (const y of Y) {
  const o: any = { y, cur: 0, cout: { steady: 0, spike: 0, mixed: 0 }, un: { steady: 0, spike: 0 }, cin: 0 };
  for (const r of rows) { const v = r.years[y]; if (!v) continue; o.cur += v.cur; o.cin += v.cin; if (v.cout > 0) o.cout[r.outKind] += v.cout; if (v.un > 0) o.un[r.unKind] += v.un; }
  perYear[y] = o; console.log(y, '現額', T(o.cur), '繰越 続く', T(o.cout.steady), '偏る', T(o.cout.spike), 'その他', T(o.cout.mixed), '| 不用 続く', T(o.un.steady), '偏る', T(o.un.spike), '| 前年度繰越', T(o.cin));
}
// 2) 繰越の受け渡し: 流れの中で y の翌年度繰越と y+1 の前年度繰越が一致するか
let pairs = 0, eq = 0, outSum = 0, eqSum = 0, noNext = 0, noNextSum = 0;
for (const r of rows) for (const y of Y.slice(0, -1)) { const a = r.years[y]; if (!a || a.cout <= 0) continue; const b = r.years[y + 1]; outSum += a.cout; if (!b) { noNext++; noNextSum += a.cout; continue; } pairs++; if (Math.abs(b.cin - a.cout) < 1) { eq++; eqSum += a.cout; } }
console.log('\n繰越の受け渡し: 繰越のある項・年度', pairs + noNext, '額', T(outSum), '| 翌年度の同じ流れの前年度繰越と円まで一致', eq, T(eqSum), '| 翌年度に流れが無い', noNext, T(noNextSum));
// 3) 府省の内訳（内閣府・国土交通省）
for (const g of ['内閣府', '国土交通省']) {
  const rs = rows.filter((r: any) => r.group === g); const c = rs.reduce((a: number, r: any) => a + r.cout, 0), u = rs.reduce((a: number, r: any) => a + r.un, 0), cur = rs.reduce((a: number, r: any) => a + r.cur, 0);
  console.log(`\n${g} 現額 ${T(cur)} 繰越 ${T(c)} 不用 ${T(u)}`);
  rs.sort((a: any, b: any) => (b.cout + b.un) - (a.cout + a.un)).slice(0, 6).forEach((r: any) => console.log('  ', r.name, '繰越', T(r.cout), '不用', T(r.un), '現額', T(r.cur)));
}
// 4) 上位の流れの目（繰越・不用の大きい目）
const top = [...rows].sort((a: any, b: any) => (b.cout + b.un) - (a.cout + a.un)).slice(0, 6);
const idOfKou = (i: number) => d.kous[i].id;
const nodesByKou = new Map<string, number[]>(); m.nodes.forEach((n: any, j: number) => { const id = m.kous[n[0]]; (nodesByKou.get(id) ?? nodesByKou.set(id, []).get(id)!).push(j); });
const mokuOut: any = {};
for (const r of top) {
  const acc = new Map<string, { c: number; u: number }>();
  for (const y of Object.keys(r.years)) for (const j of nodesByKou.get(idOfKou(r.years[y].i)) ?? []) { const n = m.nodes[j]; const c = mokuValue(n, 'carried') ?? 0, u = mokuValue(n, 'unused') ?? 0; const a = acc.get(n[2]) ?? acc.set(n[2], { c: 0, u: 0 }).get(n[2])!; a.c += c * 1000; a.u += u * 1000; }
  const list = [...acc].sort((a, b) => (b[1].c + b[1].u) - (a[1].c + a[1].u)).slice(0, 4);
  mokuOut[r.key] = list;
  console.log(`\n${r.group} ${r.name}`); list.forEach(([n, a]) => console.log('   目', n, '繰越', T(a.c), '不用', T(a.u)));
}
writeFileSync('c2.json', JSON.stringify({ perYear, mokuOut, handoff: { pairs, eq, outSum, eqSum, noNext, noNextSum } }));
