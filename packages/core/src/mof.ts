/**
 * 財務省の予算書（項・事項・目の CSV）の列の読み方と、項の鍵。仕様: docs/guides/keys-and-pairing.md
 */
import { amount, type Rec } from './csv.ts';
import { nameKey } from './names.ts';

/** 会計の種類（予算書の CSV のファイルの別）。政府関係機関は扱わない */
export type Account = 'general' | 'special';

const col = (r: Rec, pred: (k: string) => boolean): string => {
  const k = Object.keys(r).find(pred);
  return k ? (r[k] ?? '') : '';
};

/** 項の行の本年度の額（千円）: `令和N年度要求額` / `予定額` で始まり `の合計` で終わる列 */
export const mofAmountKou = (r: Rec): number | null => amount(col(r, k => /^令和.*年度(要求額|予定額).*の合計$/.test(k)));
/** 事項の行の本年度の額（千円）: `令和N年度要求額` / `予定額` で始まる最初の列 */
export const mofAmountJikou = (r: Rec): number | null => amount(col(r, k => /^令和.*年度(要求額|予定額)/.test(k)));
/** 目の行の本年度の額（千円）: `令和N年度要求額` / `予定額`（`(千円)` は任意）の列 */
export const mofAmountMoku = (r: Rec): number | null =>
  amount(col(r, k => /^令和.*年度(要求額|予定額)(\(千円\))?$/.test(k)));

/**
 * 予算書の項の鍵: 一般会計は 所管|組織|項コード|項名、特別会計は 特別会計|勘定|項コード|項名（名前は `nameKey` で揃える）。
 * 1 つの版の項の CSV で一意。事項・目の行も同じ列を持つので、同じ鍵で項に結ぶ
 */
export const mofKouKey = (r: Rec, a: Account): string =>
  (a === 'general'
    ? [nameKey(r['所管']), nameKey(r['組織']), r['項コード'] ?? '', nameKey(r['項名'])]
    : [nameKey(r['特別会計']), nameKey(r['勘定']), r['項コード'] ?? '', nameKey(r['項名'])]
  ).join('|');

/** 予算書の項を名前で探す鍵（項コードを含まない）: 一般会計は 所管|組織|項名、特別会計は 特別会計|勘定|項名。同じ鍵の項が複数あり得る */
export const mofKouNameKey = (r: Rec, a: Account): string =>
  (a === 'general'
    ? [nameKey(r['所管']), nameKey(r['組織']), nameKey(r['項名'])]
    : [nameKey(r['特別会計']), nameKey(r['勘定']), nameKey(r['項名'])]
  ).join('|');

/**
 * 予算書の目のコード: 主要経費別分類＋目的別分類-目別分類（例: `95016-02`）。中段（財政法・経済性質・使途）は、
 * 特別会計の要求書の原文と予算書とで桁の取り方が違う（要求書 `65061-9-18`、予算書は財政法の列が無い）ので使わない。並べる位置と表示にだけ使う
 */
export const mofMokuCode = (r: Rec): string =>
  `${r['主要経費別分類コード'] ?? ''}${r['目的別分類コード'] ?? ''}-${r['目別分類コード'] ?? ''}`;

/** 要求書の目のコード（原文。例: `95016-2111-02-0000`）から、`mofMokuCode` と同じ形を取る。複数のコードが「、」で並ぶときは最初のもの */
export const reqMokuCode = (s: string): string => {
  const p = (s.split('、')[0] ?? '').split('-');
  return p.length >= 3 ? `${p[0]}-${p[2]}` : '';
};
