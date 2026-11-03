// 検算: 項の決算 CSV（kou-general-kessan.csv）の予備費使用額の合計で、目の集計と比べる。予備費の項の恒等式も見る
import { readFileSync } from 'node:fs';
import { readCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const ROOT = '/Users/igomuni/orca/nihon-no-yosan/';
const o = JSON.parse(readFileSync('r1.json', 'utf8'));
const dir = (y: number) => (y <= 2022 ? ROOT + 'data/dataset/mof-history-v0/mof-archive/' : ROOT + 'data/dataset/reference-v0/mof-archive/') + y + '/';
for (const y of [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
  const rows = readCsv(readFileSync(dir(y) + 'kou-general-kessan.csv', 'utf8'));
  const c = Object.keys(rows[0]!).find(k => k.startsWith('予備費使用額'))!;
  let pos = 0, neg = 0, posKou = 0, mixed = 0;
  for (const r of rows) { const v = Number(r[c] || 0); if (v > 0) { pos += v; posKou++; } if (v < 0) { neg += v; if (!/予備費$/.test(r['項名']!)) mixed++; } }
  const m = o[y];
  const ok = pos === m.pos && neg === m.neg;
  // 予備費の項: 歳出予算額 − 使用 = 現額、現額 = 不用（支出・繰越 0）
  const id = m.reserves.every((x: any) => x.budget + x.used + x.move + x.trans === x.current && x.current === x.spent + x.carried + x.unused);
  console.log(y, '項CSV +', pos, '−', neg, '| 目の集計と', ok ? '一致' : `不一致 (${m.pos}, ${m.neg})`, '| 使った項', posKou, '| 予備費以外のマイナス項', mixed, '| 予備費の項の恒等式', id ? '成立' : '不成立');
}
