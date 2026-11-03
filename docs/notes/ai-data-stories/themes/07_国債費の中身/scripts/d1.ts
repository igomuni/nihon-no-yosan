// 国債整理基金特別会計の目（当初・補正後・決算）と、各会計から国債整理基金への繰入（当初）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const M = ['budget', 'revised', 'current', 'spent', 'carried', 'unused'] as const;
// 1) 国債整理基金の目
const fund: Record<string, Record<number, Record<string, number | null>>> = {};
const fundKou: Record<string, Set<string>> = {};
// 2) 国債整理基金への繰入（目名に「国債整理基金特別会計へ繰入」を含む、または 一般会計の国債費の目）
const inflow: Record<string, Record<number, number>> = {};
for (const n of m.nodes) {
  const y = n[1]; if (!Y.includes(y)) continue;
  const kid = m.kous[n[0]] as string; const k = kouById.get(kid); if (!k) continue;
  if (k.account === 'special' && k.specialAccount === '国債整理基金') {
    const key = `${k.name}｜${n[2]}${n[4] ? '｜' + n[4] : ''}`;
    (fundKou[k.name] ??= new Set()).add(n[2]);
    const r = ((fund[key] ??= {})[y] ??= {});
    for (const c of M) { const v = mokuValue(n, c); if (v !== null) r[c] = ((r[c] as number) ?? 0) + v; else if (!(c in r)) r[c] = null; }
    continue;
  }
  const name = n[2] as string;
  if (/国債整理基金特別会計へ繰入/.test(name) || /国債整理基金特別会計へ繰入/.test(k.name)) {
    const v = mokuValue(n, 'budget'); if (v === null) continue;
    const src = k.account === 'general' ? `一般会計｜${k.name}` : `${k.specialAccount}特別会計｜${k.subAccount || '-'}`;
    (inflow[src] ??= {})[y] = ((inflow[src][y]) ?? 0) + v;
  }
}
const t = (x: number | null | undefined) => x === null || x === undefined ? '   -  ' : (x / 1e9).toFixed(2).padStart(6);
console.log('== 国債整理基金特会の目（当初、兆円）');
for (const [key, r] of Object.entries(fund).sort((a, b) => ((b[1][2026]?.budget as number) ?? 0) - ((a[1][2026]?.budget as number) ?? 0))) console.log(key.padEnd(40), Y.map(y => t(r[y]?.budget as number)).join(' '));
console.log('\n== 国債整理基金への繰入（当初、兆円、出し手別）');
for (const [key, r] of Object.entries(inflow).sort((a, b) => (b[1][2026] ?? 0) - (a[1][2026] ?? 0))) console.log(key.padEnd(46), Y.map(y => t(r[y])).join(' '));
const inTot = Y.map(y => Object.values(inflow).reduce((s, r) => s + (r[y] ?? 0), 0));
console.log('繰入合計'.padEnd(46), inTot.map(v => t(v)).join(' '));
writeFileSync('d1.json', JSON.stringify({ Y, fund, inflow }));
