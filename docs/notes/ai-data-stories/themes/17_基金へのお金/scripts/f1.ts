// 基金系の目（一般会計、FY2017〜FY2026）: 当初（政府案）と補正（補正後 − 当初）を、区分・府省・主要経費別に集計
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, codeNameOf, mokuValue, lifecycleGroupsOf, MOKU_FLAG } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz'), codes = rd('codes.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

/** 判定の規則（目名）。上から順に当てる */
export function classify(name: string): 'fund' | 'invest' | 'reserve' | null {
  if (/特別会計へ繰入|運営費交付金|分担金|拠出金|給付費負担金|事務局|国際交流基金|年金基金/.test(name)) return null;
  if (/基金/.test(name) || /造成費(補助金|交付金)/.test(name)) return 'fund';
  if (/出資金/.test(name)) return 'invest';
  if (/資金へ繰入/.test(name)) return 'reserve';
  return null;
}
type Row = { year: number; name: string; kou: string; group: string; major: string; majorName: string; cls: string; budget: number | null; revised: number | null; supp: number | null; flags: number };
const rows: Row[] = [];
const MAIN = import.meta.url === `file://${process.argv[1]}`;
let unknownSupp = 0;
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string;
  if (!id.includes(':general:') || !Y.includes(n[1])) continue;
  const cls = classify(n[2]); if (!cls) continue;
  if (n[13] & MOKU_FLAG.requestOnly) continue; // 概算要求書にだけある目は除く
  const k = kouById.get(id);
  const budget = mokuValue(n, 'budget'), revised = mokuValue(n, 'revised');
  const supp = revised === null ? null : revised - (budget ?? 0);
  if (revised === null && (n[13] & (MOKU_FLAG.suppAggregated | MOKU_FLAG.suppKouOnly))) unknownSupp++;
  const major = codesOfMoku(n[3], 'general').major;
  rows.push({ year: n[1], name: n[2], kou: k?.name ?? id, group: k ? lifecycleGroupsOf(k)[0]! : '?', major, majorName: major ? codeNameOf(codes, 'major', major, n[1], 'general')?.name ?? major : '（コードなし）', cls, budget, revised, supp, flags: n[13] });
}
if (MAIN) {
const t = (x: number) => (x / 1e9).toFixed(3);
const sum = (rs: Row[], k: 'budget' | 'supp') => rs.reduce((s, r) => s + (r[k] ?? 0), 0);
console.log('rows', rows.length, '補正が外N目などで分からない目', unknownSupp);
for (const c of ['fund', 'invest', 'reserve']) {
  console.log(`\n== ${c} 当初 / 補正（兆円）`);
  console.log(Y.map(y => { const rs = rows.filter(r => r.cls === c && r.year === y); return `${y}: ${t(sum(rs, 'budget'))} / ${t(sum(rs, 'supp'))}`; }).join('\n'));
}
writeFileSync('f1.json', JSON.stringify(rows));
}
