// 事項要求: 概算要求書のテキスト（PDF から取り出したもの）で「（事項要求）」と注記された行。行の名前（項・事項・目の名前）で、府省ごとに重複を除く
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { publisherOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const OUT = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t2-request/';
const BR = '/Users/igomuni/orca/nihon-no-yosan/data/dataset/reference-v0/budget-request/';
const MARK = /（\s*事\s*項\s*要\s*求\s*）/;
const res: any = {};
for (const y of [2023, 2024, 2025, 2026, 2027]) {
  const dir = BR + y + '/plain-text/';
  const per = new Map<string, { marks: number; names: Map<string, number>; withAmount: number }>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.txt')) continue;
    const lines = readFileSync(dir + f, 'utf8').split('\n');
    for (const line of lines) {
      if (!MARK.test(line)) continue;
      const pub = publisherOf('https://' + f.split('__')[0]);
      const p = per.get(pub) ?? per.set(pub, { marks: 0, names: new Map(), withAmount: 0 }).get(pub)!;
      p.marks++;
      const before = line.split(MARK)[0]!;
      if (/\d{1,3}(,\d{3})+|\b\d+\b\s*$/.test(before.replace(/^\s*\d{2,4}\s/, ''))) p.withAmount++;
      const name = before.replace(/[\d,△▲\-‑]+/g, ' ').replace(/[ 　]+/g, '').replace(/[（）()]/g, '');
      if (name) p.names.set(name, (p.names.get(name) ?? 0) + 1);
    }
  }
  res[y] = [...per].map(([p, v]) => ({ pub: p, marks: v.marks, withAmount: v.withAmount, names: [...v.names.keys()] })).sort((a, b) => b.names.length - a.names.length);
  const tot = res[y].reduce((s: number, r: any) => s + r.marks, 0), nn = res[y].reduce((s: number, r: any) => s + r.names.length, 0);
  console.log(`\n== ${y} 注記のある行 ${tot}、名前（府省内で重複を除く）${nn}、府省 ${res[y].length}`);
  for (const r of res[y].slice(0, 9)) console.log(r.pub.padEnd(10), '行', r.marks, '名前', r.names.length, '額あり', r.withAmount, '|', r.names.slice(0, 4).join(' / '));
}
writeFileSync(OUT + 'a3.json', JSON.stringify(res));
