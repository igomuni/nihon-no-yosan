import type { LifecycleKou } from '@nihon-no-yosan/core';

export const kouTitle = (k: LifecycleKou): string => (k.account === 'general' ? `${k.ministry} › ${k.org}` : `${k.specialAccount}特別会計${k.subAccount ? ` › ${k.subAccount}` : ''}`);
export const yen = (n: number): string => n.toLocaleString('ja-JP');
export const th = 'px-2 py-1 font-medium text-neutral-500';
export const td = 'px-2 py-1';
export const num = 'whitespace-nowrap px-2 py-1 text-right tabular-nums';
