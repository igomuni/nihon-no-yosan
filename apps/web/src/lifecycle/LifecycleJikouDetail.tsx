import { useMemo } from 'react';
import { jikouChainNodes, jikouRowOf, type JikouIndex, type JikouTable, type LifecycleKou } from '@nihon-no-yosan/core';
import { useYearKeys } from '../components/useListKeys.ts';
import { JikouChart, JikouYearTable } from './JikouViews.tsx';
import { kouTitle } from './shared.ts';

/**
 * 事項の詳細（右ペイン。中ペインが「事項」のとき）。選んだ事項を通る、年度をまたぐ 1 本の流れ（確定した対応だけ。項が変わった年度も含む）の、概算要求・政府案・補正後を、グラフと、年度を縦に並べた表で見る。
 * 事項に決算は無い。値の無い所は「—」（0 とは別）。
 */
export function LifecycleJikouDetail({ jikou, loading, failed, node, kouOf, onSelectNode, onOpenKou }: {
  jikou: JikouIndex | null;
  loading: boolean;
  failed: boolean;
  /** 選んだ事項（`nodes` の添字）。選んでいなければ null */
  node: number | null;
  /** 項の id → 項 */
  kouOf: ReadonlyMap<string, LifecycleKou>;
  /** 流れの別の年度の事項に移る（年度も移る） */
  onSelectNode: (node: number) => void;
  /** その事項がある項を、項の一覧・詳細で開く */
  onOpenKou: (kou: LifecycleKou) => void;
}) {
  const flow = useMemo(() => (jikou && node !== null ? jikouChainNodes(jikou, node) : []), [jikou, node]);
  const table = useMemo<JikouTable | null>(() => (jikou && node !== null ? { years: flow.map(n => jikou.data.nodes[n]![1]), rows: [jikouRowOf(jikou, node)] } : null), [jikou, node, flow]);
  const flowYears = useMemo(() => (jikou ? flow.map(n => jikou.data.nodes[n]![1]) : []), [jikou, flow]);
  useYearKeys(flowYears, jikou && node !== null ? jikou.data.nodes[node]![1] : null, y => { const m = flow[flowYears.indexOf(y)]; if (m !== undefined && m !== node) onSelectNode(m); });
  if (failed) return <p className="p-4 text-xs text-red-700">事項の読み込みに失敗しました（<code>npm run build:data</code> で作る）。</p>;
  if (loading || !jikou) return <p className="p-4 text-xs text-neutral-500">事項を読み込み中…</p>;
  if (node === null || !table) return <p className="p-4 text-xs text-neutral-500">一覧から事項を選んでください。</p>;
  const n = jikou.data.nodes[node]!;
  const kou = kouOf.get(jikou.data.kous[n[0]]!);
  const row = table.rows[0]!;
  const yearNode = (y: number): number => flow[table.years.indexOf(y)]!;
  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kou ? `${kouTitle(kou)} › ${kou.name}` : ''} · FY{n[1]}</p>
        <h2 className="text-base font-semibold">{n[2]}</h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">確認済みの年度: <b>FY{row.firstYear}{row.firstYear === row.lastYear ? '' : `〜FY${row.lastYear}`}</b>（{flow.length} 年）</p>
        {kou && (
          <button type="button" onClick={() => onOpenKou(kou)} className="mt-1.5 rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
            この項（{kou.name}）の詳細を開く
          </button>
        )}
      </div>

      <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
        <h3 className="font-semibold">段階ごとの額</h3>
        <JikouChart table={table} jikou={jikou} current={n[1]} onSelect={y => { if (y !== n[1]) onSelectNode(yearNode(y)); }} />
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの額と対応</h3>
        <JikouYearTable table={table} jikou={jikou} selectedYear={n[1]} onYear={y => { if (y !== n[1]) onSelectNode(yearNode(y)); }} />
      </section>
    </div>
  );
}
