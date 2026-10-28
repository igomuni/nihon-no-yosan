import { useMemo } from 'react';
import {
  formatSen,
  lifecycleRowAmounts,
  type LifecycleChain,
  type LifecycleKou,
  type LifecycleLink,
  type LifecycleLinkEvidence,
  type LifecycleValues,
} from '@nihon-no-yosan/core';
import { TREND_SERIES, TrendChart, type TrendPoint } from './charts.tsx';
import { kouTitle, num, td, th } from './shared.ts';

const SHORT_EVIDENCE: Record<LifecycleLinkEvidence, string> = {
  same_key: '同じ鍵',
  same_key_succession: '同じ鍵（所属を引き継ぎ先に読み替え）',
  same_name_other_code: '同じ名前（項コードが違う）',
  same_name_other_org: '同じ名前（所管・組織が違う）',
  prev_amount_eq_revised: '前年度予算額 = 前年の改予算額',
  prev_amount_eq_budget: '前年度予算額 = 前年の政府案',
  same_code_other_name: '同じ項コード（項名が違う）',
  similar_name: '近い名前',
};

const cellAmount = (yen: number | undefined): string => (yen === undefined ? '—' : yen === 0 ? '0円' : formatSen(yen / 1000));

/**
 * 項の年度推移。確定した対応でたどれた年度（連続）の、段階ごとの代表の額（概算要求 = 要求額、政府案、補正後 = 改予算額、決算 = 支出済額）を、折れ線と表で見る。
 * 値の無い段階は「—」（0 とは別）。年度の間の対応は、行ごとに根拠を書く。たどる範囲は、確定した対応だけ（候補・候補なしでは進まない）。
 */
export function LifecycleTrendTab({ kou, chain, kous, valuesOf, links, onNavigate }: {
  kou: LifecycleKou;
  chain: LifecycleChain;
  kous: readonly LifecycleKou[];
  valuesOf: ReadonlyMap<number, LifecycleValues>;
  links: readonly LifecycleLink[];
  onNavigate: (id: string) => void;
}) {
  const rows = useMemo(() => chain.members.map(i => ({ i, k: kous[i]!, a: lifecycleRowAmounts(valuesOf.get(i) ?? {}) })), [chain, kous, valuesOf]);
  const points = useMemo<TrendPoint[]>(() => rows.map(({ k, a }) => ({ year: k.year, request: a.request, budget: a.budget, revised: a.revised, spent: a.spent })), [rows]);
  // 前の年度との対応（確定した 1 組）の根拠
  const evidenceTo = useMemo(() => {
    const m = new Map<number, LifecycleLinkEvidence[]>();
    for (const l of links) if (l.status === 'RESOLVED' && l.from >= 0 && l.to >= 0) m.set(l.to, l.evidence);
    return m;
  }, [links]);
  return (
    <div className="flex flex-col gap-5 p-4 text-xs">
      <div>
        <p className="text-[11px] text-neutral-500">{kouTitle(kou)} · FY{kou.year}</p>
        <h2 className="text-base font-semibold">{kou.name}</h2>
      </div>

      <section className="flex flex-col gap-2" aria-label="段階ごとの額の年度推移">
        <h3 className="font-semibold">段階ごとの額</h3>
        <TrendChart points={points} current={kou.year} onSelect={y => { const t = rows.find(r => r.k.year === y); if (t && t.k.id !== kou.id) onNavigate(t.k.id); }} />
      </section>

      <section className="flex flex-col gap-2" aria-label="年度の表">
        <h3 className="font-semibold">年度ごとの額と対応</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className={th}>年度</th>
                <th className={`${th} min-w-[7rem]`}>項名（所属・対応）</th>
                {TREND_SERIES.map(s => <th key={s.key} className={`${th} whitespace-nowrap text-right`} title={s.label}>{s.key === 'spent' ? '決算' : s.key === 'request' ? '要求' : s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ i, k, a }, n) => {
                const prev = n > 0 ? rows[n - 1]!.k : null;
                const selected = k.id === kou.id;
                const ev = evidenceTo.get(i);
                return (
                  <tr
                    key={k.id}
                    tabIndex={0}
                    aria-selected={selected}
                    title={selected ? undefined : `FY${k.year} を開く`}
                    onClick={() => { if (!selected) onNavigate(k.id); }}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !selected) { e.preventDefault(); onNavigate(k.id); } }}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                  >
                    <td className={`${td} whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>FY{k.year}</td>
                    <td className={td}>
                      <span className={prev && prev.name !== k.name ? 'font-medium text-amber-700 dark:text-amber-400' : ''} title={prev && prev.name !== k.name ? `前の年度の項名: ${prev.name}` : undefined}>{k.name}</span>
                      {prev && prev.name !== k.name && <span className="ml-1 text-[10px] text-neutral-500">（名称が変わった）</span>}
                      {(!prev || kouTitle(prev) !== kouTitle(k)) && <span className="block text-[10px] text-neutral-500">{kouTitle(k)}</span>}
                      {n > 0 && <span className="block text-[10px] text-neutral-500">対応: {ev ? ev.map(e => SHORT_EVIDENCE[e]).join('・') : ''}</span>}
                    </td>
                    <td className={num}>{cellAmount(a.request)}</td>
                    <td className={num}>{cellAmount(a.budget)}</td>
                    <td className={num}>{cellAmount(a.revised)}</td>
                    <td className={num}>{cellAmount(a.spent)}</td>
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
