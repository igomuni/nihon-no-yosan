// RS（行政事業レビュー 2025 年度版）の同じ交付金の事業の、予算・執行と、予算書の項へのつなぎ
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
const d = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/rs/jigyo.json.gz')).toString());
console.log('columns', JSON.stringify(d.columns));
const out: any = {};
for (const idx of [52, 53, 4453]) {
  const j = d.jigyo[idx];
  const am = d.amounts.filter((a: any) => a[0] === idx);
  const ln = d.links.filter((l: any) => l[0] === idx).map((l: any) => [l[1], d.kous[l[2]], ...l.slice(3)]);
  out[j[0]] = { name: j[1], ministry: j[2], bureau: j[3], amounts: am, links: ln };
  console.log(j[0], j[1]); for (const a of am) console.log('  ', JSON.stringify(a)); for (const l of ln) console.log('  link', JSON.stringify(l));
}
writeFileSync('s4.json', JSON.stringify(out, null, 1));
