/**
 * 補正予算の追加額と、翌年度の概算要求の額が近い項の一覧を CSV で出力する。仕様: docs/guides/supp-request-pairs.md
 *
 * 使い方: node packages/pipeline/src/build/supp-request-pairs-cli.ts <lifecycle-cli.ts の出力ディレクトリ> <出力 CSV>
 * 入力: `kou.csv`、`events.csv`、`links.csv`（過去年度のデータセットを付けて作ったもの）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readCsv, suppRequestPairs } from '@nihon-no-yosan/core';

const [lifecycleDir, outFile] = process.argv.slice(2);
if (!lifecycleDir || !outFile) throw new Error('usage: supp-request-pairs-cli.ts <lifecycleDir> <out.csv>');

const read = (name: string) => readCsv(fs.readFileSync(path.join(lifecycleDir, name), 'utf8'));
const pairs = suppRequestPairs(read('kou.csv'), read('events.csv'), read('links.csv'));

const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const yes = (b: boolean): string => (b ? 'はい' : '');
const header = [
  '補正の年度', '会計', '所管', '組織', '特別会計', '勘定', '項コード', '項名',
  '補正追加額(円)', '翌年度の要求額(円)', '翌年度の要求書の前年度予算額(円)', '翌年度の要求増額(円)', '一致した値', '完全一致', '補正追加額の差(%)(一致した値に対して)',
  '補正年度の当初予算(円)', '翌年度の当初予算(円)', '翌年度の補正追加額(円)',
  '要求額が翌年度の前年度予算額に±5%で近い', '要求額が補正年度の当初予算に±5%で近い', '補正追加額が補正年度の当初予算に±5%で近い', '補正年度の当初予算が0',
  '要求額と補正後予算の差(%)', '分類', '補正年度のkou_id', '翌年度のkou_id',
];
const rows = pairs.map(p => [
  p.year, p.kou.account, p.kou.ministry, p.kou.org, p.kou.special_account, p.kou.sub_account, p.kou.code, p.kou.name,
  p.suppAdd, p.request, p.requestPrev, p.requestIncrease, p.match, p.exact ? '完全一致' : '', p.diffPct,
  p.budget, p.nextBudget, p.nextSuppAdd,
  yes(p.requestNearPrev), yes(p.requestNearBudget), yes(p.suppNearBudget), yes(p.budgetZero),
  p.requestVsRevisedPct, p.class, p.kou.kou_id, p.nextKouId,
]);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n');
const byClass = new Map<string, number>();
for (const p of pairs) byClass.set(p.class, (byClass.get(p.class) ?? 0) + 1);
console.log(`${pairs.length} 項`, Object.fromEntries(byClass));
