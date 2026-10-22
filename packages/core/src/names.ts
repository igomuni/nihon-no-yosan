/**
 * 名前の表記の揃え方。仕様: docs/guides/names.md
 *
 * 概算要求書（PDF から取った文字）と予算書（財務省の CSV・XML）の名前を比べるときに使う。
 * 揃えるのは幅と、確かめた PDF の外字だけ。それ以外の正規化・読み替えはしない。
 */

/**
 * 概算要求書の PDF の外字（私用領域のコード）→ 字。予算書の同じ名前で字を確かめたものだけを置く。
 * - U+E5E3 → 填: 貨幣交換差減補[E5E3]金 / 償還差額補[E5E3]金 / …減収補[E5E3]特例交付金（予算書は「補填」）
 */
export const PDF_GAIJI: Readonly<Record<string, string>> = { '\uE5E3': '填' };

/** 幅の統一: 全角の ASCII 相当（U+FF01〜FF5E）を ASCII に、半角のカナ・約物（U+FF61〜FF9F）を NFKC で全角に。PDF の外字は PDF_GAIJI で字にする。それ以外の互換文字は変えない */
export const fold = (s: string): string =>
  s
    .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF61-\uFF9F]+/g, m => m.normalize('NFKC'))
    .replace(/[\uE000-\uF8FF]/g, c => PDF_GAIJI[c] ?? c);

/** 名前の比較キー: 幅の統一のあと、空白（半角・全角）を除く */
export const nameKey = (s: string | undefined): string => fold(s ?? '').replace(/[\s\u3000]+/g, '');

/** コードの区切りのハイフン類（U+2010〜2015, U+2212, U+FF0D, '-'）を '-' に揃える。名前には使わない */
export const normalizeCodeHyphen = (s: string): string => s.replace(/[\u2010-\u2015\u2212\uFF0D]/g, '-');
