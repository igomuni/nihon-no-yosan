import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
for (const y of [2017, 2026]) {
  let s = 0, fz = 0;
  for (const n of m.nodes) { if (n[1] !== y) continue; const id = m.kous[n[0]] as string; const acct = id.split(':')[1]; const cs = (n[3] as string).split('|'); const econ = acct === 'general' ? cs[3] : cs[2]; const v = mokuValue(n, 'budget'); if (v === null) continue;
    if (econ && +econ >= 80 && +econ <= 86) s += v; if (acct === 'special' && id.includes('財政投融資') && y === 2017) fz += v; }
  console.log(y, '対地方', (s / 1e9).toFixed(2));
}
let f21 = 0; for (const n of m.nodes) { if (n[1] === 2021 && (m.kous[n[0]] as string).includes(':special:財政投融資')) { const v = mokuValue(n, 'budget'); if (v) f21 += v; } }
console.log('財投 2021 当初', (f21 / 1e9).toFixed(2));
