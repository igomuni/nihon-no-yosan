/**
 * 財務省の予算書【XML版】の補正予算から、事項の補正の額の CSV を作る（一般会計 `jikou-general-hosei{,-2,-3}.csv`、特別会計 `jikou-special-hosei{,-2,-3}.csv`）。仕様: docs/guides/mof-history.md
 *
 * 読み取りは `mof-xml-hosei.ts`。補正が年度に複数回あるときは、回ごとのファイル（第 2 回以降は `-2`、`-3`）。当初予算の事項の CSV（`mof-jikou.ts`）と同じ作法で、
 * 入力の XML の集合は、ファイル名と SHA-256 の並びの SHA-256 で記録し、違えば止まる。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { decodeEucJpMenu, MofXmlParseError, parseMenuXmlFileNames, readMenuAncestorChains } from './mof-xml.ts';
import { parseHoseiGeneralFile, parseHoseiSpecialFile } from './mof-xml-hosei.ts';
import type { JikouAccount, JikouRecord } from './mof-jikou.ts';

/** 補正の見出し・列名の年度の文字（当初予算と違い、FY2019 は「令和元年度」） */
export function hoseiYearLabelOf(year: number): string {
  if (year <= 2018) return `平成${year - 1988}年度`;
  if (year === 2019) return '令和元年度';
  return `令和${year - 2018}年度`;
}

export interface HoseiTarget { year: number; account: JikouAccount; round: number; xmlDir: string; menuPath: string }
export const hoseiDocumentIdOf = (year: number, account: JikouAccount, round: number): string => `${year}${account === 'general' ? '21' : '22'}${String(round).padStart(3, '0')}`;
/** 出力ファイル名の接尾辞（第 1 回は無し） */
export const hoseiFileName = (account: JikouAccount, round: number): string => `jikou-${account}-hosei${round > 1 ? `-${round}` : ''}.csv`;

const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function hoseiColumns(year: number, account: JikouAccount): string[] {
  const l = hoseiYearLabelOf(year);
  const common = [`${l}成立予算額(千円)`, account === 'general' ? '補正要求追加額(千円)' : '補正予定追加額(千円)', account === 'general' ? '補正要求修正減少額(千円)' : '補正予定修正減少額(千円)', account === 'general' ? '補正要求差引額(千円)' : '補正予定差引額(千円)', account === 'general' ? `改${l}予算額(千円)` : `改${l}予定額(千円)`, '行の種類', 'source_file', 'source_row', 'source_page'];
  return account === 'general'
    ? ['所管', '組織', '項コード', '項名', '事項名', '主要経費別分類コード', ...common]
    : ['所管', '特別会計', '勘定', '組織', '項コード', '項名', '事項名', '分類コード', ...common];
}

export function buildJikouHosei(t: HoseiTarget, expected?: JikouRecord): { csv: string; record: JikouRecord; counts: Record<string, number>; layouts: Record<string, number> } {
  const documentId = hoseiDocumentIdOf(t.year, t.account, t.round);
  const spec = { documentId, doctype: `DOCTYPE budget SYSTEM "../dtd/${t.year}01.dtd"`, yearLabel: hoseiYearLabelOf(t.year) };
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
    try {
      const o = (t.account === 'general' ? parseHoseiGeneralFile : parseHoseiSpecialFile)({ filename: f, bytes: bytesOf.get(f)!, menuChain: chains.get(f), spec });
      if (o.status === 'not_target') { notTargetFiles++; continue; }
      targetFiles++;
      layouts[o.layout] = (layouts[o.layout] ?? 0) + 1;
      for (const [k, v] of Object.entries(o.counts)) counts[k] = (counts[k] ?? 0) + v;
      for (const r of o.records) {
        const a = r.amounts;
        const head = t.account === 'general'
          ? [r.ministry, r.organization, r.itemCode, r.itemName, r.matterName, r.classCode]
          : [r.ministry, r.specialAccount, r.subAccount, r.organization, r.itemCode, r.itemName, r.matterName, r.classCode];
        rows.push([...head, String(a.enacted), String(a.add), String(a.reduce), String(a.net), String(a.revised), r.kind === 'matter' ? '事項' : '項のみ', r.file, r.row, String(r.page)]);
      }
    } catch (e) {
      if (e instanceof MofXmlParseError) throw new Error(`parser の失敗: ${e.message}`, { cause: e });
      throw e;
    }
  }
  const record: JikouRecord = { documentId, menuSha256: sha256(menuBytes), xmlFiles: files.length, xmlSetSha256, targetFiles, notTargetFiles, records: rows.length };
  if (expected && (expected.targetFiles !== targetFiles || expected.notTargetFiles !== notTargetFiles || expected.records !== rows.length)) {
    throw new Error(`${documentId}: 生成結果の件数が記録と違う（対象 ${targetFiles} / 対象外 ${notTargetFiles} / 行 ${rows.length}）`);
  }
  return { csv: [hoseiColumns(t.year, t.account).join(','), ...rows.map(r => r.map(cell).join(','))].join('\n') + '\n', record, counts, layouts };
}
