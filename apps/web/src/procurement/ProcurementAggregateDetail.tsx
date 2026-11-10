import { PROCUREMENT_SUM_NOTE, formatSen, type ProcurementTrendYear } from '@nihon-no-yosan/core';
import { useYearKeys } from '../components/useListKeys.ts';
import { num, td, th } from '../lifecycle/shared.ts';
import { YearBars } from './YearBars.tsx';

const short = (yen: number): string => (yen === 0 ? '0円' : formatSen(yen / 1000));
const full = (yen: number): string => `${yen.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} 円`;

/**
 * 一覧全体の詳細（右ペイン。中ペインの集計行を選んだとき）。今の絞り込みを、全年度の落札実績にそのまま掛けた集計を、グラフ（落札価格の合計・行数）と、年度を縦に並べた表で見る。
 * 年度のファイルは、集計行を選んだときに、足りない分を読み込む。読み込んでいない年度は「—」（0 とは別）。年度を押す・J / K で、中ペインの年度が移る。
 */
export function ProcurementAggregateDetail({ trend, failed, year, onYear }: {
  trend: readonly ProcurementTrendYear[];
  /** 読み込みに失敗した年度 → 理由 */
  failed: ReadonlyMap<number, string>;
  /** 中ペインで選んでいる年度 */
  year: number;
  onYear: (year: number) => void;
}) {
  const years = trend.map(t => t.year);
  useYearKeys(years, years.includes(year) ? year : null, onYear);
  const loaded = trend.filter(t => t.totals !== null).length;
  const sum = trend.reduce((n, t) => n + (t.totals?.rows ?? 0), 0);
  return (
    <div data-pane="detail" tabIndex={-1} className="flex flex-col gap-5 p-4 text-xs outline-0">
      <div>
        <p className="flex flex-wrap gap-x-3 text-[11px] tabular-nums text-neutral-500">
          <span>{loaded === trend.length ? `全 ${trend.length} 年度を集計` : `${loaded} / ${trend.length} 年度を読み込み済み`}</span>
          <span>{sum.toLocaleString()} 行</span>
        </p>
        <h2 className="text-base font-semibold">一覧全体の年度推移</h2>
        <p className="mt-1 text-[11px] text-neutral-500">今のフィルタを、全年度の落札実績に、そのまま掛けた集計です（選んでいる年度の値は、一覧の集計行と同じ）。</p>
      </div>

      <section className="flex flex-col gap-2" aria-label="落札価格の合計の年度推移">
        <h3 className="font-semibold" title={PROCUREMENT_SUM_NOTE}>落札価格の合計</h3>
        <YearBars label="落札価格の合計" points={trend.map(t => ({ year: t.year, value: t.totals ? t.totals.yen : null, title: t.totals ? full(t.totals.yen) : '未読み込み' }))} current={year} onSelect={onYear} format={short} />
        <p className="text-[11px] text-neutral-500">{PROCUREMENT_SUM_NOTE}。</p>
      </section>

      <section className="flex flex-col gap-2" aria-label="行数の年度推移">
        <h3 className="font-semibold">行数</h3>
        <YearBars label="行数" points={trend.map(t => ({ year: t.year, value: t.totals ? t.totals.rows : null, title: t.totals ? `${t.totals.rows.toLocaleString()} 行` : '未読み込み' }))} current={year} onSelect={onYear} format={v => Math.round(v).toLocaleString()} />
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの集計</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                <th className={`${th} whitespace-nowrap text-right`}>行数</th>
                <th className={`${th} whitespace-nowrap text-right`} title="調達案件番号の種類。同じ案件番号に複数の行があることがある">案件数</th>
                <th className={`${th} whitespace-nowrap text-right`} title="法人番号があれば法人番号、なければ名称が同じものを、同じ落札者として数える。年度をまたいでは数えない（年度ごとの数）">落札者数</th>
                <th className={`${th} whitespace-nowrap text-right`} title={PROCUREMENT_SUM_NOTE}>落札価格の合計</th>
              </tr>
            </thead>
            <tbody>
              {trend.map(({ year: y, totals }) => {
                const selected = y === year;
                const why = failed.get(y);
                const blank = (text: string) => <td className={`${num} text-neutral-300 dark:text-neutral-600`} title={why ? `読み込みに失敗: ${why}` : '未読み込み'}>{text}</td>;
                return (
                  <tr
                    key={y}
                    tabIndex={0}
                    aria-selected={selected}
                    title={selected ? undefined : `FY${y} に移る`}
                    onClick={() => { if (!selected) onYear(y); }}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onYear(y); } }}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                  >
                    <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{y}</td>
                    {totals ? (
                      <>
                        <td className={num}>{totals.rows.toLocaleString()}</td>
                        <td className={num}>{totals.cases.toLocaleString()}</td>
                        <td className={num}>{totals.vendors.toLocaleString()}</td>
                        <td className={num} title={full(totals.yen)}>{short(totals.yen)}</td>
                      </>
                    ) : (
                      <>{blank(why ? '失敗' : '…')}{blank('—')}{blank('—')}{blank('—')}</>
                    )}
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
