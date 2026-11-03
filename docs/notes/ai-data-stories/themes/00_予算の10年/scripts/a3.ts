import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { codesOfMoku, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const t = (x: number) => (x / 1e9).toFixed(2);
const sel = (major: string, years: number[]) => { const r = new Map<string, Record<number, number>>(); for (const n of m.nodes) { const id = m.kous[n[0]] as string; if (!id.includes(':general:') || !years.includes(n[1])) continue; const v = mokuValue(n, 'budget'); if (v === null) continue; if (codesOfMoku(n[3], 'general').major !== major) continue; const kou = id.split('|').pop()!; const key = `${kou} / ${n[2]}`; (r.get(key) ?? r.set(key, {}).get(key)!)[n[1]] = ((r.get(key)![n[1]]) ?? 0) + v; } return r; };
for (const [major, ys] of [['35', [2022, 2023, 2024]], ['20', [2017, 2026]], ['05', [2017, 2026]]] as const) {
  console.log('\n== major', major, ys.join('/'));
  const r = sel(major, [...ys]);
  [...r].sort((a, b) => Math.abs((b[1][ys[1]] ?? 0) - (b[1][ys[0]] ?? 0)) - Math.abs((a[1][ys[1]] ?? 0) - (a[1][ys[0]] ?? 0))).slice(0, 6).forEach(([k, v]) => console.log(k, ys.map(y => t(v[y] ?? 0)).join(' → ')));
}
