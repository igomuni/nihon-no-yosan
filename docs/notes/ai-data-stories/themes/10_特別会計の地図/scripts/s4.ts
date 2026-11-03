// 検算: 使途別「他会計へ繰入」（コード 6）の合計と、名前で分類した繰入を比べる。国債整理基金の償還と利子の推移
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue, codesOfMoku } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const s3 = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2e-special/s3.json', 'utf8'));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const u6: Record<string, Record<number, number>> = { general: {}, special: {} }; const u6nameless: Record<number, number> = {}; const ex = new Map<string, number>();
const debt: Record<string, Record<number, number>> = { 償還: {}, 利子: {} };
for (const n of m.nodes) {
  const y = n[1]; if (!Y.includes(y)) continue; const v = mokuValue(n, 'budget'); if (v === null) continue;
  const id = m.kous[n[0]] as string; const acct = id.split(':')[1] as 'general' | 'special';
  if (codesOfMoku(n[3], acct).use === '6') { u6[acct][y] = (u6[acct][y] ?? 0) + v * 1000; if (!/繰入/.test(n[2])) { u6nameless[y] = (u6nameless[y] ?? 0) + v * 1000; if (y === 2026) ex.set(`${id.split(':')[2].split('|')[0]} / ${n[2]}`, v * 1000); } }
  if (id.includes(':special:国債整理基金')) { if (n[2] === '債務償還費') debt['償還']![y] = (debt['償還']![y] ?? 0) + v * 1000; if (n[2] === '利子及割引料') debt['利子']![y] = (debt['利子']![y] ?? 0) + v * 1000; }
}
const t = (x?: number) => x === undefined ? '-' : (x / 1e12).toFixed(2);
console.log('年度 | 一般: 使途6 / 名前 g2s | 特別: 使途6 / 名前 s2g+s2s+intra | 使途6 で名前に繰入が無い計');
for (const y of Y) { const n = s3.net[y]; console.log(y, '|', t(u6.general[y]), '/', t(n.g2s), '|', t(u6.special[y]), '/', t(n.s2g + n.s2s + n.intra), '|', t(u6nameless[y])); }
console.log('\n使途 6 で名前に「繰入」が無い目（2026）'); [...ex].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => console.log(k, t(v)));
console.log('\n国債整理基金 債務償還費 / 利子及割引料（兆円）'); for (const y of Y) console.log(y, t(debt['償還']![y]), t(debt['利子']![y]));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2e-special/s4.json', JSON.stringify({ u6, debt }));
