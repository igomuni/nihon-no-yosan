/**
 * 概算要求の明細表・総表の行を、項の一覧に沿って項 › 事項 › 目に割り当てる。仕様: docs/guides/budget-request-tree.md
 *
 * 金額は読み取った値のまま（空欄は null）。検算は呼び出し側で行い、値は書き換えない。
 */
import { amount, type Rec } from './csv.ts';
import { nameKey, normalizeCodeHyphen } from './names.ts';
import { JIKOU_HEAD, KOU_HEAD, kouKey } from './request-tree.ts';

/** 項の一覧の 1 件。`jikouNames`: 目次でその項の下にある事項名（目次の無い項は空） */
export interface KouRef {
  code: string;
  name: string;
  jikouNames?: Set<string>;
}
/** 項の範囲の持ち主: 項の一覧の添字、または一覧に無い項（目次に無い項。`kouKey`） */
export type Owner = { kou: number } | { unlisted: string };
/**
 * 目。コード `95016-2111-02-0000` を `c1`（主要経費 2 桁＋目的別 3 桁）・`x`（財政法・経済性質・使途。桁数は会計で違う）・`yy`（目別）・`zz` に分ける。
 * `req` / `prev` は目の行の額。目の行が空欄で、下の細分（`CODE_NN_NNNN`）に額があるときは `subReq` / `subPrev` に細分の合計を持つ
 */
export interface Moku {
  c1: string;
  x: string;
  yy: string;
  zz: string;
  name: string;
  raw: string;
  prev: number | null;
  req: number | null;
  page: string;
  subReq?: number | null;
  subPrev?: number | null;
}
export interface Jikou {
  owner: Owner;
  reqNo: string;
  /** `NN-NN` */
  code: string;
  name: string;
  prev: number | null;
  req: number | null;
  page: string;
  moku: Moku[];
}
export interface Walk {
  jikous: Jikou[];
  /** 項の範囲の中で、事項の行より前にある目 */
  mokuNoJikou: { owner: Owner; moku: Moku }[];
  /** 項の範囲の外の目（ファイルの最初の項より前／`CONTEXT` の行の後） */
  orphan: { beforeKou: number; afterContext: number };
  /** 項の見出しの形（次の行が事項）だが、項の一覧に無いもの */
  unlisted: { code: string; name: string; page: string; prev: number | null; req: number | null }[];
  /** 直前に同じコード・名前の組織の行があった項（一覧の添字） */
  sameNameOrg: number[];
}

const MOKU_HEAD = /^(\d{5})-(\d+)-(\d+)-(\d+)\s*(.+)$/;

/** 明細表の目のコード `95016‑ 111‑02‑0000 職員基本給` を分ける（中央の桁の欠けは補わない）。目の形でなければ null */
export function parseMoku(text: string): Pick<Moku, 'c1' | 'x' | 'yy' | 'zz' | 'name' | 'raw'> | null {
  const m = MOKU_HEAD.exec(normalizeCodeHyphen(text).replace(/-\s+/g, '-'));
  return m ? { c1: m[1] ?? '', x: m[2] ?? '', yy: m[3] ?? '', zz: m[4] ?? '', name: nameKey(m[5]), raw: text } : null;
}

/**
 * 1 つのファイルの行を読む。`textCol` は名前の列（明細表は `事項`、総表は `区分`）。
 * 項: `CODE3` の行で、コード + 名前が一覧の、前に照合した項より後ろにあるもの。一覧に無い `CODE3` で次の行が事項（`DETAIL`）のものは、
 * 範囲の外か、今の項よりコードが大きいとき（項コードは組織の中で増える）だけ、一覧に無い項として範囲を切る。ただし、次の事項が目次で今の項の事項なら切らない。
 * それ以外の `CODE3` は事項の下の見出しで、範囲を変えない（コードの小さい見出しの下の事項は今の項のもの）。`CONTEXT` の行で範囲を閉じる。
 */
export function walkRows(rows: readonly Rec[], kous: readonly KouRef[], textCol: '事項' | '区分'): Walk {
  const keyOf = kous.map(k => kouKey(k.code, k.name));
  const first = rows[0];
  const prevCol = first ? Object.keys(first).find(k => /^前年度予算額(_計)?$/.test(k)) : undefined;
  const reqCol = first
    ? Object.keys(first).find(k => /概算要求額(_計)?$/.test(k) && !/一般行政経費|その他の経費/.test(k))
    : undefined;
  const val = (r: Rec, c: string | undefined): number | null => (c ? amount(r[c]) : null);
  const w: Walk = { jikous: [], mokuNoJikou: [], orphan: { beforeKou: 0, afterContext: 0 }, unlisted: [], sameNameOrg: [] };
  let p = 0;
  let owner: Owner | null = null;
  let ownerCode = '';
  let orgRow = '';
  let jikou: Jikou | null = null;
  let seen = false;
  let lastMoku: Moku | null = null;
  rows.forEach((r, i) => {
    const t = r['row_type'];
    const text = r[textCol] ?? '';
    const page = r['source_page'] ?? '';
    // 目の細分: 直前の目の行が空欄のときだけ、細分の額を足す（目の行に額があれば細分は内訳なので足さない）
    if (t === 'CODE_NN_NNNN') {
      if (lastMoku && lastMoku.req === null) {
        const a = val(r, reqCol);
        const b = val(r, prevCol);
        if (a !== null) lastMoku.subReq = (lastMoku.subReq ?? 0) + a;
        if (b !== null) lastMoku.subPrev = (lastMoku.subPrev ?? 0) + b;
      }
      return;
    }
    lastMoku = null;
    if (t === 'CONTEXT') {
      owner = null;
      jikou = null;
      return;
    }
    const next = rows[i + 1];
    if (t === 'CODE3') {
      const m = KOU_HEAD.exec(text);
      if (!m) return;
      const code = m[1] ?? '';
      const key = kouKey(code, m[2] ?? '');
      // 組織と項が同じ名前の機関（衆議院・人事院など）は、組織の行の直後に同じコード・名前の項の行が続く。後の行を項とする
      const nm = next?.['row_type'] === 'CODE3' ? KOU_HEAD.exec(next[textCol] ?? '') : null;
      if (nm && kouKey(nm[1] ?? '', nm[2] ?? '') === key) {
        orgRow = key;
        return;
      }
      const f = keyOf.indexOf(key, p);
      if (f >= 0 && orgRow === key && !w.sameNameOrg.includes(f)) w.sameNameOrg.push(f);
      orgRow = '';
      if (f >= 0) {
        owner = { kou: f };
        ownerCode = code;
        p = f + 1;
        jikou = null;
        seen = true;
        return;
      }
      const nextJikou = JIKOU_HEAD.exec(next?.[textCol] ?? '');
      const current: Owner | null = owner;
      const inToc =
        current !== null &&
        'kou' in current &&
        nextJikou !== null &&
        (kous[current.kou]?.jikouNames?.has(nameKey(nextJikou[3])) ?? false);
      if (next?.['row_type'] === 'DETAIL' && !inToc && (!current || code > ownerCode)) {
        owner = { unlisted: key };
        ownerCode = code;
        jikou = null;
        seen = true;
        w.unlisted.push({ code, name: nameKey(m[2]), page, prev: val(r, prevCol), req: val(r, reqCol) });
      }
      return;
    }
    if (t === 'DETAIL') {
      if (!owner) return;
      const m = JIKOU_HEAD.exec(text);
      if (!m) return;
      jikou = {
        owner,
        reqNo: r['要求番号'] ?? '',
        code: `${m[1] ?? ''}-${m[2] ?? ''}`,
        name: nameKey(m[3]),
        prev: val(r, prevCol),
        req: val(r, reqCol),
        page,
        moku: [],
      };
      w.jikous.push(jikou);
      return;
    }
    if (t === 'CODE_5_4_2_4') {
      const pm = parseMoku(text);
      if (!pm) return;
      if (!owner) {
        if (seen) w.orphan.afterContext++;
        else w.orphan.beforeKou++;
        return;
      }
      const mk: Moku = { ...pm, prev: val(r, prevCol), req: val(r, reqCol), page };
      lastMoku = mk;
      if (jikou) jikou.moku.push(mk);
      else w.mokuNoJikou.push({ owner, moku: mk });
    }
  });
  return w;
}

/** 目の額: 目の行の額、空欄なら細分の合計（どちらも無ければ null） */
export const mokuReq = (m: Moku): number | null => m.req ?? m.subReq ?? null;
export const mokuPrev = (m: Moku): number | null => m.prev ?? m.subPrev ?? null;

export interface MokuGroup {
  c1: string;
  yy: string;
  name: string;
  /** 足した目のコードの形（`c1-x-yy-zz`。出現順、重複なし） */
  raws: string[];
  prev: number | null;
  req: number | null;
  rows: number;
  /** 細分の合計を使った行の数 */
  fromSub: number;
  /** 額の無い行の数 */
  blanks: number;
  page: string;
}

/** 同じ事項の中で、同じ目（主要経費・目的別 5 桁 + 目別 2 桁 + 目名）を足す。細分の合計を使った行の数と、額の無い行の数も数える */
export function groupMoku(list: readonly Moku[]): MokuGroup[] {
  const g = new Map<string, MokuGroup>();
  for (const m of list) {
    const k = `${m.c1}|${m.yy}|${m.name}`;
    let e = g.get(k);
    if (!e) {
      e = { c1: m.c1, yy: m.yy, name: m.name, raws: [], prev: null, req: null, rows: 0, fromSub: 0, blanks: 0, page: m.page };
      g.set(k, e);
    }
    const raw = `${m.c1}-${m.x}-${m.yy}-${m.zz}`;
    if (!e.raws.includes(raw)) e.raws.push(raw);
    e.rows++;
    const r = mokuReq(m);
    const p = mokuPrev(m);
    if (r === null) e.blanks++;
    else {
      e.req = (e.req ?? 0) + r;
      if (m.req === null) e.fromSub++;
    }
    if (p !== null) e.prev = (e.prev ?? 0) + p;
  }
  return [...g.values()];
}
