/**
 * 予算の一生の画面の「事項」タブ用のデータ（`lifecycle/jikou.json.gz`）。仕様: docs/guides/lifecycle-jikou.md
 *
 * 事項（当初予算・補正。`jikou-links.ts`）と、概算要求の事項（`mof-ui.ts` が項ごとに名前でつないだ結果、概算要求にだけある項の事項）を、予算の一生の表の項（`LifecycleKou`）にぶら下げる。
 * 項の鍵は、年度・会計・所管（特別会計は特別会計）・組織（特別会計は勘定）・項コード・項名を `nameKey` でそろえたもの。確定した（`RESOLVED`）対応だけを持つ。項に結べない事項は捨てず、数えて返す。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  JIKOU_AMOUNT,
  jikouEvidenceMask,
  linkExtrasByKou,
  linkSuppOnly,
  nameKey,
  readCsv,
  type BudgetRequestMofDetail,
  type JikouLink,
  type JikouNode,
  type LifecycleJikouData,
  type LifecycleJikouLink,
  type LifecycleJikouNode,
  type LifecycleKou,
  type LifecycleLink,
} from '@nihon-no-yosan/core';
import type { LifecycleRequestOnlyRow } from './lifecycle.ts';
import { MOF_UI_VERSIONS } from './mof-ui.ts';

const kouKey = (year: number, account: string, a: string, b: string, code: string, name: string): string => [year, account, nameKey(a), nameKey(b), code, nameKey(name)].join('|');
const keyOfKou = (k: LifecycleKou): string => (k.account === 'general' ? kouKey(k.year, k.account, k.ministry, k.org, k.code, k.name) : kouKey(k.year, k.account, k.specialAccount, k.subAccount, k.code, k.name));
const keyOfNode = (n: JikouNode): string => (n.account === 'general' ? kouKey(n.year, n.account, n.ministry, n.org, n.itemCode, n.itemName) : kouKey(n.year, n.account, n.specialAccount, n.subAccount, n.itemCode, n.itemName));

/** 概算要求の事項（要求側）。`mof-ui` の結果と、概算要求にだけある項の事項 */
export interface LifecycleJikouRequest {
  /** 対応ありの予算書の項（`LifecycleKou.id`）→ その項の事項 [名前, コード, 要求額, 予算書の額]（名前でつないだ結果）。要求側の内訳が取れていない項は `noReq` */
  matched: ReadonlyMap<string, { j: readonly (readonly [string, string, number | null, number | null])[]; noReq: boolean }>;
  /** 概算要求にだけある項（`LifecycleKou.id`）→ その項の要求側の事項 */
  requestOnly: ReadonlyMap<string, readonly { name: string; req: number | null }[]>;
}

export interface LifecycleJikouBuild {
  data: LifecycleJikouData;
  /** 項に結べなかった事項の数（年度ごと）。予算書の事項と概算要求の事項の合計 */
  unmatched: Record<number, number>;
  /** 予算書の事項に置けなかった、つないだ行の要求額（名前でつないだ事項の予算書側が見つからない）の数 */
  unplaced: number;
}

/** 対応ありの予算書の項の行（`mof-ui` の `{年度}|kou-{会計}:{行}`）→ 予算の一生の表の項の id。行は、予算書の項の CSV のデータ行の 1 始まり */
export function mofRowKouIds(datasetDir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [year, ver] of MOF_UI_VERSIONS) {
    for (const account of ['general', 'special'] as const) {
      const rows = readCsv(fs.readFileSync(path.join(datasetDir, 'mof-archive', ver, `kou-${account}.csv`), 'utf8'));
      rows.forEach((r, i) => {
        const key = (account === 'general' ? [r['所管'], r['組織'], r['項コード'], r['項名']] : [r['特別会計'], r['勘定'], r['項コード'], r['項名']]).map(x => x ?? '').join('|');
        out.set(`${year}|kou-${account}:${i + 1}`, `${year}:${account}:${key}`);
      });
    }
  }
  return out;
}

export function buildLifecycleJikou(
  input: { years: readonly number[]; nodes: readonly JikouNode[]; suppOnly?: readonly JikouNode[]; links: readonly JikouLink[] },
  kous: readonly LifecycleKou[],
  kouLinks: readonly LifecycleLink[] = [],
  request?: LifecycleJikouRequest,
): LifecycleJikouBuild {
  const idByKey = new Map<string, string>();
  const kouById = new Map<string, LifecycleKou>();
  for (const k of kous) {
    kouById.set(k.id, k);
    if (k.requestOnly) continue; // 概算要求のみの項は、予算書の事項が無い
    const key = keyOfKou(k);
    if (idByKey.has(key)) throw new Error(`項の鍵が重なる: ${key}`);
    idByKey.set(key, k.id);
  }
  const unmatched: Record<number, number> = {};
  const miss = (year: number): void => { unmatched[year] = (unmatched[year] ?? 0) + 1; };

  // 予算書の事項（当初予算）と、補正にだけある事項。順は、当初予算、補正にだけある事項、概算要求にだけある事項
  const all: JikouNode[] = [];
  const kouOfAll: string[] = [];
  const request7: (number | null)[] = [];
  const remap = new Map<number, number>(); // 入力の事項（当初予算）の添字 → all の添字
  const place = (n: JikouNode, kouId: string, req: number | null): number => { all.push(n); kouOfAll.push(kouId); request7.push(req); return all.length - 1; };
  input.nodes.forEach((n, i) => {
    const id = idByKey.get(keyOfNode(n));
    if (id === undefined) { miss(n.year); return; }
    remap.set(i, place(n, id, null));
  });
  const nBudget = all.length;
  for (const n of input.suppOnly ?? []) {
    const id = idByKey.get(keyOfNode(n));
    if (id === undefined) { miss(n.year); continue; }
    place(n, id, null);
  }

  // 概算要求の事項
  const requestRead = new Set<string>();
  let unplaced = 0;
  if (request) {
    const placed = new Map<string, number>(); // `${項}|${名前}` → all の添字（予算書の事項）
    const unitOfKou = new Map<string, JikouNode>(); // 項 → その項の予算書の事項（所属・項の識別をそろえるため）
    for (let i = 0; i < nBudget; i++) {
      placed.set(`${kouOfAll[i]}|${all[i]!.name}`, i);
      if (!unitOfKou.has(kouOfAll[i]!)) unitOfKou.set(kouOfAll[i]!, all[i]!);
    }
    const extra = (k: LifecycleKou, name: string, req: number): void => {
      const base = unitOfKou.get(k.id);
      const n: JikouNode = base
        ? { ...base, name, budget: null, prev: null, revised: undefined, suppNet: undefined }
        : { year: k.year, account: k.account, ministry: k.account === 'general' ? nameKey(k.ministry) : '', specialAccount: nameKey(k.specialAccount), subAccount: nameKey(k.subAccount), org: nameKey(k.org), itemCode: k.code, itemName: nameKey(k.name), name, budget: null, prev: null };
      place(n, k.id, req);
    };
    for (const [id, { j, noReq }] of request.matched) {
      const k = kouById.get(id);
      if (!k) { miss(Number(id.split(':')[0])); continue; }
      if (noReq) continue;
      requestRead.add(id);
      for (const [name, , req, bud] of j) {
        if (req === null) continue;
        if (bud !== null) {
          const at = placed.get(`${id}|${name}`);
          if (at === undefined) { unplaced++; continue; }
          request7[at] = req;
        } else extra(k, name, req);
      }
    }
    for (const [id, items] of request.requestOnly) {
      const k = kouById.get(id);
      if (!k) { miss(Number(id.split(':')[0])); continue; }
      requestRead.add(id);
      for (const { name, req } of items) if (req !== null) extra(k, name, req);
    }
  }

  // 対応。当初予算の事項の対応（`links`）に、補正にだけある事項・概算要求にだけある事項の対応を足す（同じ鍵、続けて項の対応で結ぶ）
  const links: JikouLink[] = [];
  for (const l of input.links) {
    if (l.status !== 'RESOLVED' || l.from < 0 || l.to < 0) continue;
    const a = remap.get(l.from), b = remap.get(l.to);
    if (a !== undefined && b !== undefined) links.push({ ...l, from: a, to: b });
  }
  const extras = all.slice(nBudget);
  const byKey = linkSuppOnly(all.slice(0, nBudget), extras, links);
  links.push(...byKey);
  const kouPairs: [string, string][] = [];
  for (const l of kouLinks) if (l.status === 'RESOLVED' && l.from >= 0 && l.to >= 0) kouPairs.push([kous[l.from]!.id, kous[l.to]!.id]);
  links.push(...linkExtrasByKou(all, nBudget, kouOfAll, kouPairs, links));

  // 出力（事項のある項だけを `kous` に入れる。添字は最初に使われた順）
  const kouIds: string[] = [];
  const indexOfId = new Map<string, number>();
  const nodes: LifecycleJikouNode[] = all.map((n, i) => {
    const id = kouOfAll[i]!;
    let k = indexOfId.get(id);
    if (k === undefined) { k = kouIds.length; kouIds.push(id); indexOfId.set(id, k); }
    return [k, n.year, n.name, n.budget, n.prev, n.revised ?? null, n.suppNet ?? null, request7[i] ?? null];
  });
  const outLinks: LifecycleJikouLink[] = links.map(l => [l.from, l.to, jikouEvidenceMask(l.evidence), JIKOU_AMOUNT.indexOf(l.amount)]);
  const years = [...new Set(nodes.map(n => n[1]))].sort((a, b) => a - b);
  const read = [...requestRead].flatMap(id => (indexOfId.has(id) ? [indexOfId.get(id)!] : [])).sort((a, b) => a - b);
  return { data: { years, kous: kouIds, nodes, links: outLinks, requestRead: read }, unmatched, unplaced };
}

/** 概算要求にだけある項（`LifecycleKou.id`。鍵は `lifecycle.ts` と同じ）。要求額が読めない行は、項にならない */
const requestOnlyKouId = (r: LifecycleRequestOnlyRow): string => `${r.y}:${r.acct === 0 ? 'general' : 'special'}:${['request', r.min, r.sub, r.org, r.name].join('|')}`;

/**
 * 概算要求にだけある項の、要求側の事項。予算書に突合できなかった項（`reqOnly`・`zero`）は `mof-ui` の詳細の行（`mofRowKey`）から、予算書が基準データに無い年度の項（`noBudget`）は
 * 年度推移の事項（`trend-detail` の `jikou.csv`）から取る。後者は、同じ項が複数の要求書に載るとき、要求額の合計が最も大きい公開元（要求書の先頭のドメイン）の事項だけを使う（`mof-ui` の統合と同じ考え方）。
 */
export function requestOnlyJikou(rows: readonly LifecycleRequestOnlyRow[], details: Readonly<Record<string, BudgetRequestMofDetail>>, jikouCsv: string): Map<string, { name: string; req: number | null }[]> {
  const amount = (s: string | undefined): number | null => { const t = (s ?? '').replace(/[\s,]/g, ''); return /^\d+$/.test(t) ? Number(t) : null; };
  const trend = new Map<string, Map<string, { name: string; req: number | null }[]>>();
  for (const r of readCsv(jikouCsv)) {
    const special = r['会計区分'] === '特別';
    const key = [r['年度'], special ? 1 : 0, nameKey(special ? r['特別会計'] : r['所管']), nameKey(special ? r['勘定'] : ''), nameKey(special ? '' : r['組織']), nameKey(r['項名'])].join('|');
    const host = (r['要求書'] ?? '').split('__')[0]!;
    const byHost = trend.get(key) ?? trend.set(key, new Map()).get(key)!;
    (byHost.get(host) ?? byHost.set(host, []).get(host)!).push({ name: nameKey(r['事項名']), req: amount(r['要求額_千円']) });
  }
  const out = new Map<string, { name: string; req: number | null }[]>();
  for (const r of rows) {
    if (r.req === null) continue;
    if (r.kind === 'noBudget') {
      const byHost = trend.get([r.y, r.acct, nameKey(r.min), nameKey(r.sub), nameKey(r.org), nameKey(r.name)].join('|'));
      if (!byHost) continue;
      const best = [...byHost.values()].reduce((a, b) => (b.reduce((s, x) => s + (x.req ?? 0), 0) > a.reduce((s, x) => s + (x.req ?? 0), 0) ? b : a));
      out.set(requestOnlyKouId(r), best);
    } else {
      const d = details[[r.y, r.kind, r.acct, r.grp, r.min, r.sub, r.org, r.name].join('|')];
      if (d) out.set(requestOnlyKouId(r), d.j.map(([name, , req]) => ({ name, req })));
    }
  }
  return out;
}
