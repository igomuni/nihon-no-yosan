/**
 * 目・事項の分類コード（主要経費別・使途別）の名前と、選択肢。純粋な関数。仕様: docs/guides/budget-codes.md、docs/guides/lifecycle-moku.md
 *
 * コードの意味は年度・帳票で変わる（`budget-codes.md`）ので、名前は、その年度の当初予算のコード表のページ（一般会計 `11001`・特別会計 `12001`）から引く。
 * そのページが無い年度（FY2026 の当初予算、概算要求だけの FY2027 など）は、年度の近いページの名前を使う（`approx` = true）。
 */
import type { LifecycleKou } from './lifecycle.ts';

/** 画面用のコード表（`lifecycle/codes.json.gz`）: コード表のページごとの、主要経費別・使途別の区分 */
export interface LifecycleCodeTables {
  pages: { year: number; form: string; major: [code: string, name: string][]; use: [code: string, name: string][] }[];
}

export type CodeAxis = 'major' | 'use';
export const CODE_AXIS_LABEL: Record<CodeAxis, string> = { major: '主要経費別', use: '使途別' };

/** 目のコード（`LifecycleMokuNode` の分類コード、`|` つなぎ）から、主要経費別・使途別を取り出す。一般会計は 主要経費別|目的別|財政法|経済性質別|使途別、特別会計は 主要経費別|目的別|経済性質別|使途別。無ければ空 */
export function codesOfMoku(codes: string, account: LifecycleKou['account']): { major: string; use: string } {
  const cs = codes === '' ? [] : codes.split('|');
  return { major: cs[0] ?? '', use: (account === 'general' ? cs[4] : cs[3]) ?? '' };
}

const FORM_OF: Record<LifecycleKou['account'], string> = { general: '11001', special: '12001' };

/** コードの名前。その年度の当初予算のページに無ければ、年度の近い当初予算のページ（同じ年度なら、前の年度を先に）から引く。見つからなければ null */
export function codeNameOf(t: LifecycleCodeTables, axis: CodeAxis, code: string, year: number, account: LifecycleKou['account']): { name: string; approx: boolean } | null {
  const pages = t.pages.filter(p => p.form === FORM_OF[account]).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || a.year - b.year);
  for (const p of pages) {
    const name = new Map(p[axis]).get(code);
    if (name !== undefined) return { name, approx: p.year !== year };
  }
  return null;
}
