import { useState } from 'react';
import { Icon } from './Icon.tsx';

/** 画面の一覧。`#/{id}` で切り替える */
export const PAGES = [
  { id: 'trend', label: '概算要求 年度推移' },
  { id: 'mof', label: '概算要求と当初予算' },
  { id: 'lifecycle', label: '予算の一生の表（試作）' },
  { id: 'about', label: '出典と利用条件' },
] as const;

export type PageId = (typeof PAGES)[number]['id'];

/** ページ切替のメニュー。年度の選択はページごとに持つので、各ページ側で隣に並べる */
export function PageNavMenu({ current }: { current: PageId }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="ページ切替メニュー"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white/90 text-neutral-600 shadow-md backdrop-blur hover:bg-white dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Icon name="menu" size={18} />
      </button>
      {open && (
        <>
          {/* メニュー外クリックで閉じる */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-black/10 bg-white/95 p-1 text-xs shadow-lg backdrop-blur dark:border-white/10 dark:bg-neutral-900/95">
            {PAGES.map(item => {
              const isCurrent = item.id === current;
              return (
                <a
                  key={item.id}
                  href={`#/${item.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${isCurrent ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10'}`}
                >
                  {item.label}
                  {isCurrent && <Icon name="check" size={14} />}
                </a>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}
