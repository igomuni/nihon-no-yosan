/**
 * 予算の一生の表（項 × 出来事 × 項目）。仕様（案）: docs/guides/budget-lifecycle.md。
 *
 * 入力: 基準データの予算書の CSV（`mof-archive/{年度}/kou-{general,special}{,-hosei,-kessan}.csv`）と、概算要求の額（`mof-ui.ts` の `requestOfMofRow`）。
 * 項は、政府案・補正・決算の 3 段階の和集合（段階によって項の集合が違う）。概算要求は、予算書の項に突合できたものだけを結ぶ（要求のみの項は、まだ入れない）。
 * 値は、原本の文字列・単位と、正規化した円を両方持つ。項の CSV の金額は目の行の合計なので、状態は `derived`（注に「目の合計」）。
 * 出力は値で返し、書くのは呼び出し側。
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  LIFECYCLE_MEASURES,
  readCsv,
  type LifecycleCheck,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecycleEventType,
  type LifecycleKou,
  type LifecycleMeasure,
  type Rec,
} from '@nihon-no-yosan/core';
import type { MofRowRequest } from './mof-ui.ts';

export const LIFECYCLE_YEARS = [2023, 2024] as const;

type Account = 'general' | 'special';
const ACCOUNTS: Account[] = ['general', 'special'];

const SETTLE_COLUMNS: [LifecycleMeasure, string][] = [
  ['appropriation', '歳出予算額'],
  ['carryover_in', '前年度繰越額'],
  ['reserve_use', '予備費使用額'],
  ['general_provision', '予算総則の規定による経費増額'],
  ['fungible', '流用等増△減額'],
  ['transfer', '予算決定後移替増△減額'],
  ['current_amount', '歳出予算現額'],
  ['spent', '支出済歳出額'],
  ['carryover_out', '翌年度繰越額'],
  ['unused', '不用額'],
];

const keyOf = (r: Rec, a: Account): string =>
  (a === 'general' ? [r['所管'], r['組織'], r['項コード'], r['項名']] : [r['特別会計'], r['勘定'], r['項コード'], r['項名']]).map(x => x ?? '').join('|');

/** 列名が条件に合う列の値（最初の 1 つ） */
const colOf = (r: Rec, pred: (k: string) => boolean): string | undefined => {
  const k = Object.keys(r).find(pred);
  return k === undefined ? undefined : k;
};

/** 整数（原本の文字列）。空欄は null */
const intOf = (s: string | undefined): number | null => {
  const t = (s ?? '').trim();
  if (t === '') return null;
  if (!/^-?\d+$/.test(t)) throw new Error(`整数でない金額: ${s}`);
  return Number(t);
};

export function buildLifecycle({ datasetDir, requestOfMofRow }: { datasetDir: string; requestOfMofRow: ReadonlyMap<string, MofRowRequest> }): LifecycleData {
  const kous: LifecycleKou[] = [];
  const events: LifecycleEventRow[] = [];
  const checks: LifecycleCheck[] = [];
  const rd = (year: number, file: string): Rec[] => readCsv(fs.readFileSync(path.join(datasetDir, 'mof-archive', String(year), file), 'utf8'));

  for (const year of LIFECYCLE_YEARS) {
    for (const account of ACCOUNTS) {
      const base = rd(year, `kou-${account}.csv`);
      const supp = rd(year, `kou-${account}-hosei.csv`);
      const settle = rd(year, `kou-${account}-kessan.csv`);
      const tally = new Map<string, LifecycleCheck>();
      const check = (name: string, ok: boolean): void => {
        const c = tally.get(name) ?? { year, account, name, ok: 0, ng: 0 };
        if (ok) c.ok++;
        else c.ng++;
        tally.set(name, c);
      };

      // 項（3 段階の和集合）。順は、政府案の順、続けて補正にだけある項、決算にだけある項
      const index = new Map<string, number>();
      const seen = new Map<number, Set<LifecycleEventType>>();
      const addKou = (r: Rec, stage: LifecycleEventType): number => {
        const key = keyOf(r, account);
        let i = index.get(key);
        if (i === undefined) {
          i = kous.length;
          index.set(key, i);
          kous.push({
            id: `${year}:${account}:${key}`,
            year,
            account,
            ministry: account === 'general' ? (r['所管'] ?? '') : '',
            org: account === 'general' ? (r['組織'] ?? '') : '',
            specialAccount: account === 'special' ? (r['特別会計'] ?? '') : '',
            subAccount: account === 'special' ? (r['勘定'] ?? '') : '',
            code: r['項コード'] ?? '',
            name: r['項名'] ?? '',
            seenIn: [],
          });
        }
        const s = seen.get(i) ?? seen.set(i, new Set()).get(i)!;
        s.add(stage);
        return i;
      };
      const push = (i: number, event: LifecycleEventType, version: string, part: string, measure: LifecycleMeasure, orig: string, yen: number, state: 'original' | 'derived', source: string, note: string): void => {
        events.push([i, event, version, '', part, measure, orig, LIFECYCLE_MEASURES[measure].unit, yen, state, source, note]);
      };

      // 政府案（予算書。国会への提出時）。額は千円
      const budgetIndex = new Map<string, number>();
      base.forEach((r, n) => {
        const i = addKou(r, 'budget');
        budgetIndex.set(keyOf(r, account), i);
        const src = `kou-${account}.csv:${n + 1}`;
        const note = `目の合計（目の行 ${r['目の行数'] ?? ''}）`;
        const amt = colOf(r, k => k.startsWith('令和') && /(要求額|予定額)/.test(k) && k.includes('合計'));
        const prev = colOf(r, k => k.startsWith('前年度予算額'));
        for (const [m, c] of [['budget_amount', amt], ['budget_prev', prev]] as const) {
          const v = c === undefined ? null : intOf(r[c]);
          if (v !== null) push(i, 'budget', 'submitted', '', m, String(r[c!]), v * 1000, 'derived', src, note);
        }
        // 概算要求（突合できたものだけ）
        const rq = requestOfMofRow.get(`${year}|kou-${account}:${n + 1}`);
        if (rq) {
          const rnote = rq.merged ? '概算要求書の項を足した額（統合）' : '概算要求書（MOF 突合）';
          if (rq.req !== null) push(i, 'request', '', '', 'request_amount', String(rq.req), rq.req * 1000, rq.merged ? 'derived' : 'original', `mof-ui:${year}|kou-${account}:${n + 1}`, rnote);
          if (rq.reqPrev !== null) push(i, 'request', '', '', 'request_prev', String(rq.reqPrev), rq.reqPrev * 1000, rq.merged ? 'derived' : 'original', `mof-ui:${year}|kou-${account}:${n + 1}`, rnote);
          seen.get(i)!.add('request');
        }
      });

      // 成立・補正。額は千円
      const suppVals = new Map<number, Record<string, number>>();
      supp.forEach((r, n) => {
        const i = addKou(r, 'supp');
        const src = `kou-${account}-hosei.csv:${n + 1}`;
        const note = `目の合計（目の行 ${r['目の行数'] ?? ''}）`;
        const cols: [LifecycleMeasure, string | undefined][] = [
          ['enacted_amount', colOf(r, k => k.includes('成立予算額'))],
          ['supp_add', colOf(r, k => k.includes('追加額'))],
          ['supp_reduce', colOf(r, k => k.includes('修正減少額'))],
          ['supp_net', colOf(r, k => k.includes('差引額'))],
          ['revised_amount', colOf(r, k => k.startsWith('改'))],
        ];
        const v: Record<string, number> = {};
        for (const [m, c] of cols) {
          const x = c === undefined ? null : intOf(r[c]);
          if (x !== null) {
            push(i, 'supp', 'enacted', '', m, String(r[c!]), x * 1000, 'derived', src, note);
            v[m] = x;
          }
        }
        suppVals.set(i, v);
        const need = ['enacted_amount', 'supp_add', 'supp_reduce', 'supp_net', 'revised_amount'];
        if (need.every(m => v[m] !== undefined)) check('supp_identity', v['enacted_amount']! + v['supp_net']! === v['revised_amount']! && v['supp_add']! + v['supp_reduce']! === v['supp_net']!);
        const b = budgetIndex.get(keyOf(r, account));
        if (b !== undefined && v['enacted_amount'] !== undefined) {
          const bv = events.find(e => e[0] === b && e[5] === 'budget_amount');
          if (bv) check('enacted_eq_budget', bv[8] === v['enacted_amount'] * 1000);
        }
      });

      // 決算。額は円。特別会計の共管は、組織ごとの行を `part` で分ける
      const settleRows = new Map<number, number[]>();
      settle.forEach((r, n) => {
        const i = addKou(r, 'settle');
        (settleRows.get(i) ?? settleRows.set(i, []).get(i)!).push(n);
      });
      settle.forEach((r, n) => {
        const i = index.get(keyOf(r, account))!;
        const src = `kou-${account}-kessan.csv:${n + 1}`;
        const note = `目の合計（目の行 ${r['目の行数'] ?? ''}）`;
        const part = account === 'special' && (r['共管所管名'] || r['共管組織名']) ? `${r['共管所管名'] ?? ''}|${r['共管組織名'] ?? ''}` : '';
        const v: Record<string, number> = {};
        for (const [m, name] of SETTLE_COLUMNS) {
          const c = colOf(r, k => k.startsWith(`${name}(`));
          if (c === undefined) continue;
          const x = intOf(r[c]);
          if (x === null) continue;
          push(i, 'settle', 'settled', part, m, String(r[c]), x, 'derived', src, note);
          v[m] = x;
        }
        if (['appropriation', 'carryover_in', 'reserve_use', 'fungible', 'transfer', 'current_amount'].every(m => v[m] !== undefined)) {
          const sum = v['appropriation']! + v['carryover_in']! + v['reserve_use']! + (v['general_provision'] ?? 0) + v['fungible']! + v['transfer']!;
          check('settle_current', sum === v['current_amount']);
        }
        if (['current_amount', 'spent', 'carryover_out', 'unused'].every(m => v[m] !== undefined)) check('settle_unused', v['current_amount']! - v['spent']! - v['carryover_out']! === v['unused']!);
        // 段をまたぐ式（行が 1 つの項だけ）
        if ((settleRows.get(i)?.length ?? 0) === 1 && v['appropriation'] !== undefined) {
          const sv = suppVals.get(i);
          if (sv?.['revised_amount'] !== undefined) {
            check('settle_eq_revised', v['appropriation'] === sv['revised_amount'] * 1000);
            push(i, 'derived', '', '', 'settle_vs_revised', String(v['appropriation'] - sv['revised_amount'] * 1000), v['appropriation'] - sv['revised_amount'] * 1000, 'derived', `${src} − kou-${account}-hosei.csv`, '決算の歳出予算額 − 改予算額 × 1,000');
          } else {
            const b = events.find(e => e[0] === i && e[5] === 'budget_amount');
            if (b) check('settle_eq_budget_when_no_supp', v['appropriation'] === b[8]);
          }
        }
      });

      // 査定差（政府案 − 概算要求）。両方がある項だけ
      for (const [i, ev] of groupByKou(events)) {
        const rqe = ev.find(e => e[5] === 'request_amount');
        const bge = ev.find(e => e[5] === 'budget_amount');
        if (rqe && bge && kous[i]!.year === year && kous[i]!.account === account) {
          push(i, 'derived', '', '', 'assessment_gap', String(bge[8] - rqe[8]), bge[8] - rqe[8], 'derived', '', '政府案の額 − 概算要求の額');
        }
      }

      for (const [i, s] of seen) kous[i]!.seenIn = (['request', 'budget', 'supp', 'settle'] as const).filter(x => s.has(x));
      checks.push(...[...tally.values()]);
    }
  }
  return { years: [...LIFECYCLE_YEARS], kous, events, checks };
}

/** 項の添字ごとの出来事（順は events の順のまま） */
function groupByKou(events: readonly LifecycleEventRow[]): Map<number, LifecycleEventRow[]> {
  const m = new Map<number, LifecycleEventRow[]>();
  for (const e of events) (m.get(e[0]) ?? m.set(e[0], []).get(e[0])!).push(e);
  return m;
}
