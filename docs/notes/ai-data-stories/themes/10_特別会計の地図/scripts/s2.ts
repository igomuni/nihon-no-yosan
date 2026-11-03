// 項の内訳（国債整理基金・財政投融資）と、目の名前の「繰入」
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleValues, lifecycleRowAmounts, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const t = (x?: number) => x === undefined ? '-' : (x / 1e12).toFixed(2);
for (const sa of ['国債整理基金', '財政投融資']) {
  const r = new Map<string, Record<number, number>>();
  d.kous.forEach((k: any, i: number) => { if (k.account !== 'special' || k.specialAccount !== sa || ![2017, 2020, 2021, 2022, 2026].includes(k.year)) return; const b = lifecycleRowAmounts(lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived'))).budget; if (b === undefined) return; const key = `${k.subAccount}|${k.name}`; (r.get(key) ?? r.set(key, {}).get(key)!)[k.year] = ((r.get(key)![k.year]) ?? 0) + b; });
  console.log('\n==', sa, '2017 2020 2021 2022 2026');
  [...r].sort((a, b) => (b[1][2021] ?? 0) - (a[1][2021] ?? 0)).slice(0, 10).forEach(([n, v]) => console.log(n, [2017, 2020, 2021, 2022, 2026].map(y => t(v[y])).join(' ')));
}
// 目の名前の繰入（2026）: 会計別に、繰入先の文字列ごと
for (const y of [2017, 2026]) {
  const r = new Map<string, number>();
  for (const n of m.nodes) { if (n[1] !== y) continue; const name = n[2] as string; if (!/繰入|繰り入れ/.test(name)) continue; const v = mokuValue(n, 'budget'); if (v === null || v === 0) continue; const id = m.kous[n[0]] as string; const acct = id.split(':')[1] === 'general' ? '一般' : id.split(':')[2].split('|')[0]; const to = (name.match(/([^\s　、]+?(特別会計|勘定|一般会計|基金))へ繰入/)?.[1] ?? '(先不明)'); const key = `${acct} → ${to}`; r.set(key, (r.get(key) ?? 0) + v * 1000); }
  console.log(`\n== ${y} 目名に「繰入」（上位 25）, 計`, t([...r.values()].reduce((a, b) => a + b, 0)));
  [...r].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(k, t(v)));
}
