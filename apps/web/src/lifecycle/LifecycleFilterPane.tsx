import { useMemo, useState } from 'react';
import {
  INITIAL_LIFECYCLE_FILTERS,
  LIFECYCLE_PATTERNS,
  MAX_REGEX_PATTERN_LENGTH,
  lifecycleAcctOf,
  lifecycleGroupOf,
  type LifecycleFilters,
  type LifecycleKou,
  type LifecyclePattern,
} from '@nihon-no-yosan/core';
import { MultiSelectCombo, NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { RegexTextFilter } from '../components/RegexTextFilter.tsx';

const section = 'flex flex-col gap-1.5 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800';
const heading = 'text-[11px] font-semibold tracking-wide text-neutral-500';
const row = 'flex cursor-pointer items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200';
const count = 'ml-auto tabular-nums text-neutral-400';

/**
 * 左のフィルタ（概算要求と当初予算の画面と同じ構成）。
 * `inYear` は選択年度の項。段階ごとの件数は、所管・会計・組織・項名で絞った項（`narrowed`）で数える。
 */
export function LifecycleFilterPane({ inYear, patternCounts, filters, onChange }: {
  inYear: readonly LifecycleKou[];
  patternCounts: Record<LifecyclePattern, number>;
  filters: LifecycleFilters;
  onChange: (f: LifecycleFilters) => void;
}) {
  const tally = (names: string[]) => { const m = new Map<string, number>(); for (const n of names) m.set(n, (m.get(n) ?? 0) + 1); return m; };
  const groups = useMemo(() => [...tally(inYear.map(lifecycleGroupOf))].sort((a, b) => b[1] - a[1]), [inYear]);
  const accts = useMemo(() => [...tally(inYear.map(lifecycleAcctOf))].sort((a, b) => (a[0] === '一般会計' ? -1 : b[0] === '一般会計' ? 1 : b[1] - a[1])), [inYear]);
  const [open, setOpen] = useState<'group' | 'acct' | null>(null);
  const set = (patch: Partial<LifecycleFilters>) => onChange({ ...filters, ...patch });
  // コンボの選択肢は「名称（件数）」。選択状態は名称で持つ（選んだのにこの年度に無い名前も、件数 0 の選択肢に残す）
  const comboProps = (entries: [string, number][], selected: string[], key: 'groups' | 'accts', field: 'group' | 'acct') => {
    const all: [string, number][] = [...entries, ...selected.filter(v => v !== NONE_SELECTED && !entries.some(([n]) => n === v)).map(v => [v, 0] as [string, number])];
    const labelOf = new Map(all.map(([name, n]) => [name, `${name}（${n.toLocaleString()}）`]));
    const nameOf = new Map([...labelOf].map(([name, label]) => [label, name]));
    return {
      options: [...labelOf.values()],
      selected: selected.map(v => (v === NONE_SELECTED ? v : labelOf.get(v) ?? v)),
      onChange: (next: string[]) => set({ [key]: next.map(l => (l === NONE_SELECTED ? l : nameOf.get(l) ?? l)) } as Partial<LifecycleFilters>),
      open: open === field,
      onOpenChange: (o: boolean) => setOpen(o ? field : open === field ? null : open),
    };
  };
  const current = LIFECYCLE_PATTERNS.find(p => p.id === filters.pattern)!;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500">フィルタ</span>
        <button type="button" onClick={() => onChange(INITIAL_LIFECYCLE_FILTERS)} className="rounded border border-neutral-300 px-2 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
          解除
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className={section}>
          <h3 className={heading}>所管</h3>
          <MultiSelectCombo label="所管" {...comboProps(groups, filters.groups, 'groups', 'group')} />
          <p className="text-[11px] text-neutral-500">特別会計は、所管をデータから決められないので「{'（特別会計）'}」にまとめる。</p>
        </div>
        <div className={section}>
          <h3 className={heading}>会計</h3>
          <MultiSelectCombo label="会計" {...comboProps(accts, filters.accts, 'accts', 'acct')} />
        </div>
        <div className={`${section} text-xs`}>
          <RegexTextFilter label="組織／勘定" value={filters.org} onChange={org => set({ org })} useRegex={filters.orgRegex} onToggleRegex={orgRegex => set({ orgRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
          <RegexTextFilter label="項名" value={filters.name} onChange={name => set({ name })} useRegex={filters.nameRegex} onToggleRegex={nameRegex => set({ nameRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
        </div>
        <fieldset className={section}>
          <legend className={heading}>値のある段階</legend>
          {LIFECYCLE_PATTERNS.map(p => (
            <label key={p.id} title={p.definition || undefined} className={row}>
              <input type="radio" name="lifecycle-pattern" checked={filters.pattern === p.id} onChange={() => set({ pattern: p.id })} />
              {p.label}
              <span className={count}>{patternCounts[p.id].toLocaleString()}</span>
            </label>
          ))}
          {filters.pattern !== 'all' && <p className="text-[11px] text-neutral-500">{current.definition}。理由が分かっているかどうかは問わない。</p>}
          <p className="text-[11px] text-neutral-500">件数は、上の条件で絞った項の数。</p>
        </fieldset>
      </div>
    </div>
  );
}
