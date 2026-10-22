/**
 * CSV の読み取りと、金額の文字の読み取り。仕様: docs/guides/budget-request-tree.md
 *
 * 基準データの CSV（UTF-8、先頭の BOM は任意、引用符は RFC 4180）を、ヘッダの列名 → 値の行にする。
 */

/** CSV の 1 行（列名 → 値）。値は原文の文字列のまま */
export type Rec = Record<string, string>;

/** CSV の文字列を行と列に分ける。引用符の中の改行・カンマ・`""` を扱う。`\r` は捨てる */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV の文字列を、ヘッダの列名で引ける行にする。空行は捨てる。列の足りない行は空文字で埋める */
export function readCsv(text: string): Rec[] {
  const [header = [], ...rest] = parseCsv(text.replace(/^\uFEFF/, ''));
  return rest
    .filter(r => r.length > 1 || (r[0] ?? '') !== '')
    .map(r => Object.fromEntries(header.map((k, i) => [k, r[i] ?? ''])));
}

/** 金額の文字を数にする: `△1,234` → -1234、`1,234` → 1234。空欄と、数字でないものは null（0 にしない） */
export function amount(s: string | undefined): number | null {
  const t = (s ?? '').replace(/[\s,]/g, '');
  if (t === '') return null;
  const neg = t.startsWith('△');
  const body = neg ? t.slice(1) : t;
  if (!/^\d+$/.test(body)) return null;
  return neg ? -Number(body) : Number(body);
}
