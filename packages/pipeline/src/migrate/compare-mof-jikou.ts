/**
 * 財務省の予算書【XML版】から作り直した事項の CSV（FY2023・FY2024）を、基準データの `mof-archive/{年度}/jikou-{general,special}.csv` と、バイト単位で比べる。
 * 過去年度の事項を作る処理（`build/mof-jikou.ts`）が、基準データを作った処理と同じ出力になることの確認。
 *
 * 使い方: node packages/pipeline/src/migrate/compare-mof-jikou.ts <基準データのディレクトリ> <アーカイブの置き場> <結果の JSON>
 * - アーカイブの置き場は、`{年度}/{年度}/html/{帳票}menu.html` と `…/xml/` を持つ（前のリポジトリの `data/download/mof.go.jp/archive`）。
 * - 1 つでも違えば、一覧を出して終了コード 1。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildJikou, documentIdOf, type JikouAccount } from '../build/mof-jikou.ts';

const [dataset, archive, resultPath] = process.argv.slice(2);
if (!dataset || !archive || !resultPath) throw new Error('usage: compare-mof-jikou.ts <dataset> <archive> <result.json>');
const results: Record<string, { records: number; equal: boolean }> = {};
const problems: string[] = [];
for (const year of [2023, 2024]) {
  for (const account of ['general', 'special'] as JikouAccount[]) {
    const root = path.join(archive, String(year), String(year));
    const doc = documentIdOf(year, account);
    const built = buildJikou({ year, account, xmlDir: path.join(root, 'xml'), menuPath: path.join(root, 'html', `${doc}menu.html`) });
    const ref = fs.readFileSync(path.join(dataset, 'mof-archive', String(year), `jikou-${account}.csv`));
    const equal = Buffer.from(built.csv).equals(ref);
    results[`${year}/jikou-${account}.csv`] = { records: built.record.records, equal };
    if (!equal) problems.push(`${year}/jikou-${account}.csv`);
  }
}
fs.writeFileSync(resultPath, JSON.stringify({ comparedWith: 'data/dataset/reference-v0/mof-archive/{年度}/jikou-*.csv', files: results, allEqual: problems.length === 0 }, null, 1) + '\n');
console.log(problems.length === 0 ? 'all equal' : `DIFFERENT:\n${problems.join('\n')}`);
if (problems.length) process.exit(1);
