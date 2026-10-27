import { useMemo } from 'react';
import { MOKU_FLAG, MOKU_REQUEST_COVERAGE_LABEL, formatSen, mokuFlow, mokuSettleNote, mokuSuppNote, type LifecycleKou, type MokuIndex } from '@nihon-no-yosan/core';
import { kouTitle, num, td, th } from './shared.ts';

/**
 * 目の詳細（右ペイン。中ペインが「目」のとき）。選んだ目の、年度ごとの概算要求・政府案・補正・決算を表で見る。
 * 年度の流れは、項の確定した対応でたどった項の中で、同じ目（目名・分類コード。無ければ同じ目名が 1 つだけの目）を探したもの。目の改称・統合は見ていない。
 * 値の無い所は「—」（0 とは別）で、理由を添える。
 */
export function LifecycleMokuDetail({ moku, loading, failed, node, kouOf, chainKouIds, onSelectNode, onOpenKou }: {
  moku: MokuIndex | null;
  loading: boolean;
  failed: boolean;
  /** 選んだ目（`nodes` の添字）。選んでいなければ null */
  node: number | null;
  /** 項の id → 項 */
  kouOf: ReadonlyMap<string, LifecycleKou>;
  /** 選んだ目の項を通る、確定した対応でたどった項の id（年度の古い順） */
  chainKouIds: readonly string[];
  /** 流れの別の年度の目に移る（年度も移る） */
  onSelectNode: (node: number) => void;
  /** その目がある項を、項の一覧・詳細で開く */
  onOpenKou: (kou: LifecycleKou) => void;
}) {
  const flow = useMemo(() => (moku && node !== null ? mokuFlow(moku, node, chainKouIds) : []), [moku, node, chainKouIds]);
  if (failed) return <p className="p-4 text-xs text-red-700">目の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading || !moku) return <p className="p-4 text-xs text-neutral-500">目を読み込み中…</p>;
  if (node === null) return <p className="p-4 text-xs text-neutral-500">一覧から目を選んでください。</p>;
  const { data } = moku;
  const n = data.nodes[node]!;
  const kou = kouOf.get(data.kous[n[0]]!);
  const coverage = moku.coverageOf.get(data.kous[n[0]]!);
  const suppWhy = mokuSuppNote(data, n), settleWhy = mokuSettleNote(data, n);
  const part = n[4].replace(/#\d+$/, '').split('|').filter(Boolean).join(' / ');
  const cell = (v: number | null, why?: string | null) => (v === null
    ? <td className={`${num} text-neutral-300 dark:text-neutral-600`} title={why ?? '値なし'}>—</td>
    : <td className={num} title={`${v.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} 千円`}>{v === 0 ? '0円' : formatSen(v)}</td>);
  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kou ? `${kouTitle(kou)} › ${kou.name}` : ''} · FY{n[1]}</p>
        <h2 className="text-base font-semibold">{n[2]}</h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          {n[3] && <>分類コード: <span className="tabular-nums">{n[3].split('|').join('-')}</span></>}
          {part && <> · 決算の共管: {part}</>}
        </p>
        {kou && (
          <button type="button" onClick={() => onOpenKou(kou)} className="mt-1.5 rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
            この項（{kou.name}）の詳細を開く
          </button>
        )}
      </div>

      <section className="flex flex-col gap-1.5" aria-label="この年度の注記">
        <h3 className="font-semibold">FY{n[1]} の注記</h3>
        <ul className="list-disc space-y-0.5 pl-4 text-neutral-600 dark:text-neutral-300">
          {suppWhy && <li>補正: {suppWhy}</li>}
          {settleWhy && <li>決算: {settleWhy}</li>}
          {n[13] & MOKU_FLAG.requestOnly ? <li>概算要求書にだけある目（予算書の目に、名前で結べなかった）。名前の違う予算書の目と同じものかは、確かめていない</li> : null}
          {n[13] & MOKU_FLAG.nameOnly ? <li>段階の間で分類コードが違い、目名だけで結んだ（その項で、この目名の目が 1 つだけ）</li> : null}
          {data.requestYears.includes(n[1]) && <li>概算要求の目の取れ方（この項）: {coverage ? MOKU_REQUEST_COVERAGE_LABEL[coverage] : '概算要求書の項と突合できていない項'}</li>}
          {!data.requestYears.includes(n[1]) && <li>この年度の概算要求の目は、データに無い</li>}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-label="年度ごとの額">
        <h3 className="font-semibold">年度ごとの額</h3>
        <p className="text-[11px] text-neutral-500">項の確定した対応でたどった年度。同じ目は、目名と分類コードで探し、無ければ同じ目名が 1 つだけの目（「名前」）。目の改称・統合は見ていない。行を選ぶと、その年度の目に移る。</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th className={th}>年度</th>
                <th className={`${th} text-right`}>概算要求</th>
                <th className={`${th} text-right`}>政府案</th>
                <th className={`${th} text-right`}>補正後</th>
                <th className={`${th} text-right`}>補正差引</th>
                <th className={`${th} text-right`}>歳出予算現額</th>
                <th className={`${th} text-right`}>支出済</th>
                <th className={`${th} text-right`}>翌年度繰越</th>
                <th className={`${th} text-right`}>不用額</th>
              </tr>
            </thead>
            <tbody>
              {flow.map(({ kouId, node: m, byName }) => {
                const year = kouOf.get(kouId)?.year ?? Number(kouId.split(':')[0]);
                if (m === null) {
                  // 目のデータが無い年度（予算書が無い）と、項に目はあるが同じ目が無い年度を分ける
                  const why = !data.years.includes(year) ? 'この年度の目は、データに無い（予算書が無い年度）' : moku.kouOf.has(kouId) ? `この年度の項（${kouOf.get(kouId)?.name ?? '—'}）に、同じ目が無い` : `この年度の項（${kouOf.get(kouId)?.name ?? '—'}）の目は、データに無い`;
                  return <tr key={kouId} className="border-b border-neutral-100 dark:border-neutral-800"><td className={`${td} whitespace-nowrap`}>FY{year}</td><td colSpan={8} className={`${td} text-neutral-400`}>{why}</td></tr>;
                }
                const x = data.nodes[m]!;
                const current = m === node;
                return (
                  <tr key={kouId} onClick={() => { if (!current) onSelectNode(m); }} className={`border-b border-neutral-100 dark:border-neutral-800 ${current ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}>
                    <td className={`${td} whitespace-nowrap`}>FY{year}{byName && <span className="ml-1 text-[10px] text-neutral-400" title="分類コードが違い、同じ目名で探した">名前</span>}</td>
                    {cell(x[12])}
                    {cell(x[5])}
                    {cell(x[6], mokuSuppNote(data, x))}
                    {cell(x[7], mokuSuppNote(data, x))}
                    {cell(x[8], mokuSettleNote(data, x))}
                    {cell(x[9], mokuSettleNote(data, x))}
                    {cell(x[10], mokuSettleNote(data, x))}
                    {cell(x[11], mokuSettleNote(data, x))}
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
