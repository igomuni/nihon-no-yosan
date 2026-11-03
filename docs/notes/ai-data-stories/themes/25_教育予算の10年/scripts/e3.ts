import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const t = (x: number) => +(x / 1e9).toFixed(3);
const EDU = ['11', '14', '15', '16'];
const S: Record<number, number> = {}, top: Record<number, any[]> = {}, GI: Record<number, number> = {};
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:')) continue;
  const c = codesOfMoku(n[3], 'general').major; const y = n[1]; const kou = id.split('|').pop()!;
  if (n[6] === null) continue; const d = n[6] - (n[5] ?? 0);
  if (/情報機器整備|情報通信ネットワーク環境施設整備/.test(n[2])) GI[y] = (GI[y] ?? 0) + d;
  if (!EDU.includes(c)) continue;
  S[y] = (S[y] ?? 0) + d; (top[y] ??= []).push({ kou, moku: n[2], c, d });
}
console.log('教育 4 区分の補正（改予算額 − 当初）', JSON.stringify(Object.fromEntries(Object.entries(S).map(([y, v]) => [y, t(v)]))));
console.log('情報機器・ネットワーク（コード 13 を含む）', JSON.stringify(Object.fromEntries(Object.entries(GI).map(([y, v]) => [y, t(v)]))));
for (const y of Object.keys(top)) console.log(y, top[+y].sort((a, b) => b.d - a.d).slice(0, 3).map(x => `${x.moku} ${t(x.d)}`).join(' ; '));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r5e-education/e3.json', JSON.stringify({ S, GI, top: Object.fromEntries(Object.entries(top).map(([y, a]) => [y, a.sort((p, q) => q.d - p.d).slice(0, 5)])) }));
