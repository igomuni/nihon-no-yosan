// 判定できない候補: 補正で大きく足された目のうち、名前に基金・出資金が無く、独法・機構・法人などあての補助・交付・運営費交付金
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue, MOKU_FLAG } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
import { classify } from './f1.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const m = JSON.parse(gunzipSync(readFileSync(L + 'moku.json.gz')).toString());
const out: any[] = []; const byYear: Record<number, { n: number; supp: number }> = {};
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:') || n[1] < 2017 || n[1] > 2026) continue;
  if (classify(n[2]) || n[13] & MOKU_FLAG.requestOnly) continue;
  const b = mokuValue(n, 'budget'), r = mokuValue(n, 'revised'); if (r === null) continue;
  const s = r - (b ?? 0); if (s < 1e7) continue; // 100億円以上
  if (!/(機構|法人|協会|財団|振興会|事業団|センター)/.test(n[2]) || !/(補助金|交付金|事業費)/.test(n[2])) continue;
  out.push({ year: n[1], name: n[2], kou: id.split('|').pop(), supp: s, budget: b });
  (byYear[n[1]] ??= { n: 0, supp: 0 }).n++; byYear[n[1]]!.supp += s;
}
out.sort((a, b) => b.supp - a.supp);
console.log(JSON.stringify(Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, `${v.n}目 ${(v.supp / 1e9).toFixed(2)}兆`]))));
out.slice(0, 25).forEach(x => console.log(x.year, (x.supp / 1e9).toFixed(3), x.kou, '/', x.name, 'budget', x.budget === null ? 'null' : (x.budget / 1e9).toFixed(3)));
writeFileSync('f2.json', JSON.stringify({ byYear, top: out.slice(0, 40) }));
