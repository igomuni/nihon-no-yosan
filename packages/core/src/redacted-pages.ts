/**
 * 概算要求書の黒塗り頁を見つける部品。純粋な関数。仕様: docs/guides/redacted-pages.md
 *
 * 見つけ方: 頁を低解像度の画像（グレー）にして、黒い面（`window` の大きさの窓が、すべて暗い画素）の画素の数を数える。文字や罫線は、細いので窓が埋まらない。
 * 黒く塗りつぶされた四角（備考欄の説明や金額を隠したもの）だけが数えられる。灰色の網掛け、小さな塗りつぶしは、数えない。
 */

export interface SolidDark {
  /** 窓がすべて暗い位置の数（黒い面積の目安） */
  count: number;
  /** その位置を囲む四角（画像の画素。x0, y0, x1, y1） */
  bbox: [number, number, number, number] | null;
}

export const SOLID_DARK = { dark: 50, windowRows: 3, windowCols: 9 } as const;

/** グレー画像（1 画素 1 バイト、行ごと）から、黒い面を数える */
export function solidDark(gray: Uint8Array, width: number, height: number, opts: { dark: number; windowRows: number; windowCols: number } = SOLID_DARK): SolidDark {
  const { dark, windowRows: wr, windowCols: wc } = opts;
  if (height < wr || width < wc) return { count: 0, bbox: null };
  // 積分画像（暗い画素の数）
  const w1 = width + 1;
  const integral = new Int32Array((height + 1) * w1);
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x]! < dark ? 1 : 0;
      integral[(y + 1) * w1 + x + 1] = integral[y * w1 + x + 1]! + row;
    }
  }
  let count = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y + wr <= height; y++) {
    for (let x = 0; x + wc <= width; x++) {
      const s = integral[(y + wr) * w1 + x + wc]! - integral[y * w1 + x + wc]! - integral[(y + wr) * w1 + x]! + integral[y * w1 + x]!;
      if (s === wr * wc) {
        count++;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x + wc > x1) x1 = x + wc;
        if (y + wr > y1) y1 = y + wr;
      }
    }
  }
  return { count, bbox: count === 0 ? null : [x0, y0, x1, y1] };
}

/** 頁を「黒塗りあり」とする、黒い面の大きさ（窓の数）の下限 */
export const REDACTED_MIN = 150;

/** 項の開始頁の行（概算要求の項の表 `kou.csv` の 1 行から、頁に関する列だけ） */
export interface KouPageRow {
  organization: string;
  itemName: string;
  itemCode: string;
  /** 項の開始頁（PDF の通し頁） */
  startPage: number;
  /** 開始頁の根拠: `項`（明細表の項の行から）/ `頁ラベル` / `推定` */
  basis: string;
  /** 開始頁を推定した頁に、文字層が無いとき true */
  imagePage: boolean;
}

export type PageKouMatch =
  | { kind: 'range'; rows: KouPageRow[]; nextStart: number | null }
  | { kind: 'estimated'; rows: KouPageRow[]; nextStart: number | null }
  | { kind: 'none'; rows: []; nextStart: number | null };

/**
 * 頁が属する項。同じ書の項を開始頁の順に並べ、頁以下で最も大きい開始頁の項（同じ開始頁の項が複数あれば、すべて）。
 * 開始頁の根拠が `項` で、文字層がある頁から決めたものは `range`、推定や画像頁は `estimated`。書の最初の項より前の頁、項の無い書は `none`。
 */
export function kouOfPage(rows: readonly KouPageRow[], page: number): PageKouMatch {
  const sorted = [...rows].sort((a, b) => a.startPage - b.startPage);
  const before = sorted.filter(r => r.startPage <= page);
  const after = sorted.filter(r => r.startPage > page);
  const nextStart = after.length > 0 ? after[0]!.startPage : null;
  if (before.length === 0) return { kind: 'none', rows: [], nextStart };
  const top = before[before.length - 1]!.startPage;
  const hit = before.filter(r => r.startPage === top);
  const sure = hit.every(r => r.basis === '項' && !r.imagePage);
  return { kind: sure ? 'range' : 'estimated', rows: hit, nextStart };
}
