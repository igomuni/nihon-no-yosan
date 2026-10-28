import { useMemo, useState } from 'react';
import { INITIAL_RS_FILTERS, MAX_REGEX_PATTERN_LENGTH, type RsFilters, type RsListRow } from '@nihon-no-yosan/core';
import { MultiSelectCombo, NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { RegexTextFilter } from '../components/RegexTextFilter.tsx';

const section = 'flex flex-col gap-1.5 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800';
const heading = 'text-[11px] font-semibold tracking-wide text-neutral-500';
const row = 'flex cursor-pointer items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200';
const count = 'ml-auto tabular-nums text-neutral-400';

/**
 * 左のフィルタ（中ペインが「RS」のとき）。府省庁・局・庁・事業名と、予算書の項に結べるかどうか。
 * `ministries` は全年度の事業の府省庁（年度を切り替えても選択肢が変わらない）、`rows` は選んだ年度の事業（件数はこれで数える）。
 */
export function RsFilterPane({ ministries, rows, filters, onChange }: { ministries: readonly string[]; rows: readonly RsListRow[]; filters: RsFilters; onChange: (f: RsFilters) => void }) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<RsFilters>) => onChange({ ...filters, ...patch });
  const options = useMemo(() => {
    const now = new Map<string, number>();
    for (const r of rows) now.set(r.ministry, (now.get(r.ministry) ?? 0) + 1);
    const total = new Map<string, number>();
    for (const m of ministries) total.set(m, (total.get(m) ?? 0) + 1);
    return [...total].sort((a, b) => (now.get(b[0]) ?? 0) - (now.get(a[0]) ?? 0) || a[0].localeCompare(b[0], 'ja')).map(([m]) => [m, now.get(m) ?? 0] as [string, number]);
  }, [ministries, rows]);
  const labelOf = new Map(options.map(([m, n]) => [m, `${m}（${n.toLocaleString()}）`]));
  const nameOf = new Map([...labelOf].map(([m, l]) => [l, m]));
  const linked = rows.filter(r => r.kouCount > 0).length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500">フィルタ（RS）</span>
        <button type="button" onClick={() => onChange(INITIAL_RS_FILTERS)} className="rounded border border-neutral-300 px-2 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
          解除
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className={section}>
          <h3 className={heading}>府省庁</h3>
          <MultiSelectCombo
            label="府省庁"
            options={[...labelOf.values()]}
            selected={filters.ministries.map(m => (m === NONE_SELECTED ? m : labelOf.get(m) ?? m))}
            onChange={next => set({ ministries: next.map(l => (l === NONE_SELECTED ? l : nameOf.get(l) ?? l)) })}
            open={open}
            onOpenChange={setOpen}
          />
        </div>
        <div className={`${section} text-xs`}>
          <RegexTextFilter label="局・庁" value={filters.bureau} onChange={bureau => set({ bureau })} useRegex={filters.bureauRegex} onToggleRegex={bureauRegex => set({ bureauRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
          <RegexTextFilter label="事業名" value={filters.name} onChange={name => set({ name })} useRegex={filters.nameRegex} onToggleRegex={nameRegex => set({ nameRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
        </div>
        <fieldset className={section}>
          <legend className={heading}>予算書の項への結び</legend>
          <label className={row}>
            <input type="radio" name="rs-link" checked={filters.link === 'all'} onChange={() => set({ link: 'all' })} />
            すべて
            <span className={count}>{rows.length.toLocaleString()}</span>
          </label>
          <label className={row} title="この年度に、RS の歳出予算項目（項）が、予算書の項に 1 つ以上結べた事業">
            <input type="radio" name="rs-link" checked={filters.link === 'linked'} onChange={() => set({ link: 'linked' })} />
            結べる
            <span className={count}>{linked.toLocaleString()}</span>
          </label>
          <label className={row} title="この年度に、予算書の項に結べた行が無い事業（RS に項の記載が無い、予算書に同じ項が無い、同名の項が複数ある）">
            <input type="radio" name="rs-link" checked={filters.link === 'unlinked'} onChange={() => set({ link: 'unlinked' })} />
            結べない
            <span className={count}>{(rows.length - linked).toLocaleString()}</span>
          </label>
        </fieldset>
      </div>
    </div>
  );
}
