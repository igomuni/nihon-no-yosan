import { useMemo } from 'react';
import { MOKU_FLAG, MOKU_REQUEST_COVERAGE_LABEL, mokuFlow, mokuMeasure, mokuSettleNote, mokuSuppNote, mokuValue, type LifecycleKou, type MokuIndex } from '@nihon-no-yosan/core';
import { TrendChart, type TrendPoint } from './charts.tsx';
import { Cell, Marks, YEAR_COLS } from './LifecycleMokuTab.tsx';
import { kouTitle, td, th } from './shared.ts';

/**
 * 目の詳細（右ペイン。中ペインが「目」のとき）。選んだ目の、概算要求・政府案・補正後・決算（支出済）の年度推移を、グラフと、年度を縦に並べた表で見る（事項の詳細と同じ構成）。
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
  const flowYear = (kouId: string): number => kouOf.get(kouId)?.year ?? Number(kouId.split(':')[0]);
  const points: TrendPoint[] = flow.map(({ kouId, node: m }) => {
    const x = m === null ? null : data.nodes[m]!;
    const yen = (key: 'request' | 'budget' | 'revised' | 'spent'): number | undefined => { const v = x ? mokuValue(x, key) : null; return v === null ? undefined : v * 1000; };
    return { year: flowYear(kouId), request: yen('request'), budget: yen('budget'), revised: yen('revised'), spent: yen('spent') };
  });
  const yearNode = (y: number): number | null => flow.find(f => flowYear(f.kouId) === y)?.node ?? null;
  const goYear = (y: number): void => { const m = yearNode(y); if (m !== null && m !== node) onSelectNode(m); };
  const first = flow.length > 0 ? flowYear(flow[0]!.kouId) : n[1];
  const last = flow.length > 0 ? flowYear(flow[flow.length - 1]!.kouId) : n[1];
  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kou ? `${kouTitle(kou)} › ${kou.name}` : ''} · FY{n[1]}</p>
        <h2 className="text-base font-semibold">{n[2]}<Marks n={n} /></h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          確認済みの年度: <b>FY{first}{first === last ? '' : `〜FY${last}`}</b>（{flow.length} 年。項の確定した対応でたどった年度）
          {n[3] && <> · 分類コード: <span className="tabular-nums">{n[3].split('|').join('-')}</span></>}
          {part && <> · 決算の共管: {part}</>}
        </p>
        {kou && (
          <button type="button" onClick={() => onOpenKou(kou)} className="mt-1.5 rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
            この項（{kou.name}）の詳細を開く
          </button>
        )}
      </div>

      <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
        <h3 className="font-semibold">段階ごとの額</h3>
        <TrendChart points={points} current={n[1]} onSelect={goYear} />
        <p className="text-[11px] text-neutral-500">決算は支出済歳出額。値の無い年度は点を描かない（0 とは別）。</p>
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの額と対応</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                <th className={`${th} min-w-[7rem]`}>目名（対応）</th>
                {YEAR_COLS.map(c => <th key={c.key} className={`${th} whitespace-nowrap text-right`} title={mokuMeasure(c.key).label}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {flow.map(({ kouId, node: m, byName }) => {
                const year = flowYear(kouId);
                const current = m === node;
                if (m === null) {
                  // 目のデータが無い年度（予算書が無い）と、項に目はあるが同じ目が無い年度を分ける
                  const why = !data.years.includes(year) ? 'この年度の目は、データに無い（予算書が無い年度）' : moku.kouOf.has(kouId) ? `この年度の項（${kouOf.get(kouId)?.name ?? '—'}）に、同じ目が無い` : `この年度の項（${kouOf.get(kouId)?.name ?? '—'}）の目は、データに無い`;
                  return <tr key={kouId} className="border-t border-neutral-100 dark:border-neutral-800"><td className={`${td} whitespace-nowrap`}>FY{year}</td><td colSpan={YEAR_COLS.length + 1} className={`${td} text-neutral-400`}>{why}</td></tr>;
                }
                const x = data.nodes[m]!;
                return (
                  <tr
                    key={kouId}
                    tabIndex={0}
                    aria-selected={current}
                    title={current ? undefined : `FY${year} を開く`}
                    onClick={() => { if (!current) onSelectNode(m); }}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !current) { e.preventDefault(); onSelectNode(m); } }}
                    className={`border-t border-neutral-100 align-top dark:border-neutral-800 ${current ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                  >
                    <td className={`${td} whitespace-nowrap ${current ? 'font-semibold' : ''}`}>FY{year}</td>
                    <td className={td}>
                      {x[2]}<Marks n={x} />
                      {byName && <span className="block text-[10px] text-neutral-500" title="分類コードが違い、同じ目名で探した">対応: 目名（分類コードが違う）</span>}
                      {!byName && x[3] && <span className="block text-[10px] text-neutral-500">分類コード: {x[3].split('|').join('-')}</span>}
                    </td>
                    {YEAR_COLS.map(c => <Cell key={c.key} data={data} node={m} measure={c.key} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-neutral-500">年度は、項の確定した対応でたどった項の中で、同じ目（目名・分類コード。無ければ同じ目名が 1 つだけの目）を探したもの。目の改称・統合は見ていない。「—」は値なし（ホバーで理由）。</p>
      </section>

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
    </div>
  );
}
