/**
 * テスト用の実物の頁の一部を、基準データの plain text から組み立てる。原文は git に入れない。
 * 基準データ（`data/dataset/reference-v0/`）が無い環境では `hasDataset` が false になるので、使うテストは飛ばす。
 *
 * 仕様の形（`*.excerpts.json`）: `{ "<ファイル名>.txt": [{ file, page, lines, year? }] }`。`file` は plain text の slug 付きファイル名、
 * `page` は 1 始まり、`lines` は 0 始まりの行の範囲 `"a-b"` か行の配列、`year` は省略すると 2024。
 * 各頁は選んだ行を `\n` でつなぎ、`\n\f` を付ける（頁の末尾の改行より後ろの空要素は行ではない）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.join(process.cwd(), 'data/dataset/reference-v0/budget-request');
export const hasDataset = fs.existsSync(path.join(root, '2024/plain-text'));

type Lines = string | number[];
export type Excerpt = { file: string; page: number; lines: Lines; year?: number };

const lineIndexes = (l: Lines): number[] => {
  if (typeof l !== 'string') return l;
  const [a, b] = l.split('-').map(Number) as [number, number];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
};

/** 基準データが無いときは空文字を返す（使うテストは `describe.skipIf(!hasDataset)` で飛ばすが、describe の本体は集める段階で動くため） */
export const excerptText = (specs: Record<string, Excerpt[]>, name: string): string => {
  if (!hasDataset) return '';
  const list = specs[name];
  if (!list) throw new Error(`no excerpt spec: ${name}`);
  return list
    .map(e => {
      const text = fs.readFileSync(path.join(root, String(e.year ?? 2024), 'plain-text', e.file), 'utf8');
      const lines = text.split('\f')[e.page - 1]!.split('\n').slice(0, -1);
      return `${lineIndexes(e.lines).filter(i => i < lines.length).map(i => lines[i]).join('\n')}\n\f`;
    })
    .join('');
};
