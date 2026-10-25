/**
 * 事項（当初予算）の年度をまたぐ対応と、事項の継続年数。仕様: docs/guides/mof-history.md（事項の年度をまたぐ対応）。
 *
 * 入力: 事項の CSV（`mof-archive/{年度}/jikou-{general,special}.csv`。FY2017〜FY2022 は過去年度のデータセット、FY2023〜FY2026 は基準データ。FY2025 は国会への提出時の版）と、
 * 補正の事項の CSV（`jikou-{general,special}-hosei{,-2,-3}.csv`。FY2017〜FY2024。補正後の額に使う）。名前は `nameKey` で揃える。
 */
import { buildJikouLinks, jikouLinkKeyOf, jikouRunLengths, nameKey, parseCsv, type JikouLink, type JikouNode } from '@nihon-no-yosan/core';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const JIKOU_LINK_YEARS: readonly number[] = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

type Account = 'general' | 'special';
const ACCOUNTS: Account[] = ['general', 'special'];

interface Table { header: string[]; rows: string[][] }
const readTable = (file: string): Table => {
  const all = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  return { header: all[0]!, rows: all.slice(1).filter(r => r.length > 1) };
};
const col = (t: Table, pred: (h: string) => boolean, what: string): number => {
  const i = t.header.findIndex(pred);
  if (i < 0) throw new Error(`列が無い: ${what}（${t.header.join(',')}）`);
  return i;
};
const int = (s: string | undefined): number | null => (s === undefined || s === '' ? null : Number(s));

/** 年度の事項（当初）の CSV の置き場。FY2022 以前は過去年度のデータセット。FY2025 は提出時の版 */
const dirOf = (year: number, datasetDir: string, historyDir: string): string =>
  path.join(year <= 2022 ? historyDir : datasetDir, 'mof-archive', year === 2025 ? '2025_teishutsu' : String(year));

export interface JikouLinkData {
  years: readonly number[];
  nodes: JikouNode[];
  /** 事項ごとの継続年数（`nodes` と同じ順） */
  runs: number[];
  links: JikouLink[];
  /** 補正後の額が付いた事項の数（年度ごと） */
  revisedCount: Record<number, number>;
}

export function buildJikouLinkData(datasetDir: string, historyDir: string): JikouLinkData {
  const nodes: JikouNode[] = [];
  const revisedCount: Record<number, number> = {};
  for (const year of JIKOU_LINK_YEARS) {
    for (const account of ACCOUNTS) {
      const t = readTable(path.join(dirOf(year, datasetDir, historyDir), `jikou-${account}.csv`));
      const c = (name: string): number => col(t, h => h === name, name);
      const iAmt = col(t, h => /(要求額|予定額)\(千円\)$/.test(h), '当年度の額');
      const iPrev = c('前年度予算額(千円)');
      const get = (r: string[], i: number): string => nameKey(r[i]);
      const at = (r: string[], name: string): string => get(r, c(name));
      const made: JikouNode[] = t.rows.map(r => ({
        year, account,
        ministry: account === 'general' ? at(r, '所管') : '',
        specialAccount: account === 'special' ? at(r, '特別会計') : '',
        subAccount: account === 'special' ? at(r, '勘定') : '',
        org: at(r, '組織'),
        itemCode: r[c('項コード')]!,
        itemName: at(r, '項名'),
        name: at(r, '事項名'),
        budget: int(r[iAmt]),
        prev: int(r[iPrev]),
      }));
      // 補正後の額: 補正が複数回あるときは、その事項が載る最後の回
      if (year <= 2024) {
        const byKey = new Map(made.map(n => [jikouLinkKeyOf(n), n]));
        for (let round = 1; ; round++) {
          const f = path.join(historyDir, 'mof-archive', String(year), `jikou-${account}-hosei${round > 1 ? `-${round}` : ''}.csv`);
          if (!fs.existsSync(f)) break;
          const h = readTable(f);
          const hc = (name: string): number => col(h, x => x === name, name);
          const iRev = col(h, x => x.startsWith('改'), '改予算額');
          const iKind = hc('行の種類');
          for (const r of h.rows) {
            if (r[iKind] !== '事項') continue;
            const probe: JikouNode = {
              year, account,
              ministry: account === 'general' ? nameKey(r[hc('所管')]) : '',
              specialAccount: account === 'special' ? nameKey(r[hc('特別会計')]) : '',
              subAccount: account === 'special' ? nameKey(r[hc('勘定')]) : '',
              org: nameKey(r[hc('組織')]),
              itemCode: r[hc('項コード')]!,
              itemName: nameKey(r[hc('項名')]),
              name: nameKey(r[hc('事項名')]),
              budget: null, prev: null,
            };
            const n = byKey.get(jikouLinkKeyOf(probe));
            if (n) n.revised = int(r[iRev]) ?? undefined;
          }
        }
      }
      nodes.push(...made);
    }
    revisedCount[year] = nodes.filter(n => n.year === year && n.revised !== undefined).length;
  }
  const links = buildJikouLinks(nodes, JIKOU_LINK_YEARS);
  return { years: JIKOU_LINK_YEARS, nodes, runs: jikouRunLengths(nodes, links), links, revisedCount };
}

export const jikouNodeId = (n: JikouNode): string => `${n.year}:${jikouLinkKeyOf(n)}`;
