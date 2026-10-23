import { LIFECYCLE_STAGES, formatSen, type LifecycleKou, type LifecycleStage } from '@nihon-no-yosan/core';
import { kouTitle } from './shared.ts';

const BADGE: Record<LifecycleStage, string> = { request: '要', budget: '政', supp: '補', settle: '決' };
const LIMIT = 400;

/** 項の一覧。額の大きい順（現額・政府案・要求額のうち最大）。要・政・補・決は、値がある段階（薄い字は値なし） */
export function LifecycleListPane({ items, selectedId, onSelect }: { items: { k: LifecycleKou; size: number }[]; selectedId: string | null; onSelect: (k: LifecycleKou) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-500 dark:border-neutral-800">
        <span className="tabular-nums">{items.length.toLocaleString()} 項</span> · 額の大きい順 · 要 = 概算要求、政 = 政府案、補 = 補正、決 = 決算 の値がある段階
      </p>
      <ul className="min-h-0 flex-1 overflow-auto">
        {items.slice(0, LIMIT).map(({ k, size }) => (
          <li key={k.id}>
            <button type="button" onClick={() => onSelect(k)} aria-pressed={selectedId === k.id} className={`flex w-full flex-col gap-0.5 border-b border-neutral-100 px-3 py-1.5 text-left text-xs dark:border-neutral-800 ${selectedId === k.id ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{k.name}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">{formatSen(size / 1000)}</span>
              </span>
              <span className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                <span className="truncate">{kouTitle(k)}</span>
                <span className="shrink-0 font-mono">
                  {LIFECYCLE_STAGES.map(s => (
                    <span key={s} className={k.seenIn.includes(s) ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-300 dark:text-neutral-600'}>{BADGE[s]}</span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        ))}
        {items.length > LIMIT && <li className="px-3 py-2 text-xs text-neutral-500">上位 {LIMIT} 項を表示。フィルタで絞ってください。</li>}
      </ul>
    </div>
  );
}
