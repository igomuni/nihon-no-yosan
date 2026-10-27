/**
 * 予算書の「(参考) コード番号について」のページ（予算書【XML版】）から、分類コードの表を取り出す。純粋な関数。仕様: docs/guides/budget-codes.md
 *
 * ページは、帳票（当初予算の一般会計・特別会計、補正予算、決算）ごとにあり、コードの意味は年度・帳票で変わる（所管のデジタル庁・防災庁、予備費、恩給の細目など）。
 * そのため、ページごとに表を持つ。ページの XML は、`<clm>` の表のセルにコードと名称（名称は、行の幅で複数の `<l>` に折り返される）を持つ。
 */

/** 表の 1 区分（`(イ)` 所管、`(ハ)` 主要経費別分類 など）。`items` はコードと名称。コードの一覧でない区分（`(ロ)` 項の説明など）は `items` が空 */
export interface CodeTableSection {
  /** 見出しの記号（`イ`・`ロ`・`ハ`…。ページごとに、並びが違う（特別会計は財政法の区分が無い）） */
  mark: string;
  /** 区分の名前（`所管`・`主要経費別分類`・`目的別分類`・`財政法公債金対象非対象別分類`・`経済性質別分類`・`使途別分類`・`目別分類` など） */
  title: string;
  items: [code: string, name: string][];
}

/** 1 ページ（1 つの XML）の表 */
export interface CodeTablePage {
  /** 予算書の年度（ファイル名の先頭 4 桁。令和8年度 = 2026） */
  year: number;
  /** 帳票の番号（ファイル名の 5〜9 桁目。`11001` = 当初予算の一般会計） */
  form: string;
  /** XML のファイル名 */
  file: string;
  /** XML のバイト列の SHA-256 */
  sha256: string;
  sections: CodeTableSection[];
}

/** 帳票の番号の先頭 2 桁 → 名前（`docs/guides/mof-history.md`。`13`・`23`・`76` の政府関係機関は読まない） */
export const CODE_TABLE_FORM_NAMES: Record<string, string> = {
  '11': '当初予算 一般会計',
  '12': '当初予算 特別会計',
  '21': '補正予算 一般会計',
  '22': '補正予算 特別会計',
  '77': '決算 一般会計',
  '78': '決算 特別会計',
};

/** ファイル名（`202411001001135a.xml`）から、年度と帳票の番号 */
export function codeTableFileInfo(file: string): { year: number; form: string } {
  const m = /^(\d{4})(\d{5})\d+a\.xml$/.exec(file);
  if (!m) throw new Error(`予算書の XML のファイル名でない: ${file}`);
  return { year: Number(m[1]), form: m[2]! };
}

const MARK = /^[（(]([イロハニホヘトチリヌ])[）)]$/;
const CODE = /^\d{1,3}$/;

interface Token {
  /** 表のセルか、セルの外の 1 行か */
  cell: boolean;
  text: string;
}

/** `<l>` の中身を文字にする（CDATA・数字の `<qt/>` などの印を外す） */
const textOf = (xml: string): string => xml.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, '');

/** XML を、文書の順に、表のセル（折り返した行を結ぶ）とセルの外の行に分ける */
function tokensOf(xml: string): Token[] {
  const out: Token[] = [];
  for (const m of xml.matchAll(/<clm\b[^>]*>([\s\S]*?)<\/clm>|<l>([\s\S]*?)<\/l>/g)) {
    if (m[1] !== undefined) {
      const lines = [...m[1].matchAll(/<l>([\s\S]*?)<\/l>/g)].map(l => textOf(l[1]!));
      out.push({ cell: true, text: lines.join('') });
    } else out.push({ cell: false, text: textOf(m[2]!) });
  }
  return out;
}

/**
 * 「(参考) コード番号について」のページの XML（文字に直したもの）から、区分ごとの表を取り出す。このページでなければ null。
 * 区分は、`(イ)` などの見出しと、次の見出しで区切る。コードの表は、コードのセルと名称のセルが並ぶ間（コードでないものが来たら終わり）。
 * コードの後に名称のセルが無い、同じ区分でコードが重なる、のときは、捨てずにエラーにする。
 */
export function parseCodeNumberPage(xml: string): CodeTableSection[] | null {
  const tokens = tokensOf(xml);
  if (!tokens.slice(0, 80).some(t => t.text.includes('コード番号について')) && !tokens.slice(0, 80).some(t => t.text.includes('コード番号'))) return null;
  const sections: CodeTableSection[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const m = MARK.exec(tokens[i]!.text);
    const title = tokens[i + 1]?.text ?? '';
    if (!m || title === '' || CODE.test(title) || title.length >= 40) continue;
    const section: CodeTableSection = { mark: m[1]!, title, items: [] };
    let j = i + 2;
    while (j < tokens.length && tokens[j]!.cell && CODE.test(tokens[j]!.text)) {
      const name = tokens[j + 1];
      if (!name || !name.cell) throw new Error(`コードの後に名称のセルが無い: ${section.title} ${tokens[j]!.text}`);
      if (section.items.some(([c]) => c === tokens[j]!.text)) throw new Error(`同じ区分でコードが重なる: ${section.title} ${tokens[j]!.text}`);
      section.items.push([tokens[j]!.text, name.text]);
      j += 2;
    }
    sections.push(section);
    i = j - 1;
  }
  return sections.some(s => s.title === '主要経費別分類' && s.items.length > 0) ? sections : null;
}

/** 区分の名前 → コード → 名称。ページの区分のうち、コードの表があるもの */
export const codeTableOf = (page: CodeTablePage, title: string): Map<string, string> | null => {
  const s = page.sections.find(x => x.title === title && x.items.length > 0);
  return s ? new Map(s.items) : null;
};

/** ある年度・帳票のコードの名称。ページ・区分・コードが無ければ null（推測しない） */
export function codeName(pages: readonly CodeTablePage[], year: number, form: string, title: string, code: string): string | null {
  const page = pages.find(p => p.year === year && p.form === form);
  return (page && codeTableOf(page, title)?.get(code)) ?? null;
}

/**
 * 区分（`title`）のコードの名称が、ページの並び（年度・帳票の順）でどう変わるか。名称が変わった、増えた、無くなったコードだけ。
 * 並びは、`pages` を（年度, 帳票の番号, ファイル名）で並べた順。ページにそのコードが無いときの名称は null（そのページの表に無い）。
 * 帳票の種類で名称が違う（当初予算と補正で、予備費のコードの意味が違う）ので、見たい帳票の番号の前方一致（`formPrefix`。例: `11` = 当初予算の一般会計）で、ページを絞る。
 */
export function codeNameChanges(pages: readonly CodeTablePage[], title: string, formPrefix = ''): { code: string; history: { year: number; form: string; name: string | null }[] }[] {
  const sorted = [...pages].filter(p => p.form.startsWith(formPrefix) && codeTableOf(p, title)).sort((a, b) => a.year - b.year || a.form.localeCompare(b.form) || a.file.localeCompare(b.file));
  const codes = [...new Set(sorted.flatMap(p => [...codeTableOf(p, title)!.keys()]))].sort();
  const out: { code: string; history: { year: number; form: string; name: string | null }[] }[] = [];
  for (const code of codes) {
    const history: { year: number; form: string; name: string | null }[] = [];
    for (const p of sorted) {
      const name = codeTableOf(p, title)!.get(code) ?? null;
      if (history.length === 0 || history[history.length - 1]!.name !== name) history.push({ year: p.year, form: p.form, name });
    }
    if (history.length > 1) out.push({ code, history });
  }
  return out;
}
