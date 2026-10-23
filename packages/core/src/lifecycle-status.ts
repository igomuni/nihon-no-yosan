/**
 * 予算の一生の表で、段階（概算要求・政府案・補正・決算）ごとに「値があるか、無いならなぜ分かるか」を決める。純粋な関数。
 * 判定は、現行データから確かめられることだけを使う。公式の資料にその項が無いことまでは断定しない。
 * 画面のラベルと、判定の根拠・判定できないケースは docs/guides/lifecycle-status.md。
 */
import type { LifecycleEventRow, LifecycleKou, LifecycleMeasure, LifecycleState } from './lifecycle.ts';
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABEL, type LifecycleStage } from './lifecycle-view.ts';

/** 値が無い理由（確かめられた範囲） */
export type AbsenceReason =
  /** 概算要求書にだけある項: 予算書の項に結べていないので、政府案・補正・決算の値は結んでいない */
  | 'request_only'
  /** 概算要求: 項が政府案に無いので、突合の対象外（突合は政府案の項を対象にする） */
  | 'not_compared'
  /** 概算要求: 同じ年度・同じ所管の政府案の項のうち、突合できた要求の項が 0 件（概算要求書が取り込めていない可能性） */
  | 'scope_empty'
  /** 概算要求: 同じ所管の他の項は突合できているが、この項に対応する要求の項が見つからなかった */
  | 'no_counterpart'
  /** 政府案・補正・決算: その段階の CSV に、同じ年度・同じ鍵の行が無い */
  | 'no_row'
  /** 上のどれにも当たらない、または判定の材料が無い（理由未確定） */
  | 'unknown';

export interface StageAmount {
  measure: LifecycleMeasure;
  label: string;
  yen: number;
  /** 原本の値か、導出した値か（項の金額は目の合計なので、予算書の段階は導出） */
  state: LifecycleState;
  /** 導出・出典の注（目の合計、統合など） */
  note: string;
}

export interface StageStatus {
  stage: LifecycleStage;
  label: string;
  observed: boolean;
  /** 値のある段階の代表の額（概算要求 = 要求額、政府案 = 政府案の額、補正 = 改予算額、決算 = 支出済額） */
  headline: StageAmount | null;
  /** 補助の額（決算の歳出予算額・歳出予算現額、補正の成立予算額・差引額）。代表の額と取り替えない */
  extras: StageAmount[];
  reason: AbsenceReason | null;
  /** 値が無いときの短いラベル */
  badge: string;
  /** 値が無いときの説明（判定の根拠と、断定していないこと） */
  detail: string;
}

const HEADLINE: Record<LifecycleStage, [LifecycleMeasure, string][]> = {
  request: [['request_amount', '要求額']],
  budget: [['budget_amount', '政府案の額']],
  supp: [['revised_amount', '改予算額（補正後）']],
  settle: [['spent', '支出済額']],
};
const EXTRAS: Record<LifecycleStage, [LifecycleMeasure, string][]> = {
  request: [['request_prev', '要求書の前年度予算額']],
  budget: [['budget_prev', '予算書の前年度予算額']],
  supp: [['enacted_amount', '成立予算額'], ['supp_net', '補正の差引額']],
  settle: [['appropriation', '歳出予算額'], ['current_amount', '歳出予算現額']],
};
const STAGE_OF_EVENT: Record<string, LifecycleStage | undefined> = { request: 'request', budget: 'budget', supp: 'supp', settle: 'settle' };

/** 所管ごとの突合の状況（概算要求に突合できた政府案の項の数）と、年度ごとに値のある段階 */
export interface LifecycleCoverage {
  /** `{年度}|{会計}|{所管（特別会計は特別会計名）}` → 政府案の項の数と、概算要求に突合できた項の数 */
  scopes: Map<string, { budget: number; request: number }>;
  /** `{年度}|{会計}` → その年度・会計に値のある段階 */
  stages: Map<string, Set<LifecycleStage>>;
}

export const scopeOf = (k: LifecycleKou): string => `${k.year}|${k.account}|${k.account === 'general' ? k.ministry : k.specialAccount}`;

export function lifecycleCoverage(kous: readonly LifecycleKou[]): LifecycleCoverage {
  const scopes = new Map<string, { budget: number; request: number }>();
  const stages = new Map<string, Set<LifecycleStage>>();
  for (const k of kous) {
    const st = stages.get(`${k.year}|${k.account}`) ?? stages.set(`${k.year}|${k.account}`, new Set()).get(`${k.year}|${k.account}`)!;
    for (const s of k.seenIn) if (s !== 'derived') st.add(s);
    if (!k.seenIn.includes('budget')) continue;
    const c = scopes.get(scopeOf(k)) ?? scopes.set(scopeOf(k), { budget: 0, request: 0 }).get(scopeOf(k))!;
    c.budget++;
    if (k.seenIn.includes('request')) c.request++;
  }
  return { scopes, stages };
}

/** 値が無い理由を決める。判定できる範囲だけ。 */
function absence(stage: LifecycleStage, kou: LifecycleKou, cov: LifecycleCoverage): Pick<StageStatus, 'reason' | 'badge' | 'detail'> {
  if (!cov.stages.get(`${kou.year}|${kou.account}`)?.has(stage)) {
    return { reason: 'unknown', badge: '現行データに値なし（理由未確定）', detail: `この年度・会計では、${LIFECYCLE_STAGE_LABEL[stage]}の値が、現行データのどの項にも入っていない。` };
  }
  const has = (s: LifecycleStage) => kou.seenIn.includes(s);
  if (kou.requestOnly && stage !== 'request') {
    if (kou.requestOnly === 'noBudget') {
      return {
        reason: 'request_only',
        badge: '予算書が無い年度（概算要求のみ）',
        detail: `この年度の予算書は、基準データに無い（概算要求の時点）。${LIFECYCLE_STAGE_LABEL[stage]}の値は、観測していない（0 ではない）。`,
      };
    }
    return {
      reason: 'request_only',
      badge: '予算書に対応なし（概算要求のみ）',
      detail: `この項は概算要求書にだけある（${kou.requestOnly === 'zero' ? '前年度・要求とも 0' : '予算書の項との突合で、名前の候補が見つからなかった'}）。予算書の項に結べていないので、${LIFECYCLE_STAGE_LABEL[stage]}の値は結んでいない（0 ではない）。名称の変更・統合・組み替えなどで見つからない可能性があるが、確かめていない。`,
    };
  }
  if (stage === 'request') {
    if (!has('budget')) {
      return {
        reason: 'not_compared',
        badge: '未照合（突合の対象外）',
        detail: '概算要求との突合は、予算書（政府案）の項を対象に、名前で行っている。この項は政府案に無いので、突合していない。概算要求書にこの項があるかどうかは、確かめていない。',
      };
    }
    const c = cov.scopes.get(scopeOf(kou));
    if (c && c.request === 0) {
      return {
        reason: 'scope_empty',
        badge: '未収録の可能性',
        detail: `この年度のこの所管（${kou.account === 'general' ? kou.ministry : kou.specialAccount}）は、政府案の項 ${c.budget} 件のうち、概算要求に突合できた項が 0 件。概算要求書がこの所管について取り込めていない可能性がある（確認していない）。`,
      };
    }
    return {
      reason: 'no_counterpart',
      badge: '突合で対応なし',
      detail: `政府案のこの項に、名前で対応する概算要求の項が見つからなかった（この所管の他の項は、${c ? `${c.request} / ${c.budget} 件` : '一部'}突合できている）。概算要求書にこの項が無いとは限らない（名称の変更や統合などで、名前では見つからないことがある）。`,
    };
  }
  const where: Record<Exclude<LifecycleStage, 'request'>, [string, string]> = {
    budget: ['政府案の CSV に行なし', '予算書（政府案）の CSV に、同じ年度・同じ鍵（所管・組織・項コード・項名）の項が無い。補正・決算にだけある項（予算の組み替えなど）が考えられるが、確かめていない。公式の資料に項が無かったことまでは分からない。'],
    supp: ['補正の記録なし', '補正予算の CSV に、同じ鍵の項が無い。この項の補正後の額は観測していない（0 ではない）。政府案の額を補正後相当として表示する場合は、導出・表示用で、原本の値ではない。'],
    settle: ['決算の CSV に行なし', '決算の CSV に、同じ鍵の項が無い。決算の値は観測していない（0 ではない）。公式の資料に項が無かったことまでは分からない。'],
  };
  const [badge, detail] = where[stage as Exclude<LifecycleStage, 'request'>];
  return { reason: 'no_row', badge, detail };
}

/** 項の 4 つの段階の状態。順は固定（概算要求 → 政府案 → 補正 → 決算）。`events` はその項の出来事（導出の行は無視する） */
export function lifecycleStageStatuses(kou: LifecycleKou, events: readonly LifecycleEventRow[], cov: LifecycleCoverage): StageStatus[] {
  const byStage = new Map<LifecycleStage, LifecycleEventRow[]>();
  for (const e of events) {
    const s = STAGE_OF_EVENT[e[1]];
    if (s) (byStage.get(s) ?? byStage.set(s, []).get(s)!).push(e);
  }
  const amount = (rows: readonly LifecycleEventRow[], measure: LifecycleMeasure, label: string): StageAmount | null => {
    const mine = rows.filter(e => e[5] === measure);
    if (mine.length === 0) return null;
    return { measure, label, yen: mine.reduce((n, e) => n + e[8], 0), state: mine.some(e => e[9] === 'derived') ? 'derived' : 'original', note: mine[0]![11] };
  };
  return LIFECYCLE_STAGES.map(stage => {
    const rows = byStage.get(stage) ?? [];
    const headline = HEADLINE[stage].map(([m, l]) => amount(rows, m, l)).find(x => x !== null) ?? null;
    if (rows.length === 0 || (!headline && EXTRAS[stage].every(([m, l]) => amount(rows, m, l) === null))) {
      return { stage, label: LIFECYCLE_STAGE_LABEL[stage], observed: false, headline: null, extras: [], ...absence(stage, kou, cov) };
    }
    const extras = EXTRAS[stage].map(([m, l]) => amount(rows, m, l)).filter((x): x is StageAmount => x !== null);
    return { stage, label: LIFECYCLE_STAGE_LABEL[stage], observed: true, headline, extras, reason: null, badge: '', detail: '' };
  });
}

/** 一覧の絞り込み（欠落パターン）。定義は `LIFECYCLE_PATTERNS` */
export type LifecyclePattern = 'all' | 'all_stages' | 'partial' | 'no_budget' | 'request_only' | 'settle_only';

export const LIFECYCLE_PATTERNS: { id: LifecyclePattern; label: string; definition: string }[] = [
  { id: 'all', label: 'すべて', definition: '' },
  { id: 'all_stages', label: '全段階に値あり', definition: '概算要求・政府案・補正・決算のすべてに、この項の値がある' },
  { id: 'partial', label: '一部の段階に値なし', definition: 'どれかの段階に、この項の値が無い（理由は問わない）' },
  { id: 'no_budget', label: '政府案の値なし', definition: '政府案に値が無い（補正・決算にだけある項、概算要求書にだけある項など）' },
  { id: 'request_only', label: '概算要求のみ', definition: '概算要求書にだけある項（予算書の項に結べていない。予算書が基準データに無い年度の項を含む）' },
  { id: 'settle_only', label: '決算の値のみ', definition: '決算にだけ値があり、概算要求・政府案・補正のどれにも値が無い' },
];

export function lifecyclePatternMatches(kou: LifecycleKou, p: LifecyclePattern): boolean {
  const has = (s: LifecycleStage) => kou.seenIn.includes(s);
  switch (p) {
    case 'all': return true;
    case 'all_stages': return LIFECYCLE_STAGES.every(has);
    case 'partial': return !LIFECYCLE_STAGES.every(has);
    case 'no_budget': return !has('budget');
    case 'request_only': return kou.requestOnly !== undefined;
    case 'settle_only': return has('settle') && !has('request') && !has('budget') && !has('supp');
  }
}

export function lifecyclePatternCounts(kous: readonly LifecycleKou[]): Record<LifecyclePattern, number> {
  const out = { all: 0, all_stages: 0, partial: 0, no_budget: 0, request_only: 0, settle_only: 0 } as Record<LifecyclePattern, number>;
  for (const k of kous) for (const p of LIFECYCLE_PATTERNS) if (lifecyclePatternMatches(k, p.id)) out[p.id]++;
  return out;
}
