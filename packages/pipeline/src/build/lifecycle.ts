/**
 * 予算の一生の表（項 × 出来事 × 項目）。仕様（案）: docs/guides/budget-lifecycle.md。
 *
 * 入力: 基準データの予算書の CSV（`mof-archive/{年度}/kou-{general,special}{,-hosei,-kessan}.csv`）と、概算要求の額（`mof-ui.ts` の `requestOfMofRow`）。
 * 項は、政府案・補正・決算の 3 段階の和集合（段階によって項の集合が違う）に、概算要求書にだけある項（`requestOnlyRows`。予算書の項に突合できなかった要求の項と、前年度・要求とも 0 の項）を足す。概算要求は、予算書の項に突合できたものを、その項に結ぶ。
 * 値は、原本の文字列・単位と、正規化した円を両方持つ。項の CSV の金額は目の行の合計なので、状態は `derived`（注に「目の合計」）。
 * 出力は値で返し、書くのは呼び出し側。
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  LIFECYCLE_MEASURES,
  buildLifecycleLinks,
  nameKey,
  lifecycleValues,
  readCsv,
  type LifecycleCheck,
  type LifecycleData,
  type LifecycleEventRow,
  type LifecycleEventType,
  type LifecycleKou,
  type BudgetRequestMofRow,
  type LifecycleMeasure,
  type Rec,
} from '@nihon-no-yosan/core';
import type { MofRowRequest } from './mof-ui.ts';

/**
 * 年度ごとの入力元（`mof-archive/` の版のディレクトリ）。段階ごと・会計ごとに、使うディレクトリを書く。無いものは、基準データに無い段階（作らない。0 にしない）。
 * - FY2025 の政府案は、国会への提出時の版（`2025_teishutsu`。成立後の `2025` は、国会で修正された年度なので政府案には使わない）。補正の表は成立後の版（`2025`）にある。
 * - FY2025・FY2026 の決算は、基準データに無い。FY2026 の補正は、一般会計だけ（特別会計の補正の表は無い）。
 * - FY2027 は予算書が無い（概算要求だけ）。項は概算要求書から作る（`requestOnlyRows`）。
 */
export interface LifecycleSource {
  year: number;
  /** `history`: 財務省の過去年度の CSV（`mof-history` のデータセット。概算要求書の無い年度）。省略は基準データ */
  root?: 'history';
  /** 政府案の版。省略は国会への提出時（`submitted`）。FY2017〜FY2021 は、提出時か成立後か判定できない（`unconfirmed`） */
  budgetVersion?: 'submitted' | 'unconfirmed';
  budget: string | null;
  supp: Partial<Record<'general' | 'special', string>>;
  settle: Partial<Record<'general' | 'special', string>>;
}
const both = (dir: string): { general: string; special: string } => ({ general: dir, special: dir });
export const LIFECYCLE_SOURCES: readonly LifecycleSource[] = [
  { year: 2023, budget: '2023', supp: both('2023'), settle: both('2023') },
  { year: 2024, budget: '2024', supp: both('2024'), settle: both('2024') },
  { year: 2025, budget: '2025_teishutsu', supp: both('2025'), settle: {} },
  { year: 2026, budget: '2026', supp: { general: '2026' }, settle: {} },
  { year: 2027, budget: null, supp: {}, settle: {} },
];
export const LIFECYCLE_YEARS: readonly number[] = LIFECYCLE_SOURCES.map(s => s.year);

/**
 * 概算要求書の無い過去年度（財務省の公式 CSV だけ。`docs/guides/mof-history.md`）。
 * 補正は、年度に複数回あるものがある（回ごとのファイル `kou-*-hosei{,-2,-3}.csv`）。
 */
const histories = (year: number, settle: { general?: string; special?: string }): LifecycleSource => ({
  // 政府案の版: FY2022 は zip の中の CSV の日付が 2022-01-19（FY2023 は 2023-01-24、FY2024 は 2024-01-17 で、基準データはこの日付を根拠に提出時としている）なので提出時。
  // FY2017〜FY2021 は、日付が再作成日（2022-02-22）で、版を判定できない
  year, root: 'history', budgetVersion: year >= 2022 ? 'submitted' : 'unconfirmed', budget: String(year), supp: both(String(year)), settle,
});
export const HISTORY_SOURCES: readonly LifecycleSource[] = [
  histories(2017, both('2017')),
  histories(2018, both('2018')),
  histories(2019, both('2019')),
  histories(2020, both('2020')),
  histories(2021, both('2021')),
  histories(2022, both('2022')),
];

/** 年度の古い順の入力元。過去年度は、そのデータセット（`historyDir`）がある環境だけ */
export const lifecycleSources = (historyDir?: string): readonly LifecycleSource[] => (historyDir ? [...HISTORY_SOURCES, ...LIFECYCLE_SOURCES] : LIFECYCLE_SOURCES);

/** 概算要求書にだけある項の行（予算書の項に結べていない）。`noBudget` = その年度の予算書が基準データに無い */
export interface LifecycleRequestOnlyRow {
  y: number;
  kind: 'reqOnly' | 'zero' | 'noBudget';
  acct: 0 | 1;
  /** 特別会計の所管（要求書の表から取れたときだけ。無いときは空） */
  grp: string;
  /** 一般会計は所管名、特別会計は特別会計名 */
  min: string;
  sub: string;
  org: string;
  name: string;
  /** 千円。読めない行は null（項にしない） */
  req: number | null;
  reqPrev: number | null;
  /** 複数の書に載る（最も大きい額を使う） */
  multiBook: boolean;
}

/**
 * 概算要求と当初予算の差の行（`reqOnly`・`zero`）から。同じ所属・項名の行が複数ある（特別会計で、所管の違う書に同じ項が載る。FY2025 の東日本大震災復興特別会計「内閣府共通費」など）ときは、
 * 1 つの項にまとめる。要求額は最も大きい行（同じなら先の行）を使い、複数の書に載る項として記す。
 */
export function requestOnlyFromMof(rows: readonly BudgetRequestMofRow[]): LifecycleRequestOnlyRow[] {
  const groups = new Map<string, BudgetRequestMofRow[]>();
  for (const r of rows) {
    if (r.kind !== 'reqOnly' && r.kind !== 'zero') continue;
    const key = [r.y, r.acct, r.min, r.sub, r.org, r.name].join('|');
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  return [...groups.values()].map(rs => {
    const top = rs.reduce((a, r) => ((r.req ?? -Infinity) > (a.req ?? -Infinity) ? r : a), rs[0]!);
    return { y: top.y, kind: top.kind as 'reqOnly' | 'zero', acct: top.acct, grp: top.grp, min: top.min, sub: top.sub, org: top.org, name: top.name, req: top.req, reqPrev: top.reqPrev, multiBook: rs.length > 1 || rs.some(r => r.books.length > 1) };
  });
}

/** 概算要求書にだけある項の行: 予算書に突合できなかった行（概算要求と当初予算の差の行）と、予算書が基準データに無い年度の概算要求書の行 */
export function lifecycleRequestOnlyRows(mofRows: readonly BudgetRequestMofRow[], matches: ReadonlyMap<number, { requestKou: readonly Rec[] }>, sources: readonly LifecycleSource[] = LIFECYCLE_SOURCES): LifecycleRequestOnlyRow[] {
  const noBudgetYears = sources.filter(s => s.budget === null).map(s => s.year);
  return [
    ...requestOnlyFromMof(mofRows.filter(r => !noBudgetYears.includes(r.y))),
    ...noBudgetYears.flatMap(y => requestOnlyFromRequestKou(matches.get(y)?.requestKou ?? (() => { throw new Error(`${y}: 概算要求書の行が無い`); })(), y)),
  ];
}

/**
 * 予算書が基準データに無い年度の、概算要求書の行から。要求側の所属（一般会計は所管・組織、特別会計は特別会計・勘定）と項名でまとめ（同じ項が複数の書に載る）、要求額の最も大きい行を使う（`mof-ui.ts` と同じ規則）。
 */
export function requestOnlyFromRequestKou(requestKou: readonly Rec[], year: number): LifecycleRequestOnlyRow[] {
  const amount = (s: string | undefined): number | null => { const t = (s ?? '').replace(/[\s,]/g, ''); if (!/^△?\d+$/.test(t)) return null; return t.startsWith('△') ? -Number(t.slice(1)) : Number(t); };
  const groups = new Map<string, Rec[]>();
  for (const r of requestKou) {
    // 項の識別は、一般会計が所管・組織・項名、特別会計が特別会計・勘定・項名（特別会計の行の組織は、載せた書の組織で、項の識別に入れない）
    const special = r['acct'] === 'special';
    const key = [r['acct'], special ? r['account'] : r['ministry'], special ? r['sub'] : '', special ? '' : r['org'], nameKey(r['request_name'] ?? '')].join('|');
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  return [...groups.values()].map(rs => {
    const top = rs.reduce((a, r) => ((amount(r['request_amount']) ?? -Infinity) > (amount(a['request_amount']) ?? -Infinity) ? r : a), rs[0]!);
    const special = top['acct'] === 'special';
    return {
      y: year, kind: 'noBudget' as const, acct: special ? 1 as const : 0 as const, grp: '', min: special ? top['account'] ?? '' : top['ministry'] ?? '', sub: special ? top['sub'] ?? '' : '', org: special ? '' : top['org'] ?? '',
      name: nameKey(top['request_name'] ?? ''), req: amount(top['request_amount']), reqPrev: amount(top['previous_amount']), multiBook: rs.length > 1,
    };
  });
}

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

export function buildLifecycle({ datasetDir, historyDir, requestOfMofRow, requestOnlyRows = [], sources = lifecycleSources(historyDir) }: { datasetDir: string; historyDir?: string | undefined; requestOfMofRow: ReadonlyMap<string, MofRowRequest>; requestOnlyRows?: readonly LifecycleRequestOnlyRow[]; sources?: readonly LifecycleSource[] }): LifecycleData {
  const kous: LifecycleKou[] = [];
  const events: LifecycleEventRow[] = [];
  const checks: LifecycleCheck[] = [];
  // 設定にあるファイルは、無ければ止める（空の入力を 0 件として通さない）。設定に無い段階は、読まない
  const rootOf = (source: LifecycleSource): string => {
    if (source.root !== 'history') return datasetDir;
    if (!historyDir) throw new Error(`${source.year}: 過去年度のデータセット（historyDir）が無い`);
    return historyDir;
  };
  /** ファイルが無ければ空（`optional`）か、止める */
  const rd = (root: string, dir: string | null | undefined, file: string, optional = false): Rec[] => {
    if (!dir) return [];
    const f = path.join(root, 'mof-archive', dir, file);
    if (optional && !fs.existsSync(f)) return [];
    return readCsv(fs.readFileSync(f, 'utf8'));
  };
  /** 出典の表記。年度と同じ名前のディレクトリは、ファイル名だけ（FY2023・FY2024 の出力を変えない）。過去年度のデータセットは `history:` を付ける */
  const fileLabel = (source: LifecycleSource, dir: string, file: string): string => {
    const label = dir === String(source.year) ? file : `${dir}/${file}`;
    return source.root === 'history' ? `history:${source.year}/${label}` : label;
  };

  for (const source of sources) {
    const year = source.year;
    const root = rootOf(source);
    for (const account of ACCOUNTS) {
      const base = rd(root, source.budget, `kou-${account}.csv`);
      // 補正は回ごとのファイル（`-hosei`、`-hosei-2`、…）。回が続く限り読む
      const suppRounds: Rec[][] = [rd(root, source.supp[account], `kou-${account}-hosei.csv`)];
      for (let round = 2; suppRounds[round - 2]!.length > 0; round++) {
        const rows = rd(root, source.supp[account], `kou-${account}-hosei-${round}.csv`, true);
        if (rows.length === 0) break;
        suppRounds.push(rows);
      }
      const settle = rd(root, source.settle[account], `kou-${account}-kessan.csv`);
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
            ministry: r['所管'] ?? '',
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
        const src = `${fileLabel(source, source.budget!, `kou-${account}.csv`)}:${n + 1}`;
        const note = `目の合計（目の行 ${r['目の行数'] ?? ''}）`;
        const amt = colOf(r, k => /^(令和|平成)(元|\d+)年度/.test(k) && /(要求額|予定額)/.test(k) && k.includes('合計'));
        const prev = colOf(r, k => k.startsWith('前年度予算額'));
        for (const [m, c] of [['budget_amount', amt], ['budget_prev', prev]] as const) {
          const v = c === undefined ? null : intOf(r[c]);
          if (v !== null) push(i, 'budget', source.budgetVersion ?? 'submitted', '', m, String(r[c!]), v * 1000, 'derived', src, note);
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

      // 成立・補正。額は千円。補正が年度に複数回あるときは、項ごとに、その項が載る最後の回の行を使う（回が進むと「成立予算額」は前の回の「改予算額」になる。
      // 前の回にだけある項は、その回の行を使う）。項が連続する回に載るときは、次の回の成立予算額 = 前の回の改予算額かを検算する
      const suppVals = new Map<number, Record<string, number>>();
      const suppRowOf = (r: Rec, k: string): number | null => { const c = colOf(r, x => x.includes(k)); return c === undefined ? null : intOf(r[c]); };
      const latest = new Map<number, { round: number; n: number; r: Rec }>();
      suppRounds.forEach((rows, ri) => {
        rows.forEach((r, n) => {
          const i = addKou(r, 'supp');
          const before = latest.get(i);
          if (before && before.round === ri) {
            // 前の回の改予算額 = この回の成立予算額
            const prevRevised = suppRowOf(before.r, '改');
            const enacted = suppRowOf(r, '成立予算額');
            if (prevRevised !== null && enacted !== null) check('supp_chain', prevRevised === enacted);
          }
          latest.set(i, { round: ri + 1, n, r });
        });
      });
      for (const [i, { round, n, r }] of latest) {
        const file = round === 1 ? `kou-${account}-hosei.csv` : `kou-${account}-hosei-${round}.csv`;
        const src = `${fileLabel(source, source.supp[account]!, file)}:${n + 1}`;
        const note = `目の合計（目の行 ${r['目の行数'] ?? ''}）${suppRounds.length > 1 ? `。補正は年度に ${suppRounds.length} 回、この項が載る最後の回は第 ${round} 回` : ''}`;
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
        // 第 1 回の成立予算額は当初予算の額のはず。第 2 回以降は前の回の改予算額なので、比べない
        if (round === 1 && b !== undefined && v['enacted_amount'] !== undefined) {
          const bv = events.find(e => e[0] === b && e[5] === 'budget_amount');
          if (bv) check('enacted_eq_budget', bv[8] === v['enacted_amount'] * 1000);
        }
      }

      // 決算。額は円。特別会計の共管は、組織ごとの行を `part` で分ける
      const settleRows = new Map<number, number[]>();
      settle.forEach((r, n) => {
        const i = addKou(r, 'settle');
        (settleRows.get(i) ?? settleRows.set(i, []).get(i)!).push(n);
      });
      settle.forEach((r, n) => {
        const i = index.get(keyOf(r, account))!;
        const src = `${fileLabel(source, source.settle[account]!, `kou-${account}-kessan.csv`)}:${n + 1}`;
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
            push(i, 'derived', '', '', 'settle_vs_revised', String(v['appropriation'] - sv['revised_amount'] * 1000), v['appropriation'] - sv['revised_amount'] * 1000, 'derived', `${src} − ${fileLabel(source, source.supp[account]!, 'kou-' + account + '-hosei' + (suppRounds.length > 1 ? '*' : '') + '.csv')}`, '決算の歳出予算額 − 改予算額 × 1,000');
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

      // 概算要求書にだけある項（予算書の項に結べていない）。鍵は概算要求の側（所属・名前）。要求額が読めない行は、値が無いので項にしない
      for (const r of requestOnlyRows) {
        if (r.y !== year || r.acct !== (account === 'general' ? 0 : 1) || r.req === null) continue;
        const key = ['request', r.min, r.sub, r.org, r.name].join('|');
        if (index.has(key)) throw new Error(`概算要求のみの項の鍵が重複: ${year} ${key}`);
        const i = kous.length;
        index.set(key, i);
        kous.push({
          id: `${year}:${account}:${key}`,
          year,
          account,
          ministry: account === 'general' ? r.min : r.grp,
          org: account === 'general' ? r.org : '',
          specialAccount: account === 'special' ? r.min : '',
          subAccount: account === 'special' ? r.sub : '',
          code: '',
          name: r.name,
          seenIn: [],
          requestOnly: r.kind,
        });
        seen.set(i, new Set<LifecycleEventType>(['request']));
        const src = `mof-ui:${year}|${r.kind}:${key}`;
        const note = `概算要求書（${r.kind === 'noBudget' ? '予算書が基準データに無い年度' : `予算書に突合できなかった項。${r.kind === 'zero' ? '前年度・要求とも 0' : '突合に候補なし'}`}）${r.multiBook ? '。複数の書に載り、最も大きい額' : ''}`;
        push(i, 'request', '', '', 'request_amount', String(r.req), r.req * 1000, 'original', src, note);
        if (r.reqPrev !== null) push(i, 'request', '', '', 'request_prev', String(r.reqPrev), r.reqPrev * 1000, 'original', src, note);
      }

      for (const [i, s] of seen) kous[i]!.seenIn = (['request', 'budget', 'supp', 'settle'] as const).filter(x => s.has(x));
      checks.push(...[...tally.values()]);
    }
  }
  // 年度をまたぐ対応。項ごとの値（導出の行を除く）から作る
  const byKou = groupByKou(events.filter(e => e[1] !== 'derived'));
  const values = kous.map((_, i) => lifecycleValues(byKou.get(i) ?? []));
  const years = sources.map(s => s.year);
  const links = buildLifecycleLinks(kous, values, years);
  return { years, kous, events, checks, links };
}

/** 項の添字ごとの出来事（順は events の順のまま） */
function groupByKou(events: readonly LifecycleEventRow[]): Map<number, LifecycleEventRow[]> {
  const m = new Map<number, LifecycleEventRow[]>();
  for (const e of events) (m.get(e[0]) ?? m.set(e[0], []).get(e[0])!).push(e);
  return m;
}
