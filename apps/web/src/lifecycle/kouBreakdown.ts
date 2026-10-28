/**
 * 項の詳細の「事項」「目」の選択（チェックボックス付きのコンボボックス）の、選択肢の名前・選択の値・選んだ行。仕様: docs/guides/budget-lifecycle.md
 * 選択の値の約束は、`MultiSelectCombo` と同じ: 空 = すべて、`[NONE_SELECTED]` = なし、それ以外 = 行のキー。
 */
import { formatSen, jikouAmount, mokuMeasure, mokuValue, type JikouIndex, type JikouRow, type LifecycleMokuData, type MokuKouRow } from '@nihon-no-yosan/core';
import { NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { amount, partLabel } from './MokuCells.tsx';

/** 事項の行のキー（同じ項の流れの中で一意。最初の年度と事項名） */
export const jikouRowKey = (r: JikouRow): string => `${r.firstYear}|${r.name}`;
/** 目の行のキー（同じ項の流れの中で一意。目名・共管・最初の年度） */
export const mokuRowKey = (r: MokuKouRow): string => `${r.name}|${r.part}|${Math.min(...r.cells.keys())}`;

const range = (from: number, to: number): string => `FY${from}${from === to ? '' : `〜FY${to}`}`;

/** 同じ表示名には、行の番号を添えて区別する（コンボボックスは文字列で選択肢を持つ） */
function distinct(base: string[]): string[] {
  const seen = new Map<string, number>();
  for (const l of base) seen.set(l, (seen.get(l) ?? 0) + 1);
  return base.map((l, i) => ((seen.get(l) ?? 0) > 1 ? `${l} [${i + 1}]` : l));
}

/** 事項の選択肢の表示名（事項名に、選んだ年度の額 = 政府案、無ければ補正後、概算要求 を添える。その年度に無ければ、事項のある年度の範囲） */
export function jikouLabels(rows: readonly JikouRow[], year: number, jikou: JikouIndex): string[] {
  const hint = (r: JikouRow): string => {
    const c = r.cells.get(year);
    if (!c) return range(r.firstYear, r.lastYear);
    for (const [m, label] of [['budget', '政府案'], ['revised', '補正後'], ['request', '概算要求']] as const) {
      const v = jikouAmount(jikou, c, m);
      if (v !== null) return `FY${year} ${label} ${formatSen(v)}`;
    }
    return range(r.firstYear, r.lastYear);
  };
  return distinct(rows.map(r => `${r.name}${r.renamed ? '（名称が変わった）' : ''} · ${hint(r)}`));
}

/** 目の選択肢の表示名（目名に、選んだ年度の額 = 政府案、無ければ補正後・歳出予算現額・概算要求 を添える。その年度に無ければ、目のある年度の範囲） */
export function mokuLabels(rows: readonly MokuKouRow[], year: number, data: LifecycleMokuData): string[] {
  const hint = (r: MokuKouRow): string => {
    const i = r.cells.get(year);
    if (i !== undefined) {
      for (const key of ['budget', 'revised', 'current', 'request'] as const) {
        const v = mokuValue(data.nodes[i]!, key);
        if (v !== null) return `FY${year} ${mokuMeasure(key).label} ${amount(v)}`;
      }
    }
    const ys = [...r.cells.keys()];
    return range(Math.min(...ys), Math.max(...ys));
  };
  return distinct(rows.map(r => `${r.name}${r.part ? `（共管: ${partLabel(r.part)}）` : ''} · ${hint(r)}`));
}

/** 目の行を、選んだ年度の大きさ（概算要求・政府案・補正後・歳出予算現額の最大）の大きい順に並べる。その年度に無い目は、どこかの年度の大きさの順で後ろに */
export function sortMokuRows(table: readonly MokuKouRow[], data: LifecycleMokuData, year: number): MokuKouRow[] {
  const size = (i: number): number => { const n = data.nodes[i]!; return Math.max(0, n[12] ?? 0, n[5] ?? 0, n[6] ?? 0, n[8] ?? 0); };
  const at = (cells: Map<number, number>, y?: number): number => {
    const vs = (y === undefined ? [...cells.values()] : cells.has(y) ? [cells.get(y)!] : []).map(size);
    return vs.length === 0 ? -1 : Math.max(...vs);
  };
  return [...table].sort((a, b) => at(b.cells, year) - at(a.cells, year) || at(b.cells) - at(a.cells));
}

/** 選んだ行。空 = すべて、`[NONE_SELECTED]` = なし。キーに合う行が 1 つも無いとき（データを作り直したあと）は、すべて */
export function chosenOf<T>(rows: readonly T[], picked: readonly string[], keyOf: (r: T) => string): T[] {
  if (picked.includes(NONE_SELECTED)) return [];
  if (picked.length === 0) return [...rows];
  const set = new Set(picked);
  const sel = rows.filter(r => set.has(keyOf(r)));
  return sel.length > 0 ? sel : [...rows];
}

/** コンボボックスに渡す選択（表示名）。空 = すべて */
export function selectedLabels<T>(rows: readonly T[], labels: readonly string[], picked: readonly string[], chosen: readonly T[]): string[] {
  if (picked.includes(NONE_SELECTED)) return [NONE_SELECTED];
  return picked.length === 0 ? [] : chosen.map(r => labels[rows.indexOf(r)]!);
}

/** コンボボックスの変更（表示名）を、選択の値（行のキー）に直す */
export function pickedFromLabels<T>(next: readonly string[], rows: readonly T[], labels: readonly string[], keyOf: (r: T) => string): string[] {
  if (next.includes(NONE_SELECTED)) return [NONE_SELECTED];
  return next.length === 0 ? [] : next.map(l => keyOf(rows[labels.indexOf(l)]!));
}
