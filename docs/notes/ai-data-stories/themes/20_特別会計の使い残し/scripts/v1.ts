// 検算: 画面用の目のデータ（lifecycle/moku.json.gz）から、特別会計の決算を年度ごとに足す（CSV の項の合計と比べる）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const m = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/moku.json.gz')).toString());
const out: Record<number, Record<string, number>> = {};
for (const n of m.nodes) {
  const y = n[1]; if (y < 2017 || y > 2024) continue;
  if (!(m.kous[n[0]] as string).includes(':special:')) continue;
  const o = (out[y] ??= { current: 0, spent: 0, carried: 0, unused: 0 });
  for (const k of ['current', 'spent', 'carried', 'unused'] as const) { const v = mokuValue(n, k); if (v !== null) o[k] += v; }
}
for (const y of Object.keys(out)) console.log(y, Object.entries(out[+y]).map(([k, v]) => `${k} ${(v / 1e9).toFixed(3)}`).join(' '));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r4e-special-unused/v1.json', JSON.stringify(out));
