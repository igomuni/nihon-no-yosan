// 会計間の繰入を目の名前で分類し、純計を試算する
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const s1 = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2e-special/s1.json', 'utf8'));
const Y: number[] = s1.Y;
const ACCTS = ['国債整理基金', '交付税及び譲与税配付金', '年金', '財政投融資', 'エネルギー対策', '労働保険', '子ども・子育て支援', '外国為替資金', '食料安定供給', '東日本大震災復興', '自動車安全', '国有林野事業債務管理', '特許', '地震再保険'].sort((a, b) => b.length - a.length);
const re = new RegExp(`(${ACCTS.join('|')})特別会計`, 'g');
type Kind = 'g2s' | 's2g' | 's2s' | 'intra' | 'other';
const sum: Record<number, Record<Kind, number>> = {}; const flows = new Map<string, Record<number, number>>(); const other = new Map<string, number>();
for (const n of m.nodes) {
  const y = n[1]; if (!Y.includes(y)) continue;
  const name = n[2] as string; if (!/繰入/.test(name)) continue;
  const v = mokuValue(n, 'budget'); if (v === null || v === 0) continue;
  const id = m.kous[n[0]] as string; const [, account, rest] = id.split(':'); const from = account === 'general' ? '一般会計' : rest!.split('|')[0]!;
  const hits = [...name.matchAll(re)]; const to = hits.length ? hits[hits.length - 1]![1]! : /一般会計へ繰入/.test(name) ? '一般会計' : /勘定へ繰入/.test(name) ? from : null;
  let kind: Kind;
  if (to === null) kind = 'other';
  else if (from === '一般会計') kind = to === '一般会計' ? 'other' : 'g2s';
  else if (to === '一般会計') kind = 's2g';
  else if (to === from) kind = 'intra';
  else kind = 's2s';
  const yen = v * 1000;
  (sum[y] ??= { g2s: 0, s2g: 0, s2s: 0, intra: 0, other: 0 })[kind] += yen;
  if (kind === 'other') { if (y === 2026) other.set(`${from} / ${name}`, (other.get(`${from} / ${name}`) ?? 0) + yen); continue; }
  const key = `${from}→${to}`; (flows.get(key) ?? flows.set(key, {}).get(key)!)[y] = ((flows.get(key)![y]) ?? 0) + yen;
}
const t = (x?: number) => x === undefined ? '-' : (x / 1e12).toFixed(2);
console.log('年度 一般 特別 単純合計 | 一般→特別 特別→一般 特別→特別 勘定間 | 除いた計 試算純計 | 繰入だが会計間でない');
const net: Record<number, any> = {};
for (const y of Y) { const s = sum[y]!; const g = s1.gen[y], sp = s1.tot[y]; const ded = s.g2s + s.s2g + s.s2s + s.intra; net[y] = { g, sp, gross: g + sp, ...s, ded, net: g + sp - ded }; console.log(y, t(g), t(sp), t(g + sp), '|', t(s.g2s), t(s.s2g), t(s.s2s), t(s.intra), '|', t(ded), t(g + sp - ded), '|', t(s.other)); }
console.log('\n流れ（2017 → 2026、0.3兆円以上）');
[...flows].filter(([, r]) => Math.max(r[2017] ?? 0, r[2026] ?? 0) >= 3e11).sort((a, b) => (b[1][2026] ?? 0) - (a[1][2026] ?? 0)).forEach(([k, r]) => console.log(k, Y.map(y => t(r[y])).join(' ')));
console.log('\n「繰入」だが会計間とみなさなかった目（2026、上位）');
[...other].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(k, t(v)));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2e-special/s3.json', JSON.stringify({ net, flows: [...flows], other: [...other] }));
