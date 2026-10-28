import { useEffect } from 'react';
import { stepSelection } from '@nihon-no-yosan/core';

/** 文字を入れる場所（入力欄・セレクト・編集できる要素）。ここでは J / K を文字として使う */
const isTyping = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * 一覧の選択を、キーボードの J（次）・K（前）で動かす。上下の矢印キーは、スクロールのまま（奪わない）。
 * 入力欄などにフォーカスがあるとき、修飾キー（Ctrl・Alt・Meta・Shift）を押しているとき、日本語入力の変換中は効かせない。
 * 選んだ行が無いときは、先頭を選ぶ。端では動かない。行が見える位置への移動は、一覧が選んだ行の変化で行う。
 */
export function useListKeys(length: number, selectedIdx: number, onStep: (idx: number) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key !== 'j' && e.key !== 'k') || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing || isTyping(e.target)) return;
      const next = stepSelection(length, selectedIdx, e.key === 'j' ? 1 : -1);
      if (next === null) return;
      e.preventDefault();
      if (next !== selectedIdx) onStep(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [length, selectedIdx, onStep]);
}
