import { useMemo, useState } from 'react';
import {
  INITIAL_LIFECYCLE_FILTERS,
  LIFECYCLE_JOINT,
  LIFECYCLE_PATTERNS,
  MAX_REGEX_PATTERN_LENGTH,
  lifecycleAcctOf,
  lifecycleGroupsOf,
  lifecycleIsJoint,
  lifecycleIsPublishedJoint,
  lifecyclePublishersOf,
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
export function LifecycleFilterPane({ allKous, inYear, patternCounts, unsettledCount, filters, onChange }: {
  /** 全年度の項（選択肢を年度で変えないため） */
  allKous: readonly LifecycleKou[];
  inYear: readonly LifecycleKou[];
  patternCounts: Record<LifecyclePattern, number>;
  /** 対応が確定していない項の数（所管〜項名で絞った項のうち） */
  unsettledCount: number;
  filters: LifecycleFilters;
  onChange: (f: LifecycleFilters) => void;
}) {
  const tally = (names: readonly string[]) => { const m = new Map<string, number>(); for (const n of names) m.set(n, (m.get(n) ?? 0) + 1); return m; };
  // 選択肢（要求所管・予算所管・会計）は全年度の項から作り、年度を切り替えても変わらない（並びは全年度の件数順）。件数だけ、選択年度の項で数える
  const options = (all: readonly string[], names: (k: LifecycleKou) => readonly string[], rank?: (n: string) => number): [string, number][] => {
    const total = tally(all);
    const now = tally(inYear.flatMap(names));
    return [...total].sort((x, y) => (rank ? rank(x[0]) - rank(y[0]) : 0) || y[1] - x[1]).map(([n]) => [n, now.get(n) ?? 0] as [string, number]);
  };
  const groups = useMemo(() => {
    const list = options(allKous.flatMap(lifecycleGroupsOf), lifecycleGroupsOf);
    return allKous.some(lifecycleIsJoint) ? [...list, [LIFECYCLE_JOINT, inYear.filter(lifecycleIsJoint).length] as [string, number]] : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKous, inYear]);
  const accts = useMemo(() => options(allKous.map(lifecycleAcctOf), k => [lifecycleAcctOf(k)], n => (n === '一般会計' ? 0 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allKous, inYear]);
  const publishers = useMemo(() => {
    const list = options(allKous.flatMap(k => [...lifecyclePublishersOf(k)]), k => [...lifecyclePublishersOf(k)]);
    return allKous.some(lifecycleIsPublishedJoint) ? [...list, [LIFECYCLE_JOINT, inYear.filter(lifecycleIsPublishedJoint).length] as [string, number]] : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKous, inYear]);
  const [open, setOpen] = useState<'publisher' | 'group' | 'acct' | null>(null);
  const set = (patch: Partial<LifecycleFilters>) => onChange({ ...filters, ...patch });
  // コンボの選択肢は「名称（件数）」。選択状態は名称で持つ（選んだのにこの年度に無い名前も、件数 0 の選択肢に残す）
  const comboProps = (entries: [string, number][], selected: string[], key: 'publishers' | 'groups' | 'accts', field: 'publisher' | 'group' | 'acct') => {
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
          <h3 className={heading}>要求所管</h3>
          <MultiSelectCombo label="要求所管" {...comboProps(publishers, filters.publishers, 'publishers', 'publisher')} />
        </div>
        <div className={section}>
          <h3 className={heading}>予算所管</h3>
          <MultiSelectCombo label="予算所管" {...comboProps(groups, filters.groups, 'groups', 'group')} />
        </div>
        <div className={section}>
          <h3 className={heading}>会計</h3>
          <MultiSelectCombo label="会計" {...comboProps(accts, filters.accts, 'accts', 'acct')} />
        </div>
        <div className={`${section} text-xs`}>
          <RegexTextFilter label="組織／勘定" value={filters.org} onChange={org => set({ org })} useRegex={filters.orgRegex} onToggleRegex={orgRegex => set({ orgRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
          <RegexTextFilter label="項名" value={filters.name} onChange={name => set({ name })} useRegex={filters.nameRegex} onToggleRegex={nameRegex => set({ nameRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
          <RegexTextFilter label="事項名" value={filters.jikouName} onChange={jikouName => set({ jikouName })} useRegex={filters.jikouNameRegex} onToggleRegex={jikouNameRegex => set({ jikouNameRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
          <RegexTextFilter label="目名" value={filters.mokuName} onChange={mokuName => set({ mokuName })} useRegex={filters.mokuNameRegex} onToggleRegex={mokuNameRegex => set({ mokuNameRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
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
        </fieldset>
        <fieldset className={section}>
          <legend className={heading}>年度をまたぐ対応</legend>
          <label className={row}>
            <input type="radio" name="lifecycle-links" checked={filters.links === 'all'} onChange={() => set({ links: 'all' })} />
            すべて
          </label>
          <label className={row} title="前後の年度の項との対応が、確定（RESOLVED）していない項。候補はあるが根拠がそろわない項と、候補が無い項">
            <input type="radio" name="lifecycle-links" checked={filters.links === 'unsettled'} onChange={() => set({ links: 'unsettled' })} />
            対応未確定
            <span className={count}>{unsettledCount.toLocaleString()}</span>
          </label>
        </fieldset>
      </div>
    </div>
  );
}
