import { Icon } from './Icon.tsx';

/** 年度の選択。見た目はナビのボタンに揃える */
export function YearSelect({ value, onChange, years }: { value: string; onChange: (year: string) => void; years: readonly (string | number)[] }) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="年度"
        className="h-9 cursor-pointer appearance-none rounded-lg border border-black/10 bg-white/90 pl-2.5 pr-7 text-xs text-neutral-700 shadow-md backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-200"
      >
        {years.map(y => (
          <option key={y} value={String(y)}>{y}年度</option>
        ))}
      </select>
      <Icon name="arrow_drop_down" size={20} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}
