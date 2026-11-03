// 別の方法での検算: 原本に近い CSV（kou-general-kessan.csv、円）を直接足して、画面用データの合計と比べる
import { readFileSync, existsSync } from 'node:fs';
import { readCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const s1 = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t1-lifecycle/s1.json', 'utf8'));
const D = '/Users/igomuni/orca/nihon-no-yosan/data/dataset/';
const COLS: [string, string][] = [['歳出予算額', 'appropriation'], ['前年度繰越額', 'carryover_in'], ['歳出予算現額', 'current_amount'], ['支出済歳出額', 'spent'], ['翌年度繰越額', 'carryover_out'], ['不用額', 'unused']];
for (const y of [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
  const f = [`${D}reference-v0/mof-archive/${y}/kou-general-kessan.csv`, `${D}mof-history-v0/mof-archive/${y}/kou-general-kessan.csv`].find(existsSync)!;
  const rows = readCsv(readFileSync(f, 'utf8'));
  const hdr = Object.keys(rows[0]!);
  const line = COLS.map(([jp, key]) => {
    const col = hdr.find(h => h.startsWith(jp + '('))!;
    const sum = rows.reduce((a, r) => a + Number(r[col]), 0);
    return `${jp} ${(sum / 1e12).toFixed(3)} 差 ${sum - s1.tot[y][key]}`;
  });
  console.log(y, f.includes('reference') ? 'ref' : 'hist', rows.length, '行 |', line.join(' | '));
}
