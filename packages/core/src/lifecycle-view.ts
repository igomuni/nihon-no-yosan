/**
 * 予算の一生の表から、1 つの項（または項の集まり）の「段階ごとの額」「段階ごとの増減」「現額の使われ方」を作る。純粋な関数。
 * 画面のグラフの元になる。仕様（案）: docs/guides/budget-lifecycle.md。金額は円。
 */
import type { LifecycleEventRow, LifecycleMeasure } from './lifecycle.ts';

/** 項目ごとの合計（円）。決算の共管で行が複数あるときは足す。無い項目は含まない */
export type LifecycleValues = Partial<Record<LifecycleMeasure, number>>;

export function lifecycleValues(events: readonly LifecycleEventRow[]): LifecycleValues {
  const v: LifecycleValues = {};
  for (const e of events) v[e[5]] = (v[e[5]] ?? 0) + e[8];
  return v;
}

/** 段階（概算要求・政府案・補正・決算）。画面は、この順・この位置で固定して見せる */
export type LifecycleStage = 'request' | 'budget' | 'supp' | 'settle';
export const LIFECYCLE_STAGES: readonly LifecycleStage[] = ['request', 'budget', 'supp', 'settle'];
export const LIFECYCLE_STAGE_LABEL: Record<LifecycleStage, string> = { request: '概算要求', budget: '政府案', supp: '補正', settle: '決算' };

export interface LifecycleLevel {
  key: LifecycleMeasure;
  label: string;
  /** 観測した額（円）。その段階に値が無いときは null（0 ではない。補完もしない） */
  yen: number | null;
  stage: LifecycleStage;
}

/**
 * 段階ごとの額（水準）。概算要求 → 政府案 → 補正後（改予算額）→ 決算の歳出予算額・歳出予算現額・支出済。
 * 値が無い段階は、柱の代わりに「値なし」の場所（`yen` = null）を 1 つ置く。値は補完しない（補正の記録が無い項に、政府案の額を入れない）。
 */
export function lifecycleLevels(v: LifecycleValues): LifecycleLevel[] {
  const defs: [LifecycleStage, LifecycleMeasure, string][] = [
    ['request', 'request_amount', '概算要求'],
    ['budget', 'budget_amount', '政府案'],
    ['supp', 'revised_amount', '補正後'],
    ['settle', 'appropriation', '決算の歳出予算額'],
    ['settle', 'current_amount', '歳出予算現額'],
    ['settle', 'spent', '支出済'],
  ];
  const out: LifecycleLevel[] = [];
  for (const stage of LIFECYCLE_STAGES) {
    const mine = defs.filter(d => d[0] === stage);
    const have = mine.filter(([, key]) => v[key] !== undefined);
    if (have.length === 0) out.push({ key: mine[0]![1], label: LIFECYCLE_STAGE_LABEL[stage], yen: null, stage });
    else for (const [, key, label] of have) out.push({ key, label, yen: v[key]!, stage });
  }
  return out;
}

export interface LifecycleChange {
  key: string;
  label: string;
  /** 増減（円） */
  yen: number;
  /** 説明（ツールチップ） */
  note: string;
  /** 原因が分かっていない差（補正後 or 政府案と、決算の歳出予算額の差） */
  unexplained?: true;
}

/**
 * 段階ごとの増減。値が 0 の増減は含めず、`zero` に名前を返す。
 * 査定 = 政府案 − 概算要求、補正 = 差引額、組み替え等 = 決算の歳出予算額 − 補正後（補正が無ければ政府案）。
 * 決算の歳出予算額から現額までは、前年度繰越・予備費使用・予算総則の規定による経費増額・流用等・移替。
 */
export function lifecycleChanges(v: LifecycleValues): { changes: LifecycleChange[]; zero: string[] } {
  const all: (LifecycleChange | null)[] = [
    v.request_amount !== undefined && v.budget_amount !== undefined
      ? { key: 'assessment', label: '査定（概算要求 → 政府案）', yen: v.budget_amount - v.request_amount, note: '政府案の額 − 概算要求の額' }
      : null,
    v.supp_net !== undefined ? { key: 'supp', label: '補正', yen: v.supp_net, note: '補正の差引額（追加額 + 修正減少額）' } : null,
    v.appropriation !== undefined && (v.revised_amount ?? v.budget_amount) !== undefined
      ? {
          key: 'rearrange',
          label: v.revised_amount !== undefined ? '組み替え等（原因未確認）' : '政府案との差（補正の記録なし。原因未確認）',
          yen: v.appropriation - (v.revised_amount ?? v.budget_amount)!,
          note: `決算の歳出予算額 − ${v.revised_amount !== undefined ? '補正後の額（改予算額）' : '政府案の額（補正の記録が無いので、政府案と比べた導出の値）'}。原因は確かめていない（項の範囲の違いなどが考えられる）`,
          unexplained: true,
        }
      : null,
    v.carryover_in !== undefined ? { key: 'carryover_in', label: '前年度繰越', yen: v.carryover_in, note: '前年度から繰り越された額' } : null,
    v.reserve_use !== undefined ? { key: 'reserve_use', label: '予備費使用', yen: v.reserve_use, note: '予備費から使った額' } : null,
    v.general_provision !== undefined ? { key: 'general_provision', label: '予算総則の規定による経費増額', yen: v.general_provision, note: '予算総則の規定により増額した額（特別会計）' } : null,
    v.fungible !== undefined ? { key: 'fungible', label: '流用等', yen: v.fungible, note: '流用等による増△減' } : null,
    v.transfer !== undefined ? { key: 'transfer', label: '予算決定後の移替', yen: v.transfer, note: '予算決定後の移替による増△減' } : null,
  ];
  const present = all.filter((c): c is LifecycleChange => c !== null);
  return { changes: present.filter(c => c.yen !== 0), zero: present.filter(c => c.yen === 0).map(c => c.label) };
}

export interface LifecycleUse {
  key: 'spent' | 'carryover_out' | 'unused';
  label: string;
  yen: number;
}

/** 現額の使われ方（支出済・翌年度繰越・不用）。3 つがそろわなければ null。合計は現額に一致する（決算の恒等式） */
export function lifecycleUse(v: LifecycleValues): { parts: LifecycleUse[]; total: number } | null {
  if (v.spent === undefined || v.carryover_out === undefined || v.unused === undefined) return null;
  const parts: LifecycleUse[] = [
    { key: 'spent', label: '支出済', yen: v.spent },
    { key: 'carryover_out', label: '翌年度繰越', yen: v.carryover_out },
    { key: 'unused', label: '不用', yen: v.unused },
  ];
  return { parts, total: parts.reduce((s, p) => s + p.yen, 0) };
}

const OBSERVED_KEYS: [LifecycleMeasure, LifecycleStage, string][] = [
  ['request_amount', 'request', '概算要求'],
  ['budget_amount', 'budget', '政府案'],
  ['revised_amount', 'supp', '補正後（改予算額）'],
  ['appropriation', 'settle', '決算の歳出予算額'],
  ['current_amount', 'settle', '歳出予算現額'],
  ['spent', 'settle', '支出済'],
];

/**
 * 観測額（全体）: 項の集まりの、段階ごとの合計と、その段階に値がある項の数。
 * 段階によって項の集合が違うので、合計どうしの差は、そのまま増減ではない。値は補完しない（補正の記録が無い項は、補正後の合計に入らない）。
 */
export function lifecycleObserved(values: Iterable<LifecycleValues>): { level: LifecycleLevel; kou: number }[] {
  const sum = new Map<LifecycleMeasure, { yen: number; kou: number }>();
  for (const v of values) {
    for (const [key] of OBSERVED_KEYS) {
      if (v[key] === undefined) continue;
      const s = sum.get(key) ?? { yen: 0, kou: 0 };
      s.yen += v[key]!;
      s.kou++;
      sum.set(key, s);
    }
  }
  return OBSERVED_KEYS.flatMap(([key, stage, label]) => (sum.has(key) ? [{ level: { key, label, yen: sum.get(key)!.yen, stage }, kou: sum.get(key)!.kou }] : []));
}

/** 比べる 2 つの項目。同一性の根拠（`basis`）つき */
export interface LifecyclePairSpec {
  id: string;
  from: LifecycleMeasure;
  to: LifecycleMeasure;
  label: string;
  /** どの項を同じ項と見なしたか */
  basis: string;
}

const SAME_KEY = '同じ年度・同じ鍵（所管・組織・項コード・項名。特別会計は特別会計・勘定・項コード・項名）';
export const LIFECYCLE_PAIRS: readonly LifecyclePairSpec[] = [
  { id: 'request-budget', from: 'request_amount', to: 'budget_amount', label: '概算要求 → 政府案', basis: '概算要求は、予算書の項に名前で突合できたもの（突合の状態 MATCHED / NEAR_NAME。統合は足した額）。政府案は予算書の項' },
  { id: 'budget-revised', from: 'budget_amount', to: 'revised_amount', label: '政府案 → 補正後（改予算額）', basis: SAME_KEY },
  { id: 'revised-appropriation', from: 'revised_amount', to: 'appropriation', label: '補正後（改予算額）→ 決算の歳出予算額', basis: SAME_KEY },
  { id: 'budget-appropriation', from: 'budget_amount', to: 'appropriation', label: '政府案 → 決算の歳出予算額', basis: SAME_KEY },
  { id: 'current-spent', from: 'current_amount', to: 'spent', label: '歳出予算現額 → 支出済（決算の中）', basis: '決算の同じ項の行' },
];

export interface LifecyclePairResult {
  spec: LifecyclePairSpec;
  /** 両方の値がある項の数と、その合計 */
  both: number;
  fromSum: number;
  toSum: number;
  /** 差（to − from。円）と、from に対する割合。from が 0 のときは null */
  diff: number;
  rate: number | null;
  /** 片方にしか値が無く、比べられない項の数 */
  fromOnly: number;
  toOnly: number;
}

/** 2 つの項目を、両方の値がある項だけで比べる。片方しか無い項は、数だけ返して合計に入れない */
export function lifecyclePair(values: Iterable<LifecycleValues>, spec: LifecyclePairSpec): LifecyclePairResult {
  const r: LifecyclePairResult = { spec, both: 0, fromSum: 0, toSum: 0, diff: 0, rate: null, fromOnly: 0, toOnly: 0 };
  for (const v of values) {
    const a = v[spec.from], b = v[spec.to];
    if (a !== undefined && b !== undefined) {
      r.both++;
      r.fromSum += a;
      r.toSum += b;
    } else if (a !== undefined) r.fromOnly++;
    else if (b !== undefined) r.toOnly++;
  }
  r.diff = r.toSum - r.fromSum;
  r.rate = r.fromSum !== 0 ? r.diff / r.fromSum : null;
  return r;
}

/** 4 つの段階（概算要求・政府案・補正後・決算の歳出予算額）がすべてそろう項だけの、段階ごとの合計 */
export function lifecycleAllStages(values: Iterable<LifecycleValues>): { kou: number; levels: LifecycleLevel[] } {
  const keys: [LifecycleMeasure, LifecycleStage, string][] = OBSERVED_KEYS.filter(k => ['request_amount', 'budget_amount', 'revised_amount', 'appropriation'].includes(k[0]));
  const sums = keys.map(() => 0);
  let kou = 0;
  for (const v of values) {
    if (keys.some(([key]) => v[key] === undefined)) continue;
    kou++;
    keys.forEach(([key], i) => { sums[i]! += v[key]!; });
  }
  return { kou, levels: keys.map(([key, stage, label], i) => ({ key, label, yen: sums[i]!, stage })) };
}
