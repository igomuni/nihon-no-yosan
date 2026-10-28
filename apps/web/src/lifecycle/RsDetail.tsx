import { useMemo } from 'react';
import { RS_AMOUNTS, RS_SPENT_UNFILLED_NOTE, formatSen, rsAmountShown, type LifecycleKou, type RsIndex } from '@nihon-no-yosan/core';
import { useYearKeys } from '../components/useListKeys.ts';
import { TrendChart, type TrendPoint } from './charts.tsx';
import { kouTitle, num, td, th } from './shared.ts';

const yen = (v: number | null): string => (v === null ? '—' : v === 0 ? '0円' : formatSen(v / 1000));
const undef = (v: number | null): number | undefined => (v === null ? undefined : v);

/**
 * RS の事業の詳細（右ペイン。中ペインが「RS」のとき）。選んだ事業の、予算・執行の年度推移（グラフと表）と、選んだ年度に結べた予算書の項・目。
 * 値の無い所は「—」（0 とは別）。項に結べた行が無い事業・年度は、その旨を出す。
 */
export function RsDetail({ rs, loading, failed, id, year, kouOf, onYear, onOpenKou }: {
  rs: RsIndex | null;
  loading: boolean;
  failed: boolean;
  /** 選んだ事業の予算事業 ID。選んでいなければ null */
  id: string | null;
  /** 中ペインで選んでいる予算年度 */
  year: number;
  /** 項の id → 項 */
  kouOf: ReadonlyMap<string, LifecycleKou>;
  /** 別の予算年度に移る（中ペインの年度も移る） */
  onYear: (year: number) => void;
  /** 予算書の項を、項の一覧・詳細で開く */
  onOpenKou: (kou: LifecycleKou) => void;
}) {
  const idx = rs && id !== null ? rs.indexOf.get(id) : undefined;
  const rows = useMemo(() => (rs && idx !== undefined ? rs.amountsOf.get(idx) ?? [] : []), [rs, idx]);
  const years = useMemo(() => rows.map(r => r[1]), [rows]);
  useYearKeys(years, idx === undefined ? null : year, onYear);
  const points = useMemo<TrendPoint[]>(() => rows.map(r => ({ year: r[1], request: undefined, budget: undef(rsAmountShown(rs!, r, 'initial')), revised: undef(rsAmountShown(rs!, r, 'current')), spent: undef(rsAmountShown(rs!, r, 'spent')), carriedIn: undef(rsAmountShown(rs!, r, 'carryIn')), carried: undef(rsAmountShown(rs!, r, 'carryOut')) })), [rows, rs]);
  if (failed) return <p className="p-4 text-xs text-red-700">RS の事業の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading || !rs) return <p className="p-4 text-xs text-neutral-500">RS の事業を読み込み中…</p>;
  if (idx === undefined) return <p className="p-4 text-xs text-neutral-500">一覧から事業を選んでください。</p>;
  const [, name, ministry, bureau, major] = rs.data.jigyo[idx]!;
  // 選んだ年度に結べた項・目（項ごと）
  const links = rs.linksOf.get(`${idx}|${year}`) ?? [];
  const byKou = new Map<number, typeof links[number][]>();
  for (const l of links) (byKou.get(l[2]) ?? byKou.set(l[2], []).get(l[2])!).push(l);
  const hasYear = years.includes(year);
  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{ministry}{bureau ? ` › ${bureau}` : ''} · 予算事業 ID {id}</p>
        <h2 className="text-base font-semibold">{name}</h2>
        {major && <p className="mt-0.5 text-[11px] text-neutral-500">主要経費: {major.split('|').join('、')}</p>}
      </div>

      <section className="flex flex-col gap-2" aria-label="予算・執行の年度推移">
        <h3 className="font-semibold" title="RS の予算・執行のサマリ（合計）。2021〜2023 年度は、行革事務局のデータベースから移行したデータで、元が百万円単位のため、正確な額と一致しないことがある">予算・執行の年度推移</h3>
        <TrendChart points={points} current={year} onSelect={onYear} series={['budget', 'revised', 'spent']} labels={{ budget: '当初予算', revised: '歳出予算現額', spent: '執行額' }} />
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの額</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                {RS_AMOUNTS.map(m => <th key={m.key} className={`${th} whitespace-nowrap text-right`}>{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const selected = r[1] === year;
                return (
                  <tr
                    key={r[1]}
                    tabIndex={0}
                    aria-selected={selected}
                    title={selected ? undefined : `FY${r[1]} に移る`}
                    onClick={() => { if (!selected) onYear(r[1]); }}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onYear(r[1]); } }}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                  >
                    <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{r[1]}</td>
                    {RS_AMOUNTS.map(m => {
                      const v = rsAmountShown(rs, r, m.key);
                      const why = m.key === 'spent' && rs.spentUnfilled.has(r[1]) ? RS_SPENT_UNFILLED_NOTE : '値なし（RS の欄が空）';
                      return <td key={m.key} className={`${num} ${v === null ? 'text-neutral-300 dark:text-neutral-600' : ''}`} title={v === null ? why : `${v.toLocaleString('ja-JP')} 円`}>{yen(v)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label="予算書の項・目">
        <h3 className="font-semibold">FY{year} の予算書の項・目</h3>
        {!hasYear && <p className="text-neutral-500">この事業は、FY{year} の RS のデータが無い。</p>}
        {hasYear && byKou.size === 0 && <p className="text-neutral-500">予算書の項に結べた行が無い（RS に項の記載が無い、予算書に同じ項が無い、同名の項が複数ある）。</p>}
        {[...byKou].map(([k, entries]) => {
          const kou = kouOf.get(rs.data.kous[k]!);
          return (
            <div key={k} className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{kou ? <><span className="text-[11px] font-normal text-neutral-500">{kouTitle(kou)} › </span>{kou.name}</> : rs.data.kous[k]}</p>
                {kou && <button type="button" onClick={() => onOpenKou(kou)} className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">この項の詳細を開く</button>}
              </div>
              <table className="mt-1 w-full border-collapse">
                <thead><tr className="text-left"><th className={th}>目</th><th className={th}>予算種別</th><th className={`${th} text-right`}>予算額</th></tr></thead>
                <tbody>
                  {entries.map((l, i) => (
                    <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className={td}>{l[3] || <span className="text-neutral-400">（目の記載なし）</span>}</td>
                      <td className={td}>{l[4] || <span className="text-neutral-400">—</span>}</td>
                      <td className={`${num} ${l[5] === null ? 'text-neutral-300 dark:text-neutral-600' : ''}`} title={l[5] === null ? '値なし' : `${l[5].toLocaleString('ja-JP')} 円`}>{yen(l[5])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>
    </div>
  );
}
