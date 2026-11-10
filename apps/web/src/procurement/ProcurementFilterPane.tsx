import { useMemo, useState } from 'react';
import { INITIAL_PROCUREMENT_FILTERS, MAX_REGEX_PATTERN_LENGTH, parseYenInput, type ProcurementFilters, type ProcurementListRow } from '@nihon-no-yosan/core';
import { MultiSelectCombo, NONE_SELECTED } from '../components/MultiSelectCombo.tsx';
import { RegexTextFilter } from '../components/RegexTextFilter.tsx';

const section = 'flex flex-col gap-1.5 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800';
const heading = 'text-[11px] font-semibold tracking-wide text-neutral-500';
const row = 'flex cursor-pointer items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200';
const count = 'ml-auto tabular-nums text-neutral-400';
const input = 'w-full min-w-0 rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900';

type Which = 'ministry' | 'method';

/**
 * 左のフィルタ。府省・入札方式（件数つき。件数は、選んだ年度の全行の数）、案件名・落札者、法人番号の有無、落札価格の範囲。
 * 選択肢は、仕様書の表にあるコードのうち、選んだ年度に行があるものだけ（件数の多い順）。
 */
export function ProcurementFilterPane({ rows, filters, onChange }: { rows: readonly ProcurementListRow[]; filters: ProcurementFilters; onChange: (f: ProcurementFilters) => void }) {
  const [open, setOpen] = useState<Which | null>(null);
  const set = (patch: Partial<ProcurementFilters>) => onChange({ ...filters, ...patch });
  const optionsOf = (code: (r: ProcurementListRow) => string, name: (r: ProcurementListRow) => string) => {
    const n = new Map<string, { name: string; n: number }>();
    for (const r of rows) { const e = n.get(code(r)); if (e) e.n++; else n.set(code(r), { name: name(r), n: 1 }); }
    return [...n].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([c, e]) => ({ code: c, label: `${e.name}（${e.n.toLocaleString()}）` }));
  };
  const ministries = useMemo(() => optionsOf(r => r.ministry, r => r.ministryName), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const methods = useMemo(() => optionsOf(r => r.method, r => r.methodName), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const withCorp = rows.filter(r => r.corp !== '').length;
  const combo = (which: Which, label: string, opts: { code: string; label: string }[], selected: string[], pick: (codes: string[]) => void) => {
    const toLabel = new Map(opts.map(o => [o.code, o.label]));
    const toCode = new Map(opts.map(o => [o.label, o.code]));
    return (
      <div className={section}>
        <h3 className={heading}>{label}</h3>
        <MultiSelectCombo
          label={label}
          options={opts.map(o => o.label)}
          selected={selected.map(c => (c === NONE_SELECTED ? c : toLabel.get(c) ?? c))}
          onChange={next => pick(next.map(l => (l === NONE_SELECTED ? l : toCode.get(l) ?? l)))}
          open={open === which}
          onOpenChange={o => setOpen(o ? which : null)}
        />
      </div>
    );
  };
  const bad = (s: string) => Number.isNaN(parseYenInput(s));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500">フィルタ</span>
        <button type="button" onClick={() => onChange(INITIAL_PROCUREMENT_FILTERS)} className="rounded border border-neutral-300 px-2 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
          解除
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {combo('ministry', '府省', ministries, filters.ministries, ministries => set({ ministries }))}
        {combo('method', '入札方式', methods, filters.methods, methods => set({ methods }))}
        <div className={`${section} text-xs`}>
          <RegexTextFilter label="案件名" value={filters.name} onChange={name => set({ name })} useRegex={filters.nameRegex} onToggleRegex={nameRegex => set({ nameRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
          <RegexTextFilter label="落札者" value={filters.vendor} onChange={vendor => set({ vendor })} useRegex={filters.vendorRegex} onToggleRegex={vendorRegex => set({ vendorRegex })} maxRegexLength={MAX_REGEX_PATTERN_LENGTH} />
        </div>
        <fieldset className={section}>
          <legend className={heading}>法人番号</legend>
          <label className={row}>
            <input type="radio" name="proc-corp" checked={filters.corp === 'all'} onChange={() => set({ corp: 'all' })} />
            すべて
            <span className={count}>{rows.length.toLocaleString()}</span>
          </label>
          <label className={row}>
            <input type="radio" name="proc-corp" checked={filters.corp === 'with'} onChange={() => set({ corp: 'with' })} />
            ある
            <span className={count}>{withCorp.toLocaleString()}</span>
          </label>
          <label className={row} title="原本の法人番号が空の行。空の理由は、原本からは分からない">
            <input type="radio" name="proc-corp" checked={filters.corp === 'without'} onChange={() => set({ corp: 'without' })} />
            原本が空
            <span className={count}>{(rows.length - withCorp).toLocaleString()}</span>
          </label>
        </fieldset>
        <div className={section}>
          <h3 className={heading}>落札価格（円）</h3>
          <div className="flex items-center gap-1.5">
            <input aria-label="落札価格の下限（円）" inputMode="numeric" placeholder="下限" value={filters.minYen} onChange={e => set({ minYen: e.target.value })} className={`${input} ${bad(filters.minYen) ? 'border-red-500' : ''}`} />
            <span className="text-neutral-400">〜</span>
            <input aria-label="落札価格の上限（円）" inputMode="numeric" placeholder="上限" value={filters.maxYen} onChange={e => set({ maxYen: e.target.value })} className={`${input} ${bad(filters.maxYen) ? 'border-red-500' : ''}`} />
          </div>
          {(bad(filters.minYen) || bad(filters.maxYen)) && <p className="text-[11px] text-red-700">数字（カンマ可）で入れてください。</p>}
          <p className="text-[11px] text-neutral-400">例: 100000000（1 億円）。単価契約の単価など、総額でない値も含まれます。</p>
        </div>
      </div>
    </div>
  );
}
