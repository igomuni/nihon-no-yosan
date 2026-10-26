/**
 * 補正予算の追加額と、翌年度の概算要求の額が近い項を見つける部品。純粋な関数。仕様: docs/guides/supp-request-pairs.md
 *
 * 入力は、予算の一生の表（`lifecycle-cli.ts` の `kou.csv`・`events.csv`・`links.csv` を読んだ行）。
 * 年度をまたぐ対応が RESOLVED で、相手が 1 つに決まる項について、補正追加額（Y 年度）と、翌年度（Y+1）の概算要求の額・増額分（要求額 − 要求書の前年度予算額）を比べる。
 */
import type { Rec } from './csv.ts';

/** 一致とみなす幅（±5%） */
export const SUPP_REQUEST_TOLERANCE = 0.05;
/** 補正が主財源とみなす倍率（補正追加額 ≥ 当初予算 × 2） */
export const SUPP_MAIN_RATIO = 2;
/** 要求が当初予算を上回るとみなす倍率（要求額 > 当初予算 × 1.1） */
export const SUPP_ABOVE_BUDGET_RATIO = 1.1;

export const SUPP_REQUEST_CLASSES = [
  '要求が前年度予算に近い',
  '当初予算0で補正と要求が一致',
  '補正追加額が当初予算に近い',
  '補正が主財源で、要求は補正後予算と同水準',
  '要求が補正後予算と同水準',
  '要求が補正追加額と同額で、当初予算を上回る',
  '補正追加額に近いが、補正後予算とも当初予算とも離れる',
] as const;
export type SuppRequestClass = (typeof SUPP_REQUEST_CLASSES)[number];

export type SuppRequestMatch = '要求増額' | '要求額' | '要求増額+要求額';

export interface SuppRequestPair {
  /** 補正の年度（Y） */
  year: number;
  /** 補正年度の項（kou.csv の行） */
  kou: Rec;
  /** 翌年度の項の kou_id */
  nextKouId: string;
  /** 補正追加額（円） */
  suppAdd: number;
  /** 翌年度の概算要求額（円） */
  request: number;
  /** 翌年度の概算要求書の前年度予算額（円） */
  requestPrev: number;
  /** 要求額 − 要求書の前年度予算額（円） */
  requestIncrease: number;
  match: SuppRequestMatch;
  exact: boolean;
  /** 補正追加額と、一致した値（増額分があればそちら、無ければ要求額）の差（%、小数 2 桁） */
  diffPct: number;
  /** 補正年度の当初予算（円）。無ければ null */
  budget: number | null;
  /** 補正年度の補正後予算（円）。無ければ null */
  revised: number | null;
  /** 翌年度の当初予算（円）。無ければ null */
  nextBudget: number | null;
  /** 翌年度の補正追加額（円）。無ければ null */
  nextSuppAdd: number | null;
  /** 要求額と補正後予算の差（%、小数 1 桁）。補正後予算が無い・0 なら null */
  requestVsRevisedPct: number | null;
  requestNearPrev: boolean;
  requestNearBudget: boolean;
  suppNearBudget: boolean;
  budgetZero: boolean;
  class: SuppRequestClass;
}

const near = (a: number | null, b: number | null): boolean => a !== null && b !== null && b !== 0 && Math.abs(a - b) <= SUPP_REQUEST_TOLERANCE * Math.abs(b);

/** 型を決める。上から順に当てはめ、最初に当たったものとする */
export function classifySuppRequest(p: { suppAdd: number; request: number; requestPrev: number; budget: number | null; revised: number | null }): SuppRequestClass {
  const { suppAdd: s, request: q, requestPrev: prev, budget: b0, revised } = p;
  if (near(q, prev) || near(q, b0)) return SUPP_REQUEST_CLASSES[0];
  if (b0 === 0) return SUPP_REQUEST_CLASSES[1];
  if (near(s, b0)) return SUPP_REQUEST_CLASSES[2];
  if (near(q, revised)) return b0 === null || s >= SUPP_MAIN_RATIO * b0 ? SUPP_REQUEST_CLASSES[3] : SUPP_REQUEST_CLASSES[4];
  if (near(q, s) && b0 !== null && q > SUPP_ABOVE_BUDGET_RATIO * b0) return SUPP_REQUEST_CLASSES[5];
  return SUPP_REQUEST_CLASSES[6];
}

/** 補正追加額が、翌年度の要求額・増額分のどちらかと ±5% 以内の項を返す。年度、所管、組織、項コードの順 */
export function suppRequestPairs(kous: readonly Rec[], events: readonly Rec[], links: readonly Rec[]): SuppRequestPair[] {
  const kouById = new Map(kous.map(k => [k.kou_id!, k]));
  // 項ごとの、出来事 × 測る量 → 円（同じ組は 1 行しかない）
  const amounts = new Map<string, Map<string, number>>();
  for (const e of events) {
    if (e.value_yen === '' || e.value_yen === undefined) continue;
    const id = e.kou_id!;
    const m = amounts.get(id) ?? new Map<string, number>();
    const key = `${e.event}.${e.measure}`;
    m.set(key, (m.get(key) ?? 0) + Number(e.value_yen));
    amounts.set(id, m);
  }
  const next = new Map<string, string[]>();
  for (const l of links) {
    if (l.status !== 'RESOLVED' || !l.to_kou_id) continue;
    const to = next.get(l.from_kou_id!) ?? [];
    to.push(l.to_kou_id);
    next.set(l.from_kou_id!, to);
  }

  const out: SuppRequestPair[] = [];
  for (const [fromId, tos] of next) {
    if (tos.length !== 1) continue;
    const toId = tos[0]!;
    const kou = kouById.get(fromId);
    const m = amounts.get(fromId);
    const n = amounts.get(toId);
    if (!kou || !m || !n) continue;
    const s = m.get('supp.supp_add') ?? 0;
    const q = n.get('request.request_amount');
    if (s <= 0 || q === undefined) continue;
    const prev = n.get('request.request_prev') ?? 0;
    const d = q - prev;
    const hitIncrease = d > 0 && Math.abs(s - d) <= SUPP_REQUEST_TOLERANCE * d;
    const hitAmount = q > 0 && Math.abs(s - q) <= SUPP_REQUEST_TOLERANCE * q;
    if (!hitIncrease && !hitAmount) continue;
    const ref = hitIncrease ? d : q;
    const budget = m.get('budget.budget_amount') ?? null;
    const revised = m.get('supp.revised_amount') ?? null;
    out.push({
      year: Number(kou.year),
      kou,
      nextKouId: toId,
      suppAdd: s,
      request: q,
      requestPrev: prev,
      requestIncrease: d,
      match: hitIncrease && hitAmount ? '要求増額+要求額' : hitIncrease ? '要求増額' : '要求額',
      exact: s === d || s === q,
      diffPct: Math.round(((s - ref) / ref) * 10000) / 100,
      budget,
      revised,
      nextBudget: n.get('budget.budget_amount') ?? null,
      nextSuppAdd: n.get('supp.supp_add') ?? null,
      requestVsRevisedPct: revised ? Math.round(((q - revised) / revised) * 1000) / 10 : null,
      requestNearPrev: near(q, prev),
      requestNearBudget: near(q, budget),
      suppNearBudget: near(s, budget),
      budgetZero: budget === 0,
      class: classifySuppRequest({ suppAdd: s, request: q, requestPrev: prev, budget, revised }),
    });
  }
  const key = (p: SuppRequestPair): string => [p.kou.ministry, p.kou.org, p.kou.code].join('\n');
  return out.sort((a, b) => a.year - b.year || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
