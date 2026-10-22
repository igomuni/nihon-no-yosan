/**
 * 概算要求書の木（所管・会計・組織・勘定 › 項 › 事項）を、目次・総表・明細表の CSV の行から作る。仕様: docs/guides/budget-request-tree.md
 *
 * 階層は目次の見出しで決める。目次の無い書は、総表または明細表の行の並びで決める。金額は、総表の小計の構造で項を見分けるときだけに使う。
 */
import { amount, type Rec } from './csv.ts';
import { nameKey } from './names.ts';

export type Label = '所管' | '会計' | '組織' | '勘定' | '項';
const LABELS = new Set<string>(['所管', '会計', '組織', '勘定', '項']);

/** 項。`fromTotal`: 目次に無く、総表の小計の構造から補った項（`supplementTocTree`） */
export interface TocKou {
  idx: number;
  slug: string;
  code: string;
  name: string;
  page: string;
  ministry: string | null;
  org: string | null;
  account: string | null;
  sub: string | null;
  fromTotal?: boolean;
}
/** 事項。`first` は事項コードの前半（事項の番号）、`class2` は後半（主要経費別分類）。`kouIdx` は属する項（無ければ null） */
export interface TocJikou {
  slug: string;
  reqNo: string;
  first: string;
  class2: string;
  name: string;
  page: string;
  kouIdx: number | null;
}
export interface TocTree {
  slug: string;
  labels: { kind: Label; code: string; name: string; page: string }[];
  kous: TocKou[];
  jikous: TocJikou[];
  /** 見出しでも事項でもない行の数 */
  unclassified: number;
  /** 階層の根拠: 目次の見出し（`toc`）、総表の行の並び（`position`）、明細表の行の並び（`position_detail`） */
  hierarchy: 'toc' | 'position' | 'position_detail';
}

/** 項の見出し `017 地球温暖化対策推進費` */
export const KOU_HEAD = /^(\d{3})\s*(.+)$/;
/** 事項 `01‑95 地球温暖化対策の推進に必要な経費`（区切りはハイフン類のどれでもよい） */
export const JIKOU_HEAD = /^(\d{2})[‐-―−－-](\d{2})\s*(.+)$/;

/** 項の鍵（1 つの書の中）: 項コード（3 桁）と、揃えた項名 */
export const kouKey = (code: string, name: string): string => `${code}|${nameKey(name)}`;

/** 目次の行（`要求番号`・`区分`・`ページ`）を文書順に読み、見出しの直後の事項をその見出しの子にする。想定外の見出しの種類は例外 */
export function buildTocTree(slug: string, rows: readonly Rec[]): TocTree {
  const t: TocTree = { slug, labels: [], kous: [], jikous: [], unclassified: 0, hierarchy: 'toc' };
  let ministry: string | null = null;
  let account: string | null = null;
  let sub: string | null = null;
  let org: string | null = null;
  let kouIdx: number | null = null;
  for (const r of rows) {
    const kind = r['区分'] ?? '';
    const page = r['ページ'] ?? '';
    const h = /^（([^）]*)）\s*(\S+)\s+(.+)$/.exec(kind);
    if (/^（/.test(kind) && !h) throw new Error(`STOP: ${slug} TOC の見出しが読めない: ${kind}`);
    if (h) {
      const label = h[1] ?? '';
      if (!LABELS.has(label)) throw new Error(`STOP: ${slug} TOC の見出しの種類が想定外: ${kind}`);
      const code = h[2] ?? '';
      const name = nameKey(h[3]);
      t.labels.push({ kind: label as Label, code, name, page });
      if (label === '所管') {
        ministry = name;
        account = sub = org = null;
        kouIdx = null;
      } else if (label === '会計') {
        account = name;
        sub = org = null;
        kouIdx = null;
      } else if (label === '勘定') {
        sub = name;
        org = null;
        kouIdx = null;
      } else if (label === '組織') {
        org = name;
        kouIdx = null;
      } else {
        kouIdx = t.kous.length;
        t.kous.push({ idx: kouIdx, slug, code, name, page, ministry, org, account, sub });
      }
      continue;
    }
    const m = JIKOU_HEAD.exec(kind);
    const reqNo = r['要求番号'] ?? '';
    if (m && reqNo !== '') {
      t.jikous.push({ slug, reqNo, first: m[1] ?? '', class2: m[2] ?? '', name: nameKey(m[3]), page, kouIdx });
      continue;
    }
    t.unclassified++;
  }
  return t;
}

const totalReq = (r: Rec | undefined): number | null =>
  r ? amount(r[Object.keys(r).find(k => /概算要求額_計$/.test(k)) ?? '']) : null;

export interface TotalKouHead {
  /** 総表の行の添字 */
  index: number;
  code: string;
  name: string;
  /** 項の一覧（目次の項）にあるもの */
  listed: boolean;
  isKou: boolean;
}

/**
 * 総表の項の見出しの形の行（`CODE3` の次が `DETAIL`）を、総表の小計の構造で、項か事項の下の見出しかに分ける。
 * 総表の項の行の額は、次の項までの事項の額の合計（小計）。事項の下の見出しは、項の小計の途中にある。
 * - `listed`（項の一覧の `kouKey`。目次の項）にあるものは項（一覧の順に照合する）。
 * - 一覧に無いもの（`listed` が null なら全部）は、直前の項の額が、その項からこの行までの事項の額の合計（間の `CODE3` は飛ばす）に等しいとき項。
 *   一覧がある書では、さらに、この行の額が次の `CODE3` までの事項の額の合計に等しいこと。直前の項が無い（書・勘定の最初）ときも項。
 * - `TOTAL`・`HIER` の行で、直前の項は切れる。額の空欄があれば項にしない。
 */
export function totalTableKouHeads(rows: readonly Rec[], listed: readonly string[] | null): TotalKouHead[] {
  const out: TotalKouHead[] = [];
  const detailSum = (from: number, to: number, stopAtCode3: boolean): number | null => {
    let v = 0;
    for (let i = from + 1; i < to; i++) {
      const t = rows[i]?.['row_type'];
      if (t === 'TOTAL' || t === 'HIER' || (stopAtCode3 && t === 'CODE3')) break;
      if (t === 'DETAIL') {
        const a = totalReq(rows[i]);
        if (a === null) return null;
        v += a;
      }
    }
    return v;
  };
  let owner: number | null = null;
  let p = 0;
  rows.forEach((r, i) => {
    if (r['row_type'] === 'TOTAL' || r['row_type'] === 'HIER') {
      owner = null;
      return;
    }
    if (r['row_type'] !== 'CODE3' || rows[i + 1]?.['row_type'] !== 'DETAIL') return;
    const m = KOU_HEAD.exec(r['区分'] ?? '');
    if (!m) return;
    const code = m[1] ?? '';
    const name = nameKey(m[2]);
    const f = listed ? listed.indexOf(kouKey(code, name), p) : -1;
    if (f >= 0) {
      p = f + 1;
      owner = i;
      out.push({ index: i, code, name, listed: true, isKou: true });
      return;
    }
    const oa = owner === null ? null : totalReq(rows[owner]);
    const closes = owner === null || (oa !== null && detailSum(owner, i, false) === oa);
    const self = listed === null || (totalReq(r) !== null && detailSum(i, rows.length, true) === totalReq(r));
    const isKou = closes && self;
    if (isKou) owner = i;
    out.push({ index: i, code, name, listed: false, isKou });
  });
  return out;
}

/**
 * 目次から漏れた項を、総表から補う（目次に無い項の見出しのうち、`totalTableKouHeads` で項になるもの）。`t` を書き換え、補った項を返す。
 * 補った項は、総表で直前にある項の後ろに置き、所属（所管・組織・会計・勘定）はその項から取る。頁は総表の `明細書頁数`（目次の頁と同じ紙面の印字）。
 * 目次がその項の事項を前の項の下に置いているとき（総表で補った項の範囲にある事項名と同じ名前）は、事項を補った項に付け替える。
 */
export function supplementTocTree(t: TocTree, totalRows: readonly Rec[]): TocKou[] {
  const listed = t.kous.map(k => kouKey(k.code, k.name));
  const heads = totalTableKouHeads(totalRows, listed);
  const added: { after: number; kou: TocKou; jikouNames: Set<string> }[] = [];
  let lastListed = -1;
  let p = 0;
  heads.forEach((h, n) => {
    if (h.listed) {
      lastListed = listed.indexOf(kouKey(h.code, h.name), p);
      p = lastListed + 1;
      return;
    }
    const base = t.kous[lastListed];
    if (!h.isKou || !base) return;
    const end = heads[n + 1]?.index ?? totalRows.length;
    const names = new Set<string>();
    for (let i = h.index + 1; i < end; i++) {
      const r = totalRows[i];
      if (!r || r['row_type'] === 'TOTAL' || r['row_type'] === 'HIER') break;
      const m = JIKOU_HEAD.exec(r['区分'] ?? '');
      if (r['row_type'] === 'DETAIL' && m) names.add(nameKey(m[3]));
    }
    const kou: TocKou = {
      idx: -1,
      slug: t.slug,
      code: h.code,
      name: h.name,
      page: totalRows[h.index]?.['明細書頁数'] ?? '',
      ministry: base.ministry,
      org: base.org,
      account: base.account,
      sub: base.sub,
      fromTotal: true,
    };
    added.push({ after: lastListed, kou, jikouNames: names });
  });
  if (added.length === 0) return [];
  // 並べ直して添字を振り直す（同じ項の後ろに複数あれば総表の順）
  const order: { kou: TocKou; old: number | null; jikouNames?: Set<string> }[] = [];
  t.kous.forEach((k, i) => {
    order.push({ kou: k, old: i });
    for (const a of added.filter(x => x.after === i)) order.push({ kou: a.kou, old: null, jikouNames: a.jikouNames });
  });
  const remap = new Map<number, number>();
  order.forEach((o, i) => {
    o.kou.idx = i;
    if (o.old !== null) remap.set(o.old, i);
  });
  for (const j of t.jikous) {
    if (j.kouIdx === null) continue;
    const owner = remap.get(j.kouIdx) ?? j.kouIdx;
    // 目次で前の項の下に置かれた、補った項の事項: 同じ項の後ろに続けて補った項のどれかに、同名の事項がある
    let cand: number | null = null;
    for (let i = owner + 1; i < order.length && order[i]?.old === null; i++) {
      if (order[i]?.jikouNames?.has(j.name)) {
        cand = i;
        break;
      }
    }
    j.kouIdx = cand ?? owner;
  }
  t.kous = order.map(o => o.kou);
  return added.map(a => a.kou);
}

/**
 * 目次の無い書の木を、総表の行の並びから作る。項＝`CODE3` の次が `DETAIL` で、総表の小計の構造で項になるもの（`totalTableKouHeads`）、
 * 事項＝その項に続く `DETAIL`、勘定＝`HIER` の先頭が 1 桁、会計＝`HIER` の先頭が 2 桁で `isAccountName`（予算書の特別会計名）に当たるもの。組織は使わない。
 */
export function buildPositionTree(slug: string, rows: readonly Rec[], isAccountName: (name: string) => boolean): TocTree {
  const t: TocTree = { slug, labels: [], kous: [], jikous: [], unclassified: 0, hierarchy: 'position' };
  let account: string | null = null;
  let sub: string | null = null;
  let kouIdx: number | null = null;
  // 項の見出しの形の行のうち、総表の小計の構造で項になるものだけを項にする（ほかは事項の下の見出しで、その下の事項は今の項のもの）
  const kouRows = new Set(
    totalTableKouHeads(rows, null)
      .filter(h => h.isKou)
      .map(h => h.index),
  );
  rows.forEach((r, i) => {
    const type = r['row_type'];
    const next = rows[i + 1]?.['row_type'];
    const text = r['区分'] ?? '';
    const page = r['source_page'] ?? '';
    if (type === 'HIER') {
      const m = /^(\d+)\s*(.+)$/.exec(text);
      if (!m) return;
      const digits = m[1] ?? '';
      const name = nameKey(m[2]);
      if (digits.length === 1) sub = name;
      else if (digits.length === 2 && isAccountName(name)) {
        account = name;
        sub = null;
      }
    } else if (type === 'CODE3' && next === 'DETAIL' && kouRows.has(i)) {
      const m = KOU_HEAD.exec(text);
      if (!m) return;
      kouIdx = t.kous.length;
      t.kous.push({ idx: kouIdx, slug, code: m[1] ?? '', name: nameKey(m[2]), page, ministry: null, org: null, account, sub });
    } else if (type === 'DETAIL') {
      const m = JIKOU_HEAD.exec(text);
      if (!m) {
        t.unclassified++;
        return;
      }
      t.jikous.push({ slug, reqNo: r['要求番号'] ?? '', first: m[1] ?? '', class2: m[2] ?? '', name: nameKey(m[3]), page, kouIdx });
    }
  });
  return t;
}

/**
 * 目次も総表も無い書の木を、明細表の行の並びから作る。項＝`CODE3` の次が `DETAIL`、事項＝その項に続く `DETAIL`、
 * 勘定＝`CODE1`、会計＝`CODE2` のうち先頭が 2 桁で `isAccountName` に当たるもの。組織は使わない。
 */
export function buildPositionTreeFromDetail(
  slug: string,
  rows: readonly Rec[],
  isAccountName: (name: string) => boolean,
): TocTree {
  const t: TocTree = { slug, labels: [], kous: [], jikous: [], unclassified: 0, hierarchy: 'position_detail' };
  let account: string | null = null;
  let sub: string | null = null;
  let kouIdx: number | null = null;
  rows.forEach((r, i) => {
    const type = r['row_type'];
    const next = rows[i + 1]?.['row_type'];
    const text = r['事項'] ?? '';
    const page = r['source_page'] ?? '';
    if (type === 'CODE1') {
      const m = /^(\d+)\s*(.+)$/.exec(text);
      if (m) sub = nameKey(m[2]);
    } else if (type === 'CODE2') {
      const m = /^(\d+)\s*(.+)$/.exec(text);
      if (m && (m[1] ?? '').length === 2 && isAccountName(nameKey(m[2]))) {
        account = nameKey(m[2]);
        sub = null;
      }
    } else if (type === 'CODE3' && next === 'DETAIL') {
      const m = KOU_HEAD.exec(text);
      if (!m) return;
      kouIdx = t.kous.length;
      t.kous.push({ idx: kouIdx, slug, code: m[1] ?? '', name: nameKey(m[2]), page, ministry: null, org: null, account, sub });
    } else if (type === 'DETAIL') {
      const m = JIKOU_HEAD.exec(text);
      if (!m) {
        t.unclassified++;
        return;
      }
      t.jikous.push({ slug, reqNo: r['要求番号'] ?? '', first: m[1] ?? '', class2: m[2] ?? '', name: nameKey(m[3]), page, kouIdx });
    }
  });
  return t;
}
