/**
 * 財務省の予算書【XML版】の補正予算（一般会計 `{年}21xxx` の「組織別事項別内訳」、特別会計 `{年}22xxx` の「歳出事項別内訳」）から、事項ごとの補正の額を読む。
 * 仕様: docs/guides/mof-history.md。当初予算の parser（`mof-xml.ts`）と同じ作法で、想定外の構造は例外にして止まる（読み飛ばさない）。説明欄は読まない。
 *
 * 1 つの 項 は、次のどちらか:
 * - 事項の行が続く: 項の行は、事項が 1 つだけのとき名前だけ（額は事項の行）、複数のとき小計の額を持つ（小計は、事項の合計と一致するか確かめて数える）
 * - 事項の行が無い: 項の行が額を持つ（補正の無い項。「項のみ」の行にする）
 * 額は千円で、成立予算額・追加額・修正減少額・差引額・改予算額の 5 つ。
 */
import { createHash } from 'node:crypto';
import { children, CELL_ID, deepText, isEl, MofXmlParseError, readCell, readXml, type El, type Tx } from './mof-xml.ts';

export const HOSEI_GENERAL_TITLE = '〔組織別事項別内訳〕';
export const HOSEI_SPECIAL_TITLE = '歳出事項別内訳';
export interface HoseiSpec { documentId: string; doctype: string; yearLabel: string }
export type HoseiAmounts = { enacted: number; add: number; reduce: number; net: number; revised: number };
export interface HoseiRecord {
  file: string; row: string; page: number;
  ministry: string; specialAccount: string; subAccount: string; organization: string;
  itemCode: string; itemName: string; matterName: string; classCode: string;
  kind: 'matter' | 'item-only';
  amounts: HoseiAmounts;
}
export type HoseiOutcome =
  | { status: 'not_target'; file: string; titleForList: string }
  | { status: 'recognized'; file: string; sourceSha256: string; records: HoseiRecord[]; counts: Record<string, number>; layout: string };

const AMOUNT = /^(0|(△ )?[1-9]\d{0,2}(,\d{3})*)$/;
const amountOf = (raw: string, what: string, file: string): number => {
  if (!AMOUNT.test(raw)) throw new MofXmlParseError('amount', file, `金額が文法外 ${what}: ${JSON.stringify(raw)}`);
  const n = Number(raw.replace(/[△ ,]/g, ''));
  return raw.startsWith('△') ? -n : n;
};
const sameAmounts = (a: HoseiAmounts, b: HoseiAmounts): boolean => a.enacted === b.enacted && a.add === b.add && a.reduce === b.reduce && a.net === b.net && a.revised === b.revised;
const sum = (xs: HoseiAmounts[]): HoseiAmounts => xs.reduce((t, x) => ({ enacted: t.enacted + x.enacted, add: t.add + x.add, reduce: t.reduce + x.reduce, net: t.net + x.net, revised: t.revised + x.revised }), { enacted: 0, add: 0, reduce: 0, net: 0, revised: 0 });

interface Row { key: string; page: number; rowNo: number; cells: Map<string, El> }
const colOrder = (a: string, b: string): number => { const [x, y] = [a, b].map(s => s.split('.').map(Number)); return x![0]! - y![0]! || x![1]! - y![1]!; };

/** XML を読んで、表（1 つ以上）の見出しを検査し、行にまとめる。見出しは `expectedHeaders`（`行.列: 文字`）と完全に一致すること。年度の文字は `N年度` に直して比べる */
function readTables(doc: { root: El }, file: string, expected: Record<string, string>, yearLabel: string): Row[] {
  const tables = children(doc.root, 'body').flatMap(b => children(b, 'table'));
  if (tables.length < 1) throw new MofXmlParseError('table_structure', file, '最上位の table がない');
  const want = JSON.stringify(Object.entries(expected).sort(([a], [b]) => colOrder(a, b)));
  for (const table of tables) {
    const headers = children(table, 'header');
    if (headers.length < 1) throw new MofXmlParseError('table_structure', file, 'header がない');
    // 表が途中で分かれて見出しが繰り返されるファイルがあるため、見出しは 1 つ以上で、すべてが同じ
    for (const h of headers) {
      const got: Record<string, string> = {};
      for (const c of children(h, 'clm')) {
        const m = CELL_ID.exec(c.attrs.id ?? '');
        if (!m) throw new MofXmlParseError('table_structure', file, `header の id 形式外: ${c.attrs.id}`);
        got[`${m[3]}.${m[4]}`] = readCell(c, file).text.replace(/\s+/g, '').split(yearLabel).join('N年度');
      }
      if (JSON.stringify(Object.entries(got).sort(([a], [b]) => colOrder(a, b))) !== want) throw new MofXmlParseError('table_structure', file, `header が想定と一致しない: ${JSON.stringify(got)}`);
    }
  }
  const rows: Row[] = [];
  const byKey = new Map<string, Row>();
  for (const table of tables) for (const d of children(table, 'data')) for (const c of children(d, 'clm')) {
    const m = CELL_ID.exec(c.attrs.id ?? '');
    if (!m) throw new MofXmlParseError('table_structure', file, `clm id 形式外: ${c.attrs.id}`);
    const key = `p${m[1]}-${m[2]}.${m[3]}`;
    let r = byKey.get(key);
    if (!r) { r = { key, page: Number(m[1]), rowNo: Number(m[2]), cells: new Map() }; byKey.set(key, r); rows.push(r); }
    const col = `${m[4]}.${m[5]}`;
    if (r.cells.has(col)) throw new MofXmlParseError('table_structure', file, `同一行・同一列に複数セル ${key} ${col}`);
    r.cells.set(col, c);
  }
  rows.forEach((r, i) => { if (i > 0 && !(r.page > rows[i - 1]!.page || (r.page === rows[i - 1]!.page && r.rowNo > rows[i - 1]!.rowNo))) throw new MofXmlParseError('order', file, '文書順が (頁,行) の昇順でない'); });
  return rows;
}

const hasTable = (e: El): boolean => e.kids.some(k => isEl(k) && (k.name === 'table' || hasTable(k)));

/** 行のセルの検査（説明欄以外は空でない単一の <p>。説明欄は読まない）と、型の判定 */
function classify(r: Row, classes: Record<string, string>, descCols: ReadonlySet<string>, file: string): string {
  const colSet = [...r.cells.keys()].sort(colOrder).join(',');
  const cls = classes[colSet];
  if (!cls) throw new MofXmlParseError('unknown_row', file, `未知の行 ${r.key}: ${colSet}`);
  for (const [col, el] of r.cells) {
    if (descCols.has(col)) { if (!hasTable(el) && deepText(el).trim() === '') throw new MofXmlParseError('cell_content', file, `空の説明 ${r.key}`); }
    else if (readCell(el, file).text === '') throw new MofXmlParseError('cell_content', file, `空セルを持つ行 ${r.key} 列${col}`);
  }
  return cls;
}

interface Pending { code: string; name: string; page: number; row: string; amounts: HoseiAmounts | null; matters: { rec: HoseiRecord }[] }

/** 項ごとの終わりの処理: 事項の行が無ければ項のみの行にし、小計があれば事項の合計と照合して数える */
function finishItem(p: Pending | null, base: Omit<HoseiRecord, 'itemCode' | 'itemName' | 'matterName' | 'classCode' | 'kind' | 'amounts' | 'row' | 'page'>, out: HoseiRecord[], counts: Record<string, number>, file: string): void {
  if (!p) return;
  if (p.matters.length === 0) {
    if (!p.amounts) throw new MofXmlParseError('orphan', file, `項に事項の行も額も無い ${p.code}`);
    out.push({ ...base, file, row: p.row, page: p.page, itemCode: p.code, itemName: p.name, matterName: '', classCode: '', kind: 'item-only', amounts: p.amounts });
    counts['item-only']!++;
    return;
  }
  for (const m of p.matters) out.push(m.rec);
  if (p.amounts) {
    counts['subtotal']!++;
    if (!sameAmounts(p.amounts, sum(p.matters.map(m => m.rec.amounts)))) counts['subtotal-mismatch']!++;
  }
}

// ================================================================ 一般会計
const G_CLASSES: Record<string, string> = {
  '1.1,3.2,4.1,5.1,6.1,7.2': 'org',
  '1.3,2.1,3.2,4.1,5.1,6.1,7.2': 'item',
  '1.3,2.1': 'item-name',
  '1.4,2.2,3.2,4.1,5.1,6.1,7.2': 'matter',
  '1.4,2.2,3.2,4.1,5.1,6.1,7.2,8.1': 'matter',
  '8.1': 'description',
};
const G_HEADER = (): Record<string, string> => ({ '1.1': '組織・項・事項', '1.3': 'N年度', '1.4': '補正要求', '1.7': '改N年度', '1.8': '説明', '2.3': '成立予算額', '2.4': '追加額', '2.5': '修正減少額', '2.6': '差引額', '2.7': '予算額', '3.3': '(千円)', '3.4': '(千円)', '3.5': '(千円)', '3.6': '(千円)', '3.7': '(千円)' });

export function parseHoseiGeneralFile(input: { filename: string; bytes: Uint8Array; menuChain: string[] | undefined; spec: HoseiSpec }): HoseiOutcome {
  const file = input.filename; const spec = input.spec;
  const sha = createHash('sha256').update(input.bytes).digest('hex');
  let text: string;
  try { text = new TextDecoder('shift_jis', { fatal: true }).decode(input.bytes); } catch { throw new MofXmlParseError('decode', file, 'Shift_JIS として decode できない'); }
  const doc = readXml(text, file);
  if (doc.root.name !== 'budget') throw new MofXmlParseError('input_contract', file, `root が budget でない: ${doc.root.name}`);
  if (doc.encoding !== 'Shift_JIS') throw new MofXmlParseError('input_contract', file, `encoding 宣言が Shift_JIS でない: ${doc.encoding}`);
  if (doc.doctype !== spec.doctype) throw new MofXmlParseError('input_contract', file, `DOCTYPE 不一致: ${doc.doctype}`);
  const titles = children(doc.root, 'title_for_list');
  if (titles.length !== 1) throw new MofXmlParseError('input_contract', file, 'title_for_list が 1 つでない');
  const title = titles[0]!.kids.filter((k): k is Tx => !isEl(k) && k.cdata).map(k => k.text).join('').replace(/\s+/g, '');
  if (title !== HOSEI_GENERAL_TITLE) return { status: 'not_target', file, titleForList: title };
  if (!input.menuChain) throw new MofXmlParseError('organization', file, '目次の祖先 chain が無い');
  const i = input.menuChain.indexOf('甲号予定経費補正要求書');
  if (i < 1) throw new MofXmlParseError('organization', file, `chain に「甲号予定経費補正要求書」の直前の要素が無い: ${input.menuChain.join(' > ')}`);
  const ministry = input.menuChain[i - 1]!.replace(/所管$/, '');

  const rows = readTables(doc, file, G_HEADER(), spec.yearLabel);
  const counts: Record<string, number> = { org: 0, item: 0, 'item-name': 0, matter: 0, description: 0, 'item-only': 0, subtotal: 0, 'subtotal-mismatch': 0 };
  const records: HoseiRecord[] = [];
  const seen = new Set<string>();
  let organization = '';
  let current: Pending | null = null;
  const base = (): Omit<HoseiRecord, 'itemCode' | 'itemName' | 'matterName' | 'classCode' | 'kind' | 'amounts' | 'row' | 'page' | 'file'> & { file: string } => ({ file, ministry, specialAccount: '', subAccount: '', organization });
  const baseOf = (): Parameters<typeof finishItem>[1] => { const b = base(); return { file: b.file, ministry: b.ministry, specialAccount: '', subAccount: '', organization: b.organization }; };
  const amountsOf = (r: Row, cols: [string, string, string, string, string]): HoseiAmounts => {
    const v = cols.map((c, k) => amountOf(readCell(r.cells.get(c)!, file).text, `列${c} ${['成立', '追加', '修正減少', '差引', '改'][k]} ${r.key}`, file));
    return { enacted: v[0]!, add: v[1]!, reduce: v[2]!, net: v[3]!, revised: v[4]! };
  };
  const G_AMOUNT_COLS: [string, string, string, string, string] = ['3.2', '4.1', '5.1', '6.1', '7.2'];
  const cell = (r: Row, c: string): string => readCell(r.cells.get(c)!, file).text;
  rows.forEach(r => {
    const cls = classify(r, G_CLASSES, new Set(['8.1']), file);
    counts[cls]!++;
    if (cls === 'description') return;
    if (cls === 'org') {
      finishItem(current, baseOf(), records, counts, file);
      current = null;
      organization = cell(r, '1.1');
      if (!input.menuChain!.includes(organization)) throw new MofXmlParseError('organization', file, `目次の祖先に組織が無い: ${organization}`);
      return;
    }
    if (!organization) throw new MofXmlParseError('organization', file, `組織の行より前に項・事項の行 ${r.key}`);
    if (cls === 'item' || cls === 'item-name') {
      finishItem(current, baseOf(), records, counts, file);
      const code = cell(r, '1.3');
      if (!/^\d{3}$/.test(code)) throw new MofXmlParseError('item_code', file, `項コードが 3 桁数字でない ${r.key}: ${code}`);
      const k = `${organization}|${code}`;
      if (seen.has(k)) throw new MofXmlParseError('item_code', file, `項コードが重複 ${k}`);
      seen.add(k);
      current = { code, name: cell(r, '2.1'), page: r.page, row: r.key, amounts: cls === 'item' ? amountsOf(r, G_AMOUNT_COLS) : null, matters: [] };
      return;
    }
    // matter
    if (!current) throw new MofXmlParseError('orphan', file, `事項行に項が無い ${r.key}`);
    const classCode = cell(r, '1.4');
    if (!/^\d{2}$/.test(classCode)) throw new MofXmlParseError('col4', file, `分類コードが 2 桁数字でない ${r.key}: ${classCode}`);
    current.matters.push({ rec: { ...baseOf(), row: r.key, page: r.page, itemCode: current.code, itemName: current.name, matterName: cell(r, '2.2'), classCode, kind: 'matter', amounts: amountsOf(r, G_AMOUNT_COLS) } });
  });
  finishItem(current, baseOf(), records, counts, file);
  if (records.length === 0) throw new MofXmlParseError('organization', file, '項・事項が得られない（データ行なし）');
  return { status: 'recognized', file, sourceSha256: sha, records, counts, layout: 'general' };
}

// ================================================================ 特別会計
const SP_HEADER = (org: boolean): Record<string, string> => ({ '1.1': org ? '所管・組織・項・事項' : '項・事項', '1.3': 'N年度成立予算額(千円)', '1.4': '補正予定', '1.9': '改N年度予定額(千円)', '1.10': '説明', '2.4': '追加額', '2.5': '(千円)', '2.6': '修正減少額(千円)', '2.7': '差引額', '2.8': '(千円)' });
const SP_AMOUNT = '3.1,4.1,6.1,7.1,9.1';
const SP_PLAIN: Record<string, string> = {
  [`1.1,2.1,${SP_AMOUNT}`]: 'item', [`1.4,2.1,${SP_AMOUNT}`]: 'item', '1.1,2.1': 'item-name', '1.4,2.1': 'item-name',
  [`1.2,2.2,${SP_AMOUNT}`]: 'matter', [`1.5,2.2,${SP_AMOUNT}`]: 'matter', [`1.2,2.2,${SP_AMOUNT},10.1`]: 'matter', [`1.5,2.2,${SP_AMOUNT},10.1`]: 'matter', '10.1': 'description',
};
const SP_ORG: Record<string, string> = {
  '1.1': 'ministry', [`1.1,${SP_AMOUNT}`]: 'ministry-total', '1.3': 'organization-name', [`1.3,${SP_AMOUNT}`]: 'organization',
  [`1.4,2.1,${SP_AMOUNT}`]: 'item', '1.4,2.1': 'item-name', [`1.5,2.2,${SP_AMOUNT}`]: 'matter', [`1.5,2.2,${SP_AMOUNT},10.1`]: 'matter', '10.1': 'description',
};

export function specialHoseiScopeFromChain(chain: readonly string[], file: string): { ministry: string; specialAccount: string; subAccount: string } {
  const MARK = '甲号歳入歳出予算補正予定計算書';
  const idx = chain.map((c, i) => (c === MARK ? i : -1)).filter(i => i >= 0);
  if (idx.length !== 1) throw new MofXmlParseError('organization', file, `chain に「${MARK}」が 1 つでない: ${chain.join(' > ')}`);
  const i = idx[0]!;
  if (!/^歳出\s*事項別内訳$/.test(chain[chain.length - 1]!)) throw new MofXmlParseError('organization', file, `chain の末尾が「歳出 事項別内訳」でない: ${chain.join(' > ')}`);
  if (i < 2 || !chain[i - 2]!.endsWith('所管')) throw new MofXmlParseError('organization', file, `chain に所管が無い: ${chain.join(' > ')}`);
  const sub = i + 1 < chain.length - 1 ? chain[i + 1]! : '';
  if (i + 2 < chain.length - 1) throw new MofXmlParseError('organization', file, `chain の勘定の後に余分な要素: ${chain.join(' > ')}`);
  return { ministry: chain[i - 2]!.replace(/所管$/, ''), specialAccount: chain[i - 1]!, subAccount: sub };
}

export function parseHoseiSpecialFile(input: { filename: string; bytes: Uint8Array; menuChain: string[] | undefined; spec: HoseiSpec }): HoseiOutcome {
  const file = input.filename; const spec = input.spec;
  const sha = createHash('sha256').update(input.bytes).digest('hex');
  let text: string;
  try { text = new TextDecoder('shift_jis', { fatal: true }).decode(input.bytes); } catch { throw new MofXmlParseError('decode', file, 'Shift_JIS として decode できない'); }
  const doc = readXml(text, file);
  if (doc.root.name !== 'budget') throw new MofXmlParseError('input_contract', file, `root が budget でない: ${doc.root.name}`);
  if (doc.encoding !== 'Shift_JIS') throw new MofXmlParseError('input_contract', file, `encoding 宣言が Shift_JIS でない: ${doc.encoding}`);
  if (doc.doctype !== spec.doctype) throw new MofXmlParseError('input_contract', file, `DOCTYPE 不一致: ${doc.doctype}`);
  const titles = children(doc.root, 'title_for_list');
  if (titles.length !== 1) throw new MofXmlParseError('input_contract', file, 'title_for_list が 1 つでない');
  const title = titles[0]!.kids.filter((k): k is Tx => !isEl(k) && k.cdata).map(k => k.text).join('').replace(/\s+/g, '');
  if (title !== HOSEI_SPECIAL_TITLE) return { status: 'not_target', file, titleForList: title };
  if (!input.menuChain) throw new MofXmlParseError('organization', file, '目次の祖先 chain が無い');
  const scope = specialHoseiScopeFromChain(input.menuChain, file);

  // 見出しの型は、所管・組織の行がある型（org）と無い型（plain）。どちらかに完全一致
  let rows: Row[] | null = null;
  let layout = 'plain';
  const errs: string[] = [];
  for (const org of [false, true]) {
    try { rows = readTables(doc, file, SP_HEADER(org), spec.yearLabel); layout = org ? 'org' : 'plain'; break; } catch (e) { if (!(e instanceof MofXmlParseError) || e.code !== 'table_structure') throw e; errs.push(e.message); }
  }
  if (!rows) throw new MofXmlParseError('table_structure', file, `header がどの型とも一致しない: ${errs[0]}`);
  const classes = layout === 'org' ? SP_ORG : SP_PLAIN;
  const counts: Record<string, number> = { item: 0, 'item-name': 0, matter: 0, description: 0, ministry: 0, 'ministry-total': 0, organization: 0, 'organization-name': 0, 'item-only': 0, subtotal: 0, 'subtotal-mismatch': 0 };
  const records: HoseiRecord[] = [];
  const seen = new Set<string>();
  let ministry = scope.ministry; let organization = '';
  let current: Pending | null = null;
  const baseOf = (): Parameters<typeof finishItem>[1] => ({ file, ministry, specialAccount: scope.specialAccount, subAccount: scope.subAccount, organization });
  const cell = (r: Row, c: string): string => readCell(r.cells.get(c)!, file).text;
  const amountsOf = (r: Row): HoseiAmounts => {
    const v = ['3.1', '4.1', '6.1', '7.1', '9.1'].map(c => amountOf(cell(r, c), `列${c} ${r.key}`, file));
    return { enacted: v[0]!, add: v[1]!, reduce: v[2]!, net: v[3]!, revised: v[4]! };
  };
  let sawMinistry = false, sawOrg = false;
  for (const r of rows) {
    const cls = classify(r, classes, new Set(['10.1']), file);
    counts[cls]!++;
    if (cls === 'description') continue;
    if (cls === 'ministry' || cls === 'ministry-total' || cls === 'organization' || cls === 'organization-name') {
      finishItem(current, baseOf(), records, counts, file);
      current = null;
      if (cls.startsWith('ministry')) { ministry = cell(r, '1.1'); sawMinistry = true; sawOrg = false; }
      else { if (!sawMinistry) throw new MofXmlParseError('organization', file, `組織の行が所管の行より前 ${r.key}`); organization = cell(r, '1.3'); sawOrg = true; }
      continue;
    }
    if (layout === 'org' && !sawOrg) throw new MofXmlParseError('organization', file, `組織の行より前に項・事項の行 ${r.key}`);
    if (cls === 'item' || cls === 'item-name') {
      finishItem(current, baseOf(), records, counts, file);
      const codeCol = r.cells.has('1.4') ? '1.4' : '1.1';
      const code = cell(r, codeCol);
      if (!/^\d{2}$/.test(code)) throw new MofXmlParseError('item_code', file, `項コードが 2 桁数字でない ${r.key}: ${code}`);
      const k = `${ministry}|${organization}|${code}`;
      if (seen.has(k)) throw new MofXmlParseError('item_code', file, `項コードが重複 ${k}`);
      seen.add(k);
      current = { code, name: cell(r, '2.1'), page: r.page, row: r.key, amounts: cls === 'item' ? amountsOf(r) : null, matters: [] };
      continue;
    }
    if (!current) throw new MofXmlParseError('orphan', file, `事項行に項が無い ${r.key}`);
    const classCol = r.cells.has('1.5') ? '1.5' : '1.2';
    const classCode = cell(r, classCol);
    if (!/^\d{2}$/.test(classCode)) throw new MofXmlParseError('col4', file, `分類コードが 2 桁数字でない ${r.key}: ${classCode}`);
    current.matters.push({ rec: { ...baseOf(), row: r.key, page: r.page, itemCode: current.code, itemName: current.name, matterName: cell(r, '2.2'), classCode, kind: 'matter', amounts: amountsOf(r) } });
  }
  finishItem(current, baseOf(), records, counts, file);
  if (records.length === 0) throw new MofXmlParseError('organization', file, '事項が得られない（データ行なし）');
  return { status: 'recognized', file, sourceSha256: sha, records, counts, layout };
}
