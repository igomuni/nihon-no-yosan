// 判定できない候補: 当初に無く（政府案が無いか 0）、補正で 0.1兆円以上が足された目で、名前で基金系と判定できないもの
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue, MOKU_FLAG, codesOfMoku, codeNameOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
import { classify } from './f1.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const m = rd('moku.json.gz'), codes = rd('codes.json.gz');
const out: any[] = []; const byYear: Record<number, { n: number; supp: number }> = {};
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:') || n[1] < 2017 || n[1] > 2026) continue;
  if (classify(n[2]) || n[13] & MOKU_FLAG.requestOnly) continue;
  const b = mokuValue(n, 'budget'), r = mokuValue(n, 'revised'); if (r === null || (b ?? 0) !== 0) continue;
  if (r < 1e8) continue; // 0.1兆円 = 1億千円
  if (!/(補助金|交付金)$/.test(n[2])) continue;
  const major = codesOfMoku(n[3], 'general').major;
  out.push({ year: n[1], name: n[2], kou: id.split('|').pop(), supp: r, major: codeNameOf(codes, 'major', major, n[1], 'general')?.name ?? major });
  (byYear[n[1]] ??= { n: 0, supp: 0 }).n++; byYear[n[1]]!.supp += r;
}
out.sort((a, b) => b.supp - a.supp);
console.log(JSON.stringify(Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, `${v.n}目 ${(v.supp / 1e9).toFixed(2)}兆`]))));
console.log('合計', (out.reduce((s, x) => s + x.supp, 0) / 1e9).toFixed(2), out.length);
out.slice(0, 20).forEach(x => console.log(x.year, (x.supp / 1e9).toFixed(3), x.kou, '/', x.name, '|', x.major));
writeFileSync('f3.json', JSON.stringify({ byYear, list: out }));
