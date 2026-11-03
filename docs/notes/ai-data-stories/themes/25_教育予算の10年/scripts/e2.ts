import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const t = (x: number) => +(x / 1e9).toFixed(3);
const EDU = ['11', '14', '15', '16'];
const supp: Record<number, any[]> = {}; const pair: Record<number, { r: number; b: number; n: number }> = {};
const info: any[] = [];
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:')) continue;
  const c = codesOfMoku(n[3], 'general').major; const y = n[1]; const kou = id.split('|').pop()!;
  if (/情報機器|端末|GIGA|ICT/.test(n[2])) info.push({ y, kou, moku: n[2], c, b: n[5], s: n[7] });
  if (!EDU.includes(c)) continue;
  if (n[7]) (supp[y] ??= []).push({ kou, moku: n[2], c, s: n[7] });
  if (n[12] !== null && n[5] !== null) { const p = (pair[y] ??= { r: 0, b: 0, n: 0 }); p.r += n[12]; p.b += n[5]; p.n++; }
}
for (const y of Object.keys(supp)) { const a = supp[+y].sort((x, z) => Math.abs(z.s) - Math.abs(x.s)); console.log(y, '補正 上位', a.slice(0, 4).map(x => `${x.kou}/${x.moku} ${t(x.s)}`).join(' ; ')); }
console.log('要求と政府案（両方ある目）', JSON.stringify(Object.fromEntries(Object.entries(pair).map(([y, p]) => [y, { req: t(p.r), bud: t(p.b), d: t(p.b - p.r), n: p.n }]))));
console.log('情報機器等', info.filter(x => x.b || x.s).map(x => `${x.y} ${x.kou}/${x.moku} c${x.c} b${x.b === null ? '-' : t(x.b)} s${x.s === null ? '-' : t(x.s)}`).join('\n'));
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r5e-education/e2.json', JSON.stringify({ supp: Object.fromEntries(Object.entries(supp).map(([y, a]) => [y, a.slice(0, 6)])), pair, info }));
