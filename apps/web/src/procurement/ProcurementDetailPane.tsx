import { useMemo } from 'react';
import { PROCUREMENT_SUM_NOTE, formatSen, procurementTotals, yenText, type ProcurementIndex, type ProcurementListRow } from '@nihon-no-yosan/core';
import { num, td, th } from '../lifecycle/shared.ts';

const MAX_VENDOR_ROWS = 30;
const short = (yen: number): string => (yen === 0 ? '0円' : formatSen(yen / 1000));

/** 選んだ行の、同じ案件番号の行と、同じ落札者の（この年度の）落札の表 */
function RowTable({ rows, current, onSelect, showVendor }: { rows: readonly ProcurementListRow[]; current: number; onSelect: (i: number) => void; showVendor: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th className={`${th} whitespace-nowrap`}>落札決定日</th>
            <th className={th}>{showVendor ? '落札者' : '案件名'}</th>
            <th className={`${th} text-right`}>落札価格</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.i}
              tabIndex={0}
              aria-selected={r.i === current}
              onClick={() => { if (r.i !== current) onSelect(r.i); }}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && r.i !== current) { e.preventDefault(); onSelect(r.i); } }}
              className={`border-t border-neutral-100 dark:border-neutral-800 ${r.i === current ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
            >
              <td className={`${td} whitespace-nowrap tabular-nums`}>{r.date}</td>
              <td className={`${td} break-words`}>{showVendor ? r.vendorName : r.name}</td>
              <td className={num} title={yenText(r.yen)}>{short(r.yen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 落札実績の詳細（右ペイン）。選んだ行の原本の値、同じ案件番号の他の行、同じ落札者のこの年度の落札。
 * 落札者の同定は、法人番号があれば法人番号、なければ名称（原本のまま）。年度をまたぐ集計はしない（読んでいるのは選んだ年度のファイルだけ）。
 */
export function ProcurementDetailPane({ index, row, year, onSelect }: { index: ProcurementIndex; row: ProcurementListRow | null; year: number; onSelect: (i: number) => void }) {
  const sameCase = useMemo(() => (row ? (index.byCase.get(row.caseNo) ?? []).map(i => index.rows[i]!) : []), [index, row]);
  const sameVendor = useMemo(() => (row ? (index.byVendor.get(row.vendorKey) ?? []).map(i => index.rows[i]!) : []), [index, row]);
  const vendorTotals = useMemo(() => procurementTotals(sameVendor), [sameVendor]);
  const vendorTop = useMemo(() => [...sameVendor].sort((a, b) => b.yen - a.yen || a.i - b.i).slice(0, MAX_VENDOR_ROWS), [sameVendor]);
  if (!row) return <p data-pane="detail" tabIndex={-1} className="p-4 text-xs text-neutral-500 outline-0">一覧から落札実績を選んでください。</p>;
  const fact = 'grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5';
  const dt = 'text-neutral-500';
  return (
    <div data-pane="detail" tabIndex={-1} className="flex flex-col gap-5 p-4 text-xs outline-0">
      <div>
        <p className="text-[11px] text-neutral-500">{row.ministryName} · {row.methodName}</p>
        <h2 className="text-base font-semibold">{row.name}</h2>
      </div>

      <section aria-label="原本の値" className="flex flex-col gap-2">
        <h3 className="font-semibold">原本の値（FY{year}）</h3>
        <dl className={fact}>
          <dt className={dt}>落札決定日</dt><dd className="tabular-nums">{row.date}</dd>
          <dt className={dt}>落札価格</dt>
          <dd className="tabular-nums" title="原本の落札価格。単価契約の単価など、総額でない値のことがある（原本の列からは区別できない）">{yenText(row.yen)}<span className="ml-1 text-neutral-400">（{short(row.yen)}）</span></dd>
          <dt className={dt}>調達案件番号</dt><dd className="tabular-nums">{row.caseNo}</dd>
          <dt className={dt}>府省</dt><dd>{row.ministryName}<span className="ml-1 text-neutral-400">（コード {row.ministry}）</span></dd>
          <dt className={dt}>入札方式</dt><dd>{row.methodName}<span className="ml-1 text-neutral-400">（コード {row.method}）</span></dd>
          <dt className={dt}>落札者</dt><dd className="break-words">{row.vendorName}</dd>
          <dt className={dt}>法人番号</dt>
          <dd className="tabular-nums">{row.corp === '' ? <span className="text-neutral-400" title="原本の法人番号が空。理由は原本からは分からない">原本が空</span> : row.corp}</dd>
        </dl>
      </section>

      {sameCase.length > 1 && (
        <section aria-label="同じ案件番号の行" className="flex flex-col gap-2">
          <h3 className="font-semibold" title="同じ調達案件番号の行。複数の落札者・複数回の落札決定などで、行が分かれる">同じ案件番号の行（{sameCase.length}）</h3>
          <RowTable rows={sameCase} current={row.i} onSelect={onSelect} showVendor />
        </section>
      )}

      <section aria-label="同じ落札者の落札" className="flex flex-col gap-2">
        <h3 className="font-semibold">同じ落札者の、FY{year} の落札</h3>
        <p className="text-[11px] text-neutral-500">
          {row.corp !== '' ? `法人番号 ${row.corp} が同じ行` : '法人番号が原本で空のため、名称が同じ行（法人番号のある行とは、つなげていない）'}
          。{vendorTotals.rows.toLocaleString()}行・{vendorTotals.cases.toLocaleString()}案件・落札価格の合計 <span title={`${vendorTotals.yen.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} 円。${PROCUREMENT_SUM_NOTE}`}>{short(vendorTotals.yen)}</span>
        </p>
        <RowTable rows={vendorTop} current={row.i} onSelect={onSelect} showVendor={false} />
        {sameVendor.length > vendorTop.length && <p className="text-[11px] text-neutral-500">落札価格の上位 {vendorTop.length} 行を表示（全 {sameVendor.length.toLocaleString()} 行）。</p>}
      </section>
    </div>
  );
}
