/**
 * 財務省の予算書【XML版】の当初予算（一般会計 `{年}11001`、特別会計 `{年}12001`）から、事項の CSV（`jikou-general.csv`・`jikou-special.csv`）を作る。仕様: docs/guides/mof-history.md
 *
 * 読み取りは `mof-xml.ts`（前のリポジトリの parser と同じ規則）。説明欄は含めない。読む XML は、目次（`{帳票}menu.html`）が挙げるもの。
 * 入力の XML の集合は、ファイル名と SHA-256 の並びの SHA-256（`xmlSetSha256`）で記録し、違えば止まる。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  decodeEucJpMenu,
  ministryFromMenuChain,
  MofXmlParseError,
  parseMenuXmlFileNames,
  parseMofBudgetXmlItemFile,
  parseMofSpecialXmlFile,
  readMenuAncestorChains,
} from './mof-xml.ts';

export type JikouAccount = 'general' | 'special';

/** 年度の見出しの文字（XML の header・CSV の列名）。当初予算は、FY2019 が「平成31年度」（令和元年度の補正・決算とは見出しが違う） */
export function yearLabelOf(year: number): string {
  if (year <= 2019) return `平成${year - 1988}年度`;
  return `令和${year - 2018}年度`;
}

export interface JikouTarget {
  year: number;
  account: JikouAccount;
  /** XML の置き場 */
  xmlDir: string;
  /** 目次（`{帳票}menu.html`） */
  menuPath: string;
}

/** 入力の記録（`datasets/mof-history-v0/jikou-inputs.json` の 1 件）。件数は、最初に作ったときの値（独立に確かめたものではない） */
export interface JikouRecord {
  documentId: string;
  menuSha256: string;
  xmlFiles: number;
  xmlSetSha256: string;
  targetFiles: number;
  notTargetFiles: number;
  records: number;
}

const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const num = (n: number | null): string => (n === null ? '' : String(n));

export const documentIdOf = (year: number, account: JikouAccount): string => `${year}${account === 'general' ? '11001' : '12001'}`;

export function jikouColumns(year: number, account: JikouAccount): string[] {
  const label = yearLabelOf(year);
  return account === 'general'
    ? ['所管', '組織', '項コード', '項名', '事項名', '主要経費別分類コード', `${label}要求額(千円)`, '前年度予算額(千円)', '比較増△減額(千円)', 'source_file', 'source_row', 'source_page']
    : ['所管', '特別会計', '勘定', '組織', '項コード', '項名', '事項名', '分類コード', `${label}予定額(千円)`, '前年度予算額(千円)', '比較増△減額(千円)', 'source_file', 'source_row', 'source_page'];
}

/** 事項の CSV と、入力の記録を作る。`expected` があれば、入力の記録と違うとき止まる */
export function buildJikou(t: JikouTarget, expected?: JikouRecord): { csv: string; record: JikouRecord; counts: Record<string, number>; layouts?: Record<string, number> } {
  const documentId = documentIdOf(t.year, t.account);
  const doctype = `DOCTYPE budget SYSTEM "../dtd/${t.year}01.dtd"`;
  const yearLabel = yearLabelOf(t.year);
  const menuBytes = fs.readFileSync(t.menuPath);
  const menuText = decodeEucJpMenu(menuBytes).text;
  const chains = readMenuAncestorChains(menuText);
  const files = parseMenuXmlFileNames(menuText);
  if (files.length === 0) throw new Error(`${documentId}: 目次から本文 XML を 1 件も列挙できない`);
  const bytesOf = new Map(files.map(f => [f, fs.readFileSync(path.join(t.xmlDir, f))]));
  const xmlSetSha256 = sha256(files.map(f => `${f}\t${sha256(bytesOf.get(f)!)}\n`).join(''));
  if (expected) {
    if (expected.documentId !== documentId) throw new Error(`${documentId}: 記録の帳票 ID が違う`);
    if (expected.menuSha256 !== sha256(menuBytes)) throw new Error(`${documentId}: 目次の SHA-256 が記録と違う`);
    if (expected.xmlFiles !== files.length || expected.xmlSetSha256 !== xmlSetSha256) throw new Error(`${documentId}: XML の集合が記録と違う`);
  }

  const rows: string[][] = [];
  let targetFiles = 0, notTargetFiles = 0;
  const counts: Record<string, number> = {};
  const layouts: Record<string, number> = {};
  for (const f of files) {
    const bytes = bytesOf.get(f)!;
    try {
      if (t.account === 'general') {
        const o = parseMofBudgetXmlItemFile({ filename: f, bytes, documentId, menuChain: chains.get(f), spec: { documentId, doctype, yearLabel } });
        if (o.status === 'unsupported') throw new Error(`${f}: unsupported（${o.reason}）`);
        if (o.status === 'not_target') { notTargetFiles++; continue; }
        targetFiles++;
        for (const [k, v] of Object.entries(o.counts)) counts[k] = (counts[k] ?? 0) + v;
        const ministry = ministryFromMenuChain(chains.get(f)!);
        for (const r of o.records) {
          rows.push([ministry, r.organization, r.itemCode, r.itemName, r.requestName, r.col4Raw, String(r.amountsThousandYen.col6), String(r.amountsThousandYen.col8), String(r.amountsThousandYen.col10), r.file, r.row, String(r.page)]);
        }
      } else {
        const o = parseMofSpecialXmlFile({ filename: f, bytes, menuChain: chains.get(f), spec: { documentId, doctype, yearLabel } });
        if (o.status === 'not_target') { notTargetFiles++; continue; }
        targetFiles++;
        layouts[o.layout] = (layouts[o.layout] ?? 0) + 1;
        for (const [k, v] of Object.entries(o.counts)) counts[k] = (counts[k] ?? 0) + v;
        for (const r of o.records) {
          rows.push([r.ministry, r.specialAccount, r.subAccount, r.organization, r.itemCode, r.itemName, r.matterName, r.classCode, num(r.amountsThousandYen.planned), num(r.amountsThousandYen.prev), num(r.amountsThousandYen.diff), r.file, r.row, String(r.page)]);
        }
      }
    } catch (e) {
      if (e instanceof MofXmlParseError) throw new Error(`parser の失敗: ${e.message}`, { cause: e });
      throw e;
    }
  }
  const record: JikouRecord = { documentId, menuSha256: sha256(menuBytes), xmlFiles: files.length, xmlSetSha256, targetFiles, notTargetFiles, records: rows.length };
  if (expected && (expected.targetFiles !== targetFiles || expected.notTargetFiles !== notTargetFiles || expected.records !== rows.length)) {
    throw new Error(`${documentId}: 生成結果の件数が記録と違う（対象 ${targetFiles} / 対象外 ${notTargetFiles} / 事項 ${rows.length}）`);
  }
  const csv = [jikouColumns(t.year, t.account).join(','), ...rows.map(r => r.map(cell).join(','))].join('\n') + '\n';
  return { csv, record, counts, ...(t.account === 'special' ? { layouts } : {}) };
}
