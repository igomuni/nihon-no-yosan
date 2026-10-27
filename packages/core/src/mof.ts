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

/**
 * 要求書の目のコード（原文）を、予算書の分類コード（目の識別に使う `|` つなぎ）に直す。仕様: docs/guides/budget-codes.md
 * 一般会計: `95016-2111-02-0000` → 主要経費別 `95`・目的別 `016`・財政法公債金 `2`・経済性質別 `11`・使途別 `1`（`95|016|2|11|1`）。
 * 特別会計は財政法が無い。中央の桁は、経済性質別 2 桁 + 使途別 1 桁（`815` → `81|5`）、経済性質別が `00` のときは使途別 1 桁だけ（`9` → `00|9`）。
 * 形が合わないもの（桁数が違う、複数のコードが並ぶ原文を除く）は、補わず null。複数のコードが「、」で並ぶときは最初のもの。末尾の 2 つ（目別・細目）は返さない（目別は `mofMokuCode` の後半）。
 */
export function reqMokuClassCodes(raw: string, account: 'general' | 'special'): string | null {
  const p = (raw.split('、')[0] ?? '').split(/[-‑]/);
  if (p.length !== 4) return null;
  const [a, b] = p as [string, string, string, string];
  if (!/^\d{5}$/.test(a) || !/^\d+$/.test(b)) return null;
  const head = [a.slice(0, 2), a.slice(2)];
  if (account === 'general') return b.length === 4 ? [...head, b.slice(0, 1), b.slice(1, 3), b.slice(3)].join('|') : null;
  if (b.length === 3) return [...head, b.slice(0, 2), b.slice(2)].join('|');
  if (b.length === 1) return [...head, '00', b].join('|');
  return null;
}

/** 要求書の目のコード（原文。例: `95016-2111-02-0000`）から、`mofMokuCode` と同じ形を取る。複数のコードが「、」で並ぶときは最初のもの */
export const reqMokuCode = (s: string): string => {
  const p = (s.split('、')[0] ?? '').split('-');
  return p.length >= 3 ? `${p[0]}-${p[2]}` : '';
};
