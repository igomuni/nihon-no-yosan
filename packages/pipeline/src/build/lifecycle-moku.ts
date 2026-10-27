/**
 * 予算の推移の「目」タブのデータ（`lifecycle/moku.json.gz`）を作る。仕様: docs/guides/lifecycle-moku.md
 *
 * 入力: 予算書の目の CSV（`mof-archive/{版}/moku-{general,special}{,-hosei{,-2,-3},-kessan}.csv`。版のディレクトリは、予算の一生の表と同じ `LifecycleSource`）と、
 * 概算要求の目（`mof-ui.ts` が、予算書の項ごとに、要求書の明細の目と予算書の目を名前でつないだ結果）。
 * - 目の識別: 項 + 目名（`nameKey`）+ 分類コード（一般会計 5 つ、特別会計 4 つ）。
 * - 補正: 「外N目」の集約行と、目名が空の行（項の行）は、目にしない（その項に、そのことを記す）。補正が複数回の年度は、その目が個別の行で載る最後の回の値。
 * - 決算: 原本は円。千円に直す。同じ識別の行が複数ある（特別会計で、共管の組織ごとに行がある）ときは、共管別の行に分ける。
 * - 段階の間で識別が合わないときは、その項で同じ目名の目が 1 つだけなら、目名だけで結ぶ（分類コードが段階で違う目）。それでも無ければ、その段階にだけある目として足す。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MOKU_FLAG,
  nameKey,
  pairByName,
  readCsv,
  reqMokuCode,
  type BudgetRequestMofDetail,
  type LifecycleKou,
  type LifecycleMokuData,
  type LifecycleMokuNode,
  type MokuRequestCoverage,
  type Rec,
} from '@nihon-no-yosan/core';
import type { LifecycleRequestOnlyRow, LifecycleSource } from './lifecycle.ts';
import { requestOnlyKouId } from './lifecycle-jikou.ts';

/** 予算書の項に対応する概算要求の目（`mof-ui.ts` の詳細の `m`: [名前, 目コード, 要求額, 予算書の額]。千円）。`noReq` = 要求側の明細が読めていない */
export interface MokuRequest {
  m: readonly (readonly [string, string, number | null, number | null])[];
  noReq: boolean;
}

export interface LifecycleMokuStats {
  /** 年度ごとの目の数 */
  nodes: Record<number, number>;
  /** 補正の集約行（外N目）・項の行（目名が空）の数 */
  suppAggregatedRows: number;
  suppKouOnlyRows: number;
  /** 補正にだけある目、決算にだけある目、概算要求にだけある目の数 */
  suppOnly: number;
  settleOnly: number;
  requestOnly: number;
  /** 概算要求書にだけある項（予算書に無い項・年度）の目の数 */
  requestOnlyKou: number;
  /** 目名だけで結んだ数（段階ごと） */
  nameOnly: Record<'supp' | 'settle' | 'request', number>;
  /** 決算で共管別に分けた識別の数と、共管別の行の数 */
  settleSplit: number;
  settleParts: number;
  /** 当初で、同じ識別が重なった目（共管で分けた） */
  budgetDup: number;
}

const ACCOUNTS = ['general', 'special'] as const;
type Account = (typeof ACCOUNTS)[number];
const CODES: Record<Account, string[]> = {
  general: ['主要経費別分類コード', '目的別分類コード', '財政法公債金対象非対象別分類コード', '経済性質別分類コード', '使途別分類コード'],
  special: ['主要経費別分類コード', '目的別分類コード', '経済性質別分類コード', '使途別分類コード'],
};
const AGGREGATED = /外\d+目$/;

/** 整数（原本の文字列）。空欄は null */
const intOf = (s: string | undefined): number | null => {
  const t = (s ?? '').trim();
  if (t === '') return null;
  if (!/^-?\d+$/.test(t)) throw new Error(`整数でない金額: ${s}`);
  return Number(t);
};
const colOf = (r: Rec, pred: (k: string) => boolean, what: string): string => {
  const k = Object.keys(r).find(pred);
  if (k === undefined) throw new Error(`列が無い: ${what}（${Object.keys(r).join(',')}）`);
  return k;
};
/** 項の id（`lifecycle.ts` の `keyOf` と同じ。原本の文字のまま） */
const kouIdOf = (year: number, a: Account, r: Rec): string =>
  `${year}:${a}:${(a === 'general' ? [r['所管'], r['組織'], r['項コード'], r['項名']] : [r['特別会計'], r['勘定'], r['項コード'], r['項名']]).map(x => x ?? '').join('|')}`;
const partOf = (r: Rec): string => `${r['共管所管名'] ?? ''}|${r['共管組織名'] ?? ''}`;

interface Node { kouId: string; year: number; name: string; key: string; codes: string; part: string; v: (number | null)[]; flags: number }
// v の並び: 政府案, 補正後, 補正の差引額, 歳出予算現額, 支出済歳出額, 翌年度繰越額, 不用額, 概算要求
const V = { budget: 0, revised: 1, suppNet: 2, current: 3, spent: 4, carried: 5, unused: 6, request: 7 } as const;

export function buildLifecycleMoku({ datasetDir, historyDir, sources, kous, request }: {
  datasetDir: string;
  historyDir?: string | undefined;
  sources: readonly LifecycleSource[];
  /** 予算の一生の表の項。目の項は、ここに無ければ止まる */
  kous: readonly LifecycleKou[];
  /** 項の id → 概算要求の目 */
  request: ReadonlyMap<string, MokuRequest>;
}): { data: LifecycleMokuData; stats: LifecycleMokuStats } {
  const kouIds = new Set(kous.map(k => k.id));
  const nodes: Node[] = [];
  const stats: LifecycleMokuStats = { nodes: {}, suppAggregatedRows: 0, suppKouOnlyRows: 0, suppOnly: 0, settleOnly: 0, requestOnly: 0, requestOnlyKou: 0, nameOnly: { supp: 0, settle: 0, request: 0 }, settleSplit: 0, settleParts: 0, budgetDup: 0 };
  const coverage = new Map<string, MokuRequestCoverage>();
  const suppYears = new Set<number>(), settleYears = new Set<number>(), requestYears = new Set<number>();
  /** 概算要求の目を置いた、予算書の項 */
  const requestPlaced = new Set<string>();
  const rootOf = (s: LifecycleSource): string => {
    if (s.root !== 'history') return datasetDir;
    if (!historyDir) throw new Error(`${s.year}: 過去年度のデータセット（historyDir）が無い`);
    return historyDir;
  };
  const rd = (root: string, dir: string | null | undefined, file: string, optional = false): Rec[] => {
    if (!dir) return [];
    const f = path.join(root, 'mof-archive', dir, file);
    if (optional && !fs.existsSync(f)) return [];
    return readCsv(fs.readFileSync(f, 'utf8'));
  };

  for (const source of sources) {
    const year = source.year;
    const root = rootOf(source);
    for (const a of ACCOUNTS) {
      // 項ごとの目。識別 → 目
      const byKou = new Map<string, Map<string, Node>>();
      const kouOf = (r: Rec): Map<string, Node> => {
        const id = kouIdOf(year, a, r);
        if (!kouIds.has(id)) throw new Error(`目の項が、予算の一生の表に無い: ${id}`);
        return byKou.get(id) ?? byKou.set(id, new Map()).get(id)!;
      };
      const codesOf = (r: Rec): string => CODES[a].map(c => r[c] ?? '').join('|');
      const add = (kouId: string, m: Map<string, Node>, name: string, codes: string, part: string): Node => {
        const n: Node = { kouId, year, name, key: `${nameKey(name)}|${codes}|${part}`, codes, part, v: Array<number | null>(8).fill(null), flags: 0 };
        m.set(n.key, n);
        nodes.push(n);
        return n;
      };
      /** 識別で探し、無ければ、共管の無い目のうち同じ目名が 1 つだけの目（同じ段階で、ほかの行に結んだ目は除く） */
      const find = (m: Map<string, Node>, name: string, codes: string, taken: ReadonlySet<Node>): { n: Node; byName: boolean } | null => {
        const exact = m.get(`${nameKey(name)}|${codes}|`);
        if (exact) return { n: exact, byName: false };
        const same = [...m.values()].filter(x => x.part === '' && !taken.has(x) && nameKey(x.name) === nameKey(name));
        return same.length === 1 ? { n: same[0]!, byName: true } : null;
      };

      // 政府案（当初予算）。千円
      const base = rd(root, source.budget, `moku-${a}.csv`);
      if (base.length > 0) {
        const amt = colOf(base[0]!, k => /^(令和|平成)(元|\d+)年度(要求|予定)額/.test(k), '当初の額');
        for (const r of base) {
          const m = kouOf(r);
          const codes = codesOf(r);
          let part = '';
          if (m.has(`${nameKey(r['目名'] ?? '')}|${codes}|`)) { part = partOf(r); stats.budgetDup++; }
          if (m.has(`${nameKey(r['目名'] ?? '')}|${codes}|${part}`)) throw new Error(`${year} ${a}: 当初の目の識別が、共管で分けても重なる: ${kouIdOf(year, a, r)} ${r['目名']}`);
          add(kouIdOf(year, a, r), m, r['目名'] ?? '', codes, part).v[V.budget] = intOf(r[amt]);
        }
      }

      // 補正。回ごとのファイル。その目が個別の行で載る最後の回の値
      const supp = source.supp[a];
      if (supp) {
        const rounds: Rec[][] = [rd(root, supp, `moku-${a}-hosei.csv`)];
        for (let round = 2; ; round++) { const rows = rd(root, supp, `moku-${a}-hosei-${round}.csv`, true); if (rows.length === 0) break; rounds.push(rows); }
        if (rounds.some(rs => rs.length > 0)) suppYears.add(year);
        const aggregatedKou = new Set<string>(), kouOnly = new Set<string>();
        for (const rows of rounds) {
          if (rows.length === 0) continue;
          const rev = colOf(rows[0]!, k => k.startsWith('改'), '改予算額');
          const net = colOf(rows[0]!, k => /^補正(要求|予定)差引額/.test(k), '補正の差引額');
          const taken = new Set<Node>();
          for (const r of rows) {
            const m = kouOf(r);
            const kouId = kouIdOf(year, a, r);
            const name = r['目名'] ?? '';
            if (name === '') { kouOnly.add(kouId); stats.suppKouOnlyRows++; continue; }
            if (AGGREGATED.test(name)) { aggregatedKou.add(kouId); stats.suppAggregatedRows++; continue; }
            const hit = find(m, name, codesOf(r), taken);
            let n: Node;
            if (hit) { n = hit.n; if (hit.byName && !(n.flags & MOKU_FLAG.nameOnly)) { n.flags |= MOKU_FLAG.nameOnly; stats.nameOnly.supp++; } }
            else { n = add(kouId, m, name, codesOf(r), ''); stats.suppOnly++; }
            n.v[V.revised] = intOf(r[rev]);
            n.v[V.suppNet] = intOf(r[net]);
            n.flags |= MOKU_FLAG.suppItem;
            taken.add(n);
          }
        }
        for (const [kouId, m] of byKou) {
          for (const n of m.values()) {
            if (n.flags & MOKU_FLAG.suppItem) continue;
            if (aggregatedKou.has(kouId)) n.flags |= MOKU_FLAG.suppAggregated;
            else if (kouOnly.has(kouId)) n.flags |= MOKU_FLAG.suppKouOnly;
          }
        }
      }

      // 決算。円 → 千円
      const settle = rd(root, source.settle[a], `moku-${a}-kessan.csv`);
      if (settle.length > 0) {
        settleYears.add(year);
        const cols = ['歳出予算現額(円)', '支出済歳出額(円)', '翌年度繰越額(円)', '不用額(円)'].map(c => colOf(settle[0]!, k => k === c, c));
        const put = (n: Node, r: Rec): void => { cols.forEach((c, i) => { const v = intOf(r[c]); n.v[V.current + i] = v === null ? null : v / 1000; }); };
        const groups = new Map<string, Rec[]>();
        for (const r of settle) { kouOf(r); const g = `${kouIdOf(year, a, r)}\n${nameKey(r['目名'] ?? '')}|${codesOf(r)}`; (groups.get(g) ?? groups.set(g, []).get(g)!).push(r); }
        const taken = new Set<Node>();
        for (const rs of groups.values()) {
          const r0 = rs[0]!;
          const m = kouOf(r0);
          const kouId = kouIdOf(year, a, r0);
          const hit = find(m, r0['目名'] ?? '', codesOf(r0), taken);
          if (hit) taken.add(hit.n);
          if (rs.length === 1) {
            let n: Node;
            if (hit) { n = hit.n; if (hit.byName) { n.flags |= MOKU_FLAG.nameOnly; stats.nameOnly.settle++; } }
            else { n = add(kouId, m, r0['目名'] ?? '', codesOf(r0), ''); stats.settleOnly++; }
            put(n, r0);
            continue;
          }
          // 共管別の行に分ける。共管が同じ行が重なるときは、出てきた順に番号を付ける
          stats.settleSplit++;
          if (hit) hit.n.flags |= MOKU_FLAG.settleSplit;
          const seen = new Map<string, number>();
          for (const r of rs) {
            const p = partOf(r);
            const k = (seen.get(p) ?? 0) + 1;
            seen.set(p, k);
            const n = add(kouId, m, r['目名'] ?? '', codesOf(r), k === 1 ? p : `${p}#${k}`);
            n.flags |= MOKU_FLAG.settlePart;
            put(n, r);
            stats.settleParts++;
          }
        }
      }

      // 概算要求（予算書の項に突合できた項だけ）。予算書の目と同じ名前の目に、要求額を置く。予算書の目が無い名前は、概算要求にだけある目
      for (const [kouId, m] of byKou) {
        const q = request.get(kouId);
        if (!q) continue;
        requestPlaced.add(kouId);
        requestYears.add(year);
        if (q.noReq) { coverage.set(kouId, 'noReq'); continue; }
        const withReq = q.m.filter(p => p[2] !== null);
        coverage.set(kouId, withReq.length === 0 ? 'none' : q.m.every(p => p[2] !== null && p[3] !== null) ? 'full' : 'partial');
        for (const [name, , req] of withReq) {
          const same = [...m.values()].filter(x => x.part === '' && x.v[V.budget] !== null && nameKey(x.name) === name);
          if (same.length === 1) { same[0]!.v[V.request] = req; continue; }
          const n = add(kouId, m, name, '', '');
          n.v[V.request] = req;
          n.flags |= MOKU_FLAG.requestOnly;
          stats.requestOnly++;
        }
      }
      // 予算書の項に突合できたのに、予算書の目が 1 つも無い項（目の CSV に無い項）は、ここでは数えない
    }
  }

  // 概算要求書にだけある項（予算書の項に結べなかった項、予算書が基準データに無い年度の項）。目は、すべて概算要求書の目（予算書の目は無い）
  const kouById = new Map(kous.map(k => [k.id, k]));
  for (const [kouId, q] of request) {
    if (requestPlaced.has(kouId)) continue;
    const k = kouById.get(kouId);
    if (!k) throw new Error(`概算要求の目の項が、予算の一生の表に無い: ${kouId}`);
    if (!k.requestOnly) continue; // 予算書の項に結べたのに、予算書の目が 1 つも無い項（上の注記のとおり、数えない）
    requestYears.add(k.year);
    const placed = new Map<string, Node>();
    for (const [name, , req] of q.m) {
      if (req === null) continue;
      const key = `${nameKey(name)}||`;
      if (placed.has(key)) throw new Error(`概算要求のみの項の目が重複: ${kouId} ${name}`);
      const n: Node = { kouId, year: k.year, name, key, codes: '', part: '', v: Array<number | null>(8).fill(null), flags: MOKU_FLAG.requestOnly };
      n.v[V.request] = req;
      placed.set(key, n);
      nodes.push(n);
      stats.requestOnlyKou++;
    }
  }

  const kouList: string[] = [];
  const kouIndex = new Map<string, number>();
  const out: LifecycleMokuNode[] = nodes.map(n => {
    let k = kouIndex.get(n.kouId);
    if (k === undefined) { k = kouList.length; kouList.push(n.kouId); kouIndex.set(n.kouId, k); }
    stats.nodes[n.year] = (stats.nodes[n.year] ?? 0) + 1;
    return [k, n.year, n.name, n.codes, n.part, ...(n.v as [number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null]), n.flags];
  });
  const years = [...new Set(out.map(n => n[1]))].sort((x, y) => x - y);
  const sorted = (s: Set<number>): number[] => [...s].sort((x, y) => x - y);
  return {
    data: {
      years,
      suppYears: sorted(suppYears),
      settleYears: sorted(settleYears),
      requestYears: sorted(requestYears),
      kous: kouList,
      nodes: out,
      requestCoverage: [...coverage].flatMap(([id, c]) => (kouIndex.has(id) ? [[kouIndex.get(id)!, c] as [number, MokuRequestCoverage]] : [])),
    },
    stats,
  };
}

/**
 * 概算要求書にだけある項の、概算要求の目（`MokuRequest`。額は千円）。予算書に突合できなかった項（`reqOnly`・`zero`）は `mof-ui` の詳細の行（`mofRowKey`）から、
 * 予算書が基準データに無い年度の項（`noBudget`）は、年度推移の目（`trend-detail` の `moku/{年度}.csv`）から取る。後者は、同じ項が複数の要求書に載るとき、
 * 要求額の合計が最も大きい公開元の目だけを使う（`requestOnlyJikou` と同じ考え方）。項の id は `requestOnlyKouId`（年度内の突合で予算書の項に結んだ項は、その予算書の項の id）。
 * 要求書に目の明細が無い項は、`noReq`（目なし）にする（項は捨てない）。
 */
export function requestOnlyMoku(rows: readonly LifecycleRequestOnlyRow[], details: Readonly<Record<string, BudgetRequestMofDetail>>, mokuCsv: ReadonlyMap<number, string>, sameYear: ReadonlyMap<string, string> = new Map()): Map<string, MokuRequest> {
  const amount = (s: string | undefined): number | null => { const t = (s ?? '').replace(/[\s,]/g, ''); return /^\d+$/.test(t) ? Number(t) : null; };
  const trend = new Map<string, Map<string, { name: string; code: string; amt: number | null }[]>>();
  for (const [year, csv] of mokuCsv) {
    for (const r of readCsv(csv)) {
      const special = r['会計区分'] === '特別';
      const key = [year, special ? 1 : 0, nameKey(special ? r['特別会計'] : r['所管']), nameKey(special ? r['勘定'] : ''), nameKey(special ? '' : r['組織']), nameKey(r['項名'])].join('|');
      const host = (r['要求書'] ?? '').split('__')[0]!;
      const byHost = trend.get(key) ?? trend.set(key, new Map()).get(key)!;
      (byHost.get(host) ?? byHost.set(host, []).get(host)!).push({ name: nameKey(r['目名']), code: reqMokuCode(r['目コード(原文)'] ?? ''), amt: amount(r['要求額_千円']) });
    }
  }
  const out = new Map<string, MokuRequest>();
  for (const r of rows) {
    if (r.req === null) continue;
    const id = sameYear.get(requestOnlyKouId(r)) ?? requestOnlyKouId(r);
    if (out.has(id)) throw new Error(`概算要求のみの項の目が重複: ${id}`);
    if (r.kind === 'noBudget') {
      const byHost = trend.get([r.y, r.acct, nameKey(r.min), nameKey(r.sub), nameKey(r.org), nameKey(r.name)].join('|'));
      if (!byHost) { out.set(id, { m: [], noReq: true }); continue; }
      const best = [...byHost.values()].reduce((a, b) => (b.reduce((s, x) => s + (x.amt ?? 0), 0) > a.reduce((s, x) => s + (x.amt ?? 0), 0) ? b : a));
      out.set(id, { m: pairByName(best, []), noReq: false });
    } else {
      const d = details[[r.y, r.kind, r.acct, r.grp, r.min, r.sub, r.org, r.name].join('|')];
      if (!d) throw new Error(`概算要求のみの項の詳細が無い: ${r.y} ${r.kind} ${r.name}`);
      out.set(id, { m: d.m, noReq: d.noReq === 1 });
    }
  }
  return out;
}
