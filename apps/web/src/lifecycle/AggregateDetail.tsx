import { formatSen, type AggMeasure, type AggYear } from '@nihon-no-yosan/core';
import { useYearKeys } from '../components/useListKeys.ts';
import { TrendChart, type TrendPoint, type TrendSeriesKey } from './charts.tsx';
import { num, td, th } from './shared.ts';

/** 年度の表の列と、グラフの系列の名前（画面ごと） */
export interface AggregateColumns {
  /** 表の列（左から） */
  columns: readonly { key: AggMeasure; label: string; title?: string }[];
  /** グラフの折れ線（省略すると 4 つすべて） */
  series?: readonly TrendSeriesKey[];
  labels?: Partial<Record<TrendSeriesKey, string>>;
}

const yen = (v: number | undefined): string => (v === undefined ? '—' : v === 0 ? '0円' : formatSen(v / 1000));

/**
 * 一覧全体の詳細（右ペイン。中ペインの集計行を選んだとき）。今の絞り込みを年度ごとにそのまま掛け、その年度の集計行と同じ足し方で出した額を、グラフと、年度を縦に並べた表で見る。
 * 値の無い所は「—」（0 とは別）。年度を押す・J / K で、中ペインの年度が移る。
 */
export function AggregateDetail({ title, facts, unit, rows, year, spec, onYear }: {
  /** 見出し。一覧の行の数（例: 「1,341項」。中ペインで選んでいる年度） */
  title: string;
  /** 見出しの下に並べる、一覧の内訳（例: 「要求 31所管」「14会計」） */
  facts: readonly string[];
  /** 一覧の行の単位（項・事項・目・事業） */
  unit: string;
  rows: readonly AggYear[];
  /** 中ペインで選んでいる年度 */
  year: number;
  spec: AggregateColumns;
  onYear: (year: number) => void;
}) {
  const years = rows.map(r => r.year);
  useYearKeys(years, years.includes(year) ? year : null, onYear);
  const points: TrendPoint[] = rows.map(r => ({ year: r.year, request: r.values.request, budget: r.values.budget, revised: r.values.revised, spent: r.values.spent, carriedIn: r.values.carriedIn, carried: r.values.carried }));
  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="flex flex-wrap gap-x-3 text-[11px] tabular-nums text-neutral-500">{facts.map(f => <span key={f}>{f}</span>)}</p>
        <h2 className="text-base font-semibold tabular-nums">{title}</h2>
      </div>

      <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
        <h3 className="font-semibold">段階ごとの額</h3>
        <TrendChart points={points} current={year} onSelect={onYear} {...(spec.series ? { series: spec.series } : {})} {...(spec.labels ? { labels: spec.labels } : {})} />
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの額</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                <th className={`${th} whitespace-nowrap text-right`} title={`その年度の、今の絞り込みに合う${unit}の数（中ペインの集計行と同じ）`}>{unit}数</th>
                {spec.columns.map(c => <th key={c.key} className={`${th} whitespace-nowrap text-right`} title={c.title}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const selected = r.year === year;
                return (
                  <tr
                    key={r.year}
                    tabIndex={0}
                    aria-selected={selected}
                    title={selected ? undefined : `FY${r.year} に移る`}
                    onClick={() => { if (!selected) onYear(r.year); }}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onYear(r.year); } }}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                  >
                    <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{r.year}</td>
                    <td className={num}>{r.count.toLocaleString()}</td>
                    {spec.columns.map(c => {
                      const v = r.values[c.key];
                      return <td key={c.key} className={`${num} ${v === undefined ? 'text-neutral-300 dark:text-neutral-600' : ''}`} title={v === undefined ? '値なし' : `${v.toLocaleString('ja-JP')} 円`}>{yen(v)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const KOU_COLUMNS = [
  { key: 'request', label: '要求', title: '概算要求' },
  { key: 'budget', label: '政府案' },
  { key: 'revised', label: '補正後' },
  { key: 'carriedIn', label: '前年度繰越', title: '前年度繰越額（決算）' },
  { key: 'spent', label: '決算', title: '決算（支出済）' },
  { key: 'carried', label: '翌年度繰越', title: '翌年度繰越額（決算）' },
] as const;

/** 項・目（概算要求 → 政府案 → 補正後 → 前年度繰越 → 決算 → 翌年度繰越） */
export const AGG_KOU: AggregateColumns = { columns: KOU_COLUMNS };
/** 事項（決算・繰越額は無い） */
export const AGG_JIKOU: AggregateColumns = { columns: KOU_COLUMNS.slice(0, 3), series: ['request', 'budget', 'revised'] };
/** RS の事業（RS の予算・執行の合計。事業単位の集計で、予算書の数値と一致しない） */
export const AGG_RS: AggregateColumns = {
  columns: [
    { key: 'budget', label: '当初予算' },
    { key: 'revised', label: '歳出予算現額' },
    { key: 'spent', label: '執行額', title: '全事業で 0 の年度は、値なしとして扱う' },
    { key: 'carriedIn', label: '前年度繰越' },
    { key: 'carried', label: '翌年度繰越' },
  ],
  series: ['budget', 'revised', 'spent'],
  labels: { budget: '当初予算', revised: '歳出予算現額', spent: '執行額' },
};
