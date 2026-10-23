import { LIFECYCLE_PATTERNS, type LifecyclePattern } from '@nihon-no-yosan/core';

export type LifecycleAccount = 'all' | 'general' | 'special';

const section = 'flex flex-col gap-1.5 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800';
const heading = 'text-[11px] font-semibold tracking-wide text-neutral-500';
const row = 'flex cursor-pointer items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200';
const count = 'ml-auto tabular-nums text-neutral-400';
const ACCOUNTS: [LifecycleAccount, string][] = [['all', 'すべて'], ['general', '一般会計'], ['special', '特別会計']];

export function LifecycleFilterPane({ query, onQuery, account, onAccount, pattern, onPattern, patternCounts, onReset }: {
  query: string;
  onQuery: (q: string) => void;
  account: LifecycleAccount;
  onAccount: (a: LifecycleAccount) => void;
  pattern: LifecyclePattern;
  onPattern: (p: LifecyclePattern) => void;
  patternCounts: Record<LifecyclePattern, number>;
  onReset: () => void;
}) {
  const current = LIFECYCLE_PATTERNS.find(p => p.id === pattern)!;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500">フィルタ</span>
        <button type="button" onClick={onReset} className="rounded border border-neutral-300 px-2 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">リセット</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className={section}>
          <label className={heading} htmlFor="lifecycle-query">項名・所管・組織</label>
          <input id="lifecycle-query" type="text" value={query} onChange={e => onQuery(e.target.value)} placeholder="検索" className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900" />
        </div>
        <fieldset className={section}>
          <legend className={heading}>会計</legend>
          {ACCOUNTS.map(([a, label]) => (
            <label key={a} className={row}>
              <input type="radio" name="lifecycle-account" checked={account === a} onChange={() => onAccount(a)} />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className={section}>
          <legend className={heading}>値のある段階</legend>
          {LIFECYCLE_PATTERNS.map(p => (
            <label key={p.id} title={p.definition || undefined} className={row}>
              <input type="radio" name="lifecycle-pattern" checked={pattern === p.id} onChange={() => onPattern(p.id)} />
              {p.label}
              <span className={count}>{patternCounts[p.id].toLocaleString()}</span>
            </label>
          ))}
          {pattern !== 'all' && <p className="text-[11px] text-neutral-500">{current.definition}。理由が分かっているかどうかは問わない。</p>}
          <p className="text-[11px] text-neutral-500">件数は、年度・会計・検索で絞った項の数。</p>
        </fieldset>
      </div>
    </div>
  );
}
