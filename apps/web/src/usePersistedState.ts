import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * 状態を localStorage に保存する。初回は保存値（なければ既定値）で始め、更新のたびに書く。
 * 読み書きに失敗しても（プライベートモードなど）、画面は既定値のまま動く。キーは固定で使う。
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultValue : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // 保存できなくても動く
    }
  }, [key, state]);
  return [state, setState];
}
