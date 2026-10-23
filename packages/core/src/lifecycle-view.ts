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

export interface LifecycleLevel {
  key: LifecycleMeasure;
  label: string;
  yen: number;
}

/** 段階ごとの額（水準）。概算要求 → 政府案 → 補正後 → 決算の歳出予算額 → 歳出予算現額 → 支出済。値が無い段階は飛ばす */
export function lifecycleLevels(v: LifecycleValues): LifecycleLevel[] {
  const defs: [LifecycleMeasure, string][] = [
    ['request_amount', '概算要求'],
    ['budget_amount', '政府案'],
    ['revised_amount', '補正後'],
    ['appropriation', '決算の歳出予算額'],
    ['current_amount', '歳出予算現額'],
    ['spent', '支出済'],
  ];
  return defs.flatMap(([key, label]) => (v[key] === undefined ? [] : [{ key, label, yen: v[key]! }]));
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
          label: '組み替え等（原因未確認）',
          yen: v.appropriation - (v.revised_amount ?? v.budget_amount)!,
          note: `決算の歳出予算額 − ${v.revised_amount !== undefined ? '補正後の額（改予算額）' : '政府案の額'}。項の範囲の違い（予算の組み替え）などが考えられるが、確かめていない`,
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

/**
 * 項の集まり（絞り込んだ一覧）の、段階ごとの合計と、その段階に値がある項の数。
 * 段階によって項の集合が違う（決算にだけある項など）ので、**政府案がある項だけ**を数える。
 * 補正後は、補正の行が無い項は政府案と同額として足す（補正の無い項は、決算の歳出予算額が政府案と全件一致する。`budget-lifecycle.md`）。
 */
export function lifecycleTotals(byKou: Iterable<readonly LifecycleEventRow[]>): { level: LifecycleLevel; kou: number }[] {
  const sum = new Map<LifecycleMeasure, { yen: number; kou: number }>();
  const keys: LifecycleMeasure[] = ['request_amount', 'budget_amount', 'revised_amount', 'appropriation', 'current_amount', 'spent'];
  for (const events of byKou) {
    const v = lifecycleValues(events);
    if (v.budget_amount === undefined) continue;
    if (v.revised_amount === undefined) v.revised_amount = v.budget_amount;
    for (const k of keys) {
      if (v[k] === undefined) continue;
      const s = sum.get(k) ?? { yen: 0, kou: 0 };
      s.yen += v[k]!;
      s.kou++;
      sum.set(k, s);
    }
  }
  const label: Record<string, string> = { request_amount: '概算要求', budget_amount: '政府案', revised_amount: '補正後', appropriation: '決算の歳出予算額', current_amount: '歳出予算現額', spent: '支出済' };
  return keys.flatMap(k => (sum.has(k) ? [{ level: { key: k, label: label[k]!, yen: sum.get(k)!.yen }, kou: sum.get(k)!.kou }] : []));
}
