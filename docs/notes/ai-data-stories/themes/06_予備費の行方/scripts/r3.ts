// 予備費だけで財源ができた目（歳出予算現額 = 予備費使用額。当初・繰越・流用・移替なし）で、支出・翌年度繰越・不用を見る
import { readFileSync, writeFileSync } from 'node:fs';
import { readCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const ROOT = '/Users/igomuni/orca/nihon-no-yosan/';
const dir = (y: number) => (y <= 2022 ? ROOT + 'data/dataset/mof-history-v0/mof-archive/' : ROOT + 'data/dataset/reference-v0/mof-archive/') + y + '/';
const out: any = {};
for (const y of [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
  const rows = readCsv(readFileSync(dir(y) + 'moku-general-kessan.csv', 'utf8'));
  const col = (p: string) => Object.keys(rows[0]!).find(k => k.startsWith(p))!;
  const n = (r: any, p: string) => Number(r[col(p)] || 0);
  let cnt = 0, res = 0, sp = 0, co = 0, un = 0, allUse = 0, allCnt = 0; const big: any[] = [];
  for (const r of rows) {
    const u = n(r, '予備費使用額'); if (u <= 0) continue; allUse += u; allCnt++;
    if (n(r, '歳出予算現額') !== u) continue; // 予備費だけが財源
    cnt++; res += u; sp += n(r, '支出済'); co += n(r, '翌年度繰越'); un += n(r, '不用額');
    big.push({ kou: r['項名'], moku: r['目名'], ministry: r['所管'], u, sp: n(r, '支出済'), co: n(r, '翌年度繰越'), un: n(r, '不用額') });
  }
  big.sort((a, b) => b.u - a.u);
  out[y] = { cnt, allCnt, res, allUse, sp, co, un, top: big.slice(0, 6) };
  const t = (x: number) => (x / 1e12).toFixed(3);
  console.log(y, `予備費だけの目 ${cnt}/${allCnt}  ${t(res)}/${t(allUse)}兆  支出 ${t(sp)} 繰越 ${t(co)} 不用 ${t(un)}  (支出 ${(sp / res * 100).toFixed(1)}% 繰越 ${(co / res * 100).toFixed(1)}% 不用 ${(un / res * 100).toFixed(1)}%)`, '恒等式', sp + co + un === res ? 'OK' : 'NG');
  for (const b of big.slice(0, 3)) console.log('   ', b.ministry, b.kou, '/', b.moku, t(b.u), '支出', t(b.sp), '繰越', t(b.co), '不用', t(b.un));
}
writeFileSync('r3.json', JSON.stringify(out));
