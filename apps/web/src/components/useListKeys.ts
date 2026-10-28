import { useEffect } from 'react';
import { stepSelection } from '@nihon-no-yosan/core';

/** 文字を入れる場所（入力欄・セレクト・編集できる要素）。ここでは J / K を文字として使う */
/** 右ペイン（詳細）にフォーカスがある。ここでは、J / K は年度の切り替え（`useYearKeys`）に使う */
const inDetail = (): boolean => document.activeElement?.closest('[data-pane="detail"]') != null;

export const isTyping = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * 一覧の選択を、キーボードの J（次）・K（前）で動かす。上下の矢印キーは、スクロールのまま（奪わない）。
 * 右ペイン（詳細）にフォーカスがあるときは、年度の切り替えに使うので、効かせない。入力欄などにフォーカスがあるとき、修飾キー（Ctrl・Alt・Meta・Shift）を押しているとき、日本語入力の変換中は効かせない。
 * 選んだ行が無いときは、先頭を選ぶ。端では動かない。行が見える位置への移動は、一覧が選んだ行の変化で行う。
 */
export function useListKeys(length: number, selectedIdx: number, onStep: (idx: number) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key !== 'j' && e.key !== 'k') || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing || isTyping(e.target) || inDetail()) return;
      const next = stepSelection(length, selectedIdx, e.key === 'j' ? 1 : -1);
      if (next === null) return;
      e.preventDefault();
      if (next !== selectedIdx) onStep(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [length, selectedIdx, onStep]);
}

/**
 * 中ペイン（一覧）と右ペイン（詳細）の切り替え: H で一覧、L で詳細にフォーカスを移す（`data-pane="list"`・`data-pane="detail"` の要素）。
 * 上下の矢印キー・Space・PageUp/PageDown は、フォーカスのあるペインをスクロールする。`useListKeys` と同じく、入力欄・修飾キー・日本語入力の変換中は効かせない。
 * フォーカスは、見ている位置をずらさず（`preventScroll`）移す。
 */
export function usePaneKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key !== 'h' && e.key !== 'l') || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing || isTyping(e.target)) return;
      const pane = document.querySelector<HTMLElement>(e.key === 'h' ? '[data-pane="list"]' : '[data-pane="detail"]');
      if (!pane) return;
      e.preventDefault();
      pane.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * 右ペイン（詳細）にフォーカスがあるとき、J で次の年度、K で前の年度に移る（`years` のうち、選んだ年度より後・前で一番近い年度。無ければ動かない）。
 * `useListKeys` と同じく、入力欄・修飾キー・日本語入力の変換中は効かせない。年度を変えて、フォーカスのあった要素が無くなったときは、ペインにフォーカスを戻す。
 */
export function useYearKeys(years: readonly number[], current: number | null, onYear: (year: number) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key !== 'j' && e.key !== 'k') || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing || isTyping(e.target) || current === null) return;
      const pane = document.activeElement?.closest<HTMLElement>('[data-pane="detail"]');
      if (!pane) return;
      e.preventDefault();
      const next = e.key === 'j' ? Math.min(...years.filter(y => y > current)) : Math.max(...years.filter(y => y < current));
      if (!Number.isFinite(next)) return;
      onYear(next);
      requestAnimationFrame(() => { if (!document.activeElement || document.activeElement === document.body) pane.focus({ preventScroll: true }); });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [years, current, onYear]);
}
