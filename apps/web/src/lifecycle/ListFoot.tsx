import { formatSen, sumAmounts } from '@nihon-no-yosan/core';

/** 集計行の 1 マス。`title` はホバーの説明 */
export interface FootCell {
  text: string;
  title?: string;
}

/** 額の列の合計のマス。`unit` は 1 千円にあたる値の倍数（千円の列は 1、円の列は 1000）。値のある行が無ければ「—」 */
export function sumCell(values: Iterable<number | null | undefined>, unit: 'sen' | 'yen', loading = false): FootCell {
  if (loading) return { text: '…', title: '読み込み中' };
  const { sum, n } = sumAmounts(values);
  if (sum === null) return { text: '—', title: '値のある行が無い' };
  return { text: sum === 0 ? '0円' : formatSen(unit === 'yen' ? sum / 1000 : sum), title: `値のある ${n.toLocaleString()} 行の合計（${sum.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} ${unit === 'yen' ? '円' : '千円'}）。値なしの行は足さない` };
}

/**
 * 一覧の集計行（見出しの下。見出しと一緒に固定する。`<thead>` の中に置く）。一覧に出ている全行（表示の上限を超えた分も含む）の、種類の数と額の合計。
 * `cols` は一覧の列と同じ並びで、`cells` に無い列は空。
 */
export function ListFoot({ cols, cells, selected, onSelect }: { cols: readonly { key: string; left?: boolean }[]; cells: Partial<Record<string, FootCell>>; /** 集計行を選んでいるか（選ぶと、右ペインに一覧全体の年度推移） */ selected: boolean; onSelect: () => void }) {
  return (
    <tr
        data-row-key="summary"
        tabIndex={0}
        aria-selected={selected}
        title="選ぶと、右ペインに一覧全体の年度推移"
        onClick={onSelect}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        className="cursor-pointer"
      >
        {cols.map(c => {
          const cell = cells[c.key];
          return (
            <td
              key={c.key}
              title={cell?.title}
              className={`overflow-hidden whitespace-nowrap border-b border-neutral-300 px-2 py-1.5 font-semibold tabular-nums text-neutral-700 dark:border-neutral-600 dark:text-neutral-200 ${selected ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'} ${c.left ? 'text-left' : 'text-right'}`}
            >
              {cell?.text}
            </td>
          );
        })}
    </tr>
  );
}
