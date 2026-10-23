/**
 * チェックボックス付きの複数選択コンボボックス。見た目はボタン→ドロップダウン（portal）→クリック外で閉じる。
 * 挙動はふつうの全選択: 個別のチェックは実際の選択と連動し、
 * 「すべて選択/解除」は、すべて選択中なら全部外し（なし）、それ以外なら全部選ぶ。
 * 選択の値（呼び出し側との約束）: 空配列 = すべて（絞り込みなし）、[NONE_SELECTED] = なし（0 件）、それ以外 = 選んだものだけ。
 * 個別のチェックで全部そろったら空配列（すべて）に、全部外したら [NONE_SELECTED]（なし）にする。
 *
 * 開閉状態は呼び出し側が持つ（controlled）。複数のコンボを独立に開閉させると、片方の外側クリックでもう片方のボタンをまたぐときに紛らわしいので、
 * どれが開いているかを呼び出し側で一元管理し、開くときに他を閉じる。
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.tsx';

/** 「なし」（すべて解除）を表す値。選択の配列は、空 = すべて、この値だけ = なし（0 件）、それ以外 = 選んだものだけ */
export const NONE_SELECTED = '__none__';

export interface MultiSelectComboProps {
  label: string;
  options: string[];
  /** 空配列は「すべて」（絞り込みなし）、[NONE_SELECTED] は「なし」 */
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function MultiSelectCombo({ label, options, selected, onChange, disabled, open, onOpenChange }: MultiSelectComboProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const none = selected.includes(NONE_SELECTED);
  // 実際に選ばれている選択肢（すべて = 全部、なし = 空）
  const effective = none ? [] : selected.length === 0 ? options : options.filter(o => selected.includes(o));
  const allSelected = !none && (selected.length === 0 || options.every(o => selected.includes(o)));
  const displayLabel = none ? 'なし（0件）' : allSelected ? `すべて（${options.length}）` : effective.length === 1 ? effective[0] : `選択中（${effective.length}/${options.length}）`;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    const recompute = () => {
      if (buttonRef.current) {
        const r = buttonRef.current.getBoundingClientRect();
        setRect({ top: r.bottom + 2, left: r.left, width: r.width, maxHeight: Math.max(120, window.innerHeight - r.bottom - 16) });
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, onOpenChange]);

  // 全部そろえば「すべて」（空配列）、全部外せば「なし」に正規化する
  const emit = (next: string[]) => onChange(next.length === 0 ? [NONE_SELECTED] : options.every(o => next.includes(o)) ? [] : next);
  function toggle(option: string) {
    emit(effective.includes(option) ? effective.filter(o => o !== option) : [...effective, option]);
  }
  const toggleAll = () => onChange(allSelected ? [NONE_SELECTED] : []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!open && buttonRef.current) {
            const r = buttonRef.current.getBoundingClientRect();
            setRect({ top: r.bottom + 2, left: r.left, width: r.width, maxHeight: Math.max(120, window.innerHeight - r.bottom - 16) });
          }
          onOpenChange(!open);
        }}
        className={`flex w-full items-center justify-between gap-1 truncate rounded border border-neutral-300 bg-white px-2 py-1 text-xs disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 ${
          allSelected ? 'text-neutral-400' : none ? 'text-red-700 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-200'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <Icon name={open ? 'arrow_drop_up' : 'arrow_drop_down'} size={16} className="shrink-0 text-neutral-400" />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
            className="z-[9999] overflow-y-auto rounded border border-neutral-300 bg-white text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            onMouseDown={e => e.stopPropagation()}
          >
            <label className="flex cursor-pointer items-center gap-1.5 border-b border-neutral-200 px-2 py-1.5 font-semibold dark:border-neutral-800">
              <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = !allSelected && !none; }} onChange={toggleAll} className="h-3 w-3" />
              <span>すべて選択/解除</span>
            </label>
            {options.map(o => (
              <label key={o} className="flex cursor-pointer items-center gap-1.5 px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <input type="checkbox" checked={effective.includes(o)} onChange={() => toggle(o)} className="h-3 w-3 shrink-0" />
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
