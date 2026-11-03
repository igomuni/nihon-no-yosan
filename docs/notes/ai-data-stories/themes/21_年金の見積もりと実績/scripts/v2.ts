// 検算 2: 画面用データ（moku.json.gz）と core の mokuValue で、基礎年金給付費の当初・支出済・不用を出す
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const m = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/moku.json.gz')).toString());
for (const y of [2017, 2020, 2023, 2024]) {
  const n = m.nodes.filter((x: any) => x[1] === y && (m.kous[x[0]] as string).includes(':special:年金|基礎年金勘定|') && x[2] === '基礎年金給付費');
  const s = (k: any) => n.reduce((a: number, x: any) => a + (mokuValue(x, k) ?? 0), 0) / 1e9;
  console.log(y, n.length, '当初', s('budget').toFixed(2), '支出', s('spent').toFixed(2), '不用', s('unused').toFixed(2));
}
