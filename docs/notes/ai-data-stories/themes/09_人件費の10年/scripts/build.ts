// LP に埋め込むデータを作る（単位: 億円。千円 → 億円は /1e5、円 → 億円は /1e8）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, mokuValue, lifecycleGroupsOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const DIR = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2d-personnel/';
const P = JSON.parse(readFileSync(DIR + 'p1.json', 'utf8'));
const V2 = JSON.parse(readFileSync(DIR + 'v2.json', 'utf8'));
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const oku = (v: number | undefined | null) => (v === undefined || v === null ? null : Math.round(v / 1e5));
const Y: number[] = P.Y, S: number[] = P.S;
// 繰越（2023・2024）の目名別
const car: any = {};
for (const n of m.nodes) {
  const kouId = m.kous[n[0]] as string; if (!kouId.includes(':general:') || (n[1] !== 2023 && n[1] !== 2024)) continue;
  if (codesOfMoku(n[3], 'general').use !== '1') continue;
  const c = mokuValue(n, 'carried'); if (!c) continue;
  (car[n[2]] ??= {})[n[1]] = (car[n[2]][n[1]] ?? 0) + c;
}
const ser = (r: any) => Y.map(y => oku(r?.[y]));
const minRows = Object.entries(P.byMin.general).map(([n, r]: any) => ({ n, v: ser(r) }));
const nameRows = Object.entries(P.byName.general).map(([n, r]: any) => ({ n, v: ser(r) }));
const acctRows = Object.entries(P.byAcct).map(([n, r]: any) => ({ n, v: ser(r) }));
const out = {
  Y, S,
  gen: ser(P.tot.general), spe: ser(P.tot.special), all: ser(P.allUse.general),
  min: minRows, name: nameRows, acct: acctRows,
  def: (() => { const def: any = {}; for (const n of m.nodes) { const kouId = m.kous[n[0]] as string; if (!kouId.includes(':general:')) continue; if (codesOfMoku(n[3], 'general').use !== '1') continue; const k = kouById.get(kouId); if (!k || lifecycleGroupsOf(k)[0] !== '防衛省') continue; const b = mokuValue(n, 'budget'); if (b === null) continue; (def[n[2]] ??= {})[n[1]] = (def[n[2]][n[1]] ?? 0) + b; } return Object.entries(def).map(([n, r]: any) => ({ n, v: ser(r) })); })(),
  settle: S.map(y => ({ y, tou: oku(P.tot.general[y]), ann: Math.round(V2[y]['歳出予算額'] / 1e8), carIn: Math.round(V2[y]['前年度繰越額'] / 1e8), res: Math.round(V2[y]['予備費使用額'] / 1e8), ryu: Math.round(V2[y]['流用等増△減額'] / 1e8), cur: Math.round(V2[y]['歳出予算現額'] / 1e8), spent: Math.round(V2[y]['支出済歳出額'] / 1e8), car: Math.round(V2[y]['翌年度繰越額'] / 1e8), un: Math.round(V2[y]['不用額'] / 1e8) })),
  minUnused: (() => { const mins = new Set(Object.keys(P.settleMin).map((k: string) => k.split('|')[0])); return [...mins].map(mn => { const s = (key: string) => S.reduce((a, y) => a + (P.settleMin[`${mn}|${key}`]?.[y] ?? 0), 0); return { n: mn, cur: oku(s('current')), un: oku(s('unused')) }; }).filter(r => (r.cur ?? 0) > 0).sort((a, b) => (b.un ?? 0) - (a.un ?? 0)); })(),
  carried: Object.entries(car).map(([n, r]: any) => ({ n, y23: oku(r[2023] ?? 0), y24: oku(r[2024] ?? 0) })).sort((a, b) => b.y23 + b.y24 - a.y23 - a.y24).slice(0, 6),
};
writeFileSync(DIR + 'data.json', JSON.stringify(out));
console.log(JSON.stringify(out.settle)); console.log(JSON.stringify(out.carried));
const sumCar23 = Object.values(car).reduce((a: number, r: any) => a + (r[2023] ?? 0), 0) as number;
const ret23 = (car['退職手当']?.[2023] ?? 0);
console.log('2023 繰越 計', oku(sumCar23), 'うち退職手当', oku(ret23));
