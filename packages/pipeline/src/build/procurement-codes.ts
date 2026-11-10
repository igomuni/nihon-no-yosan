/**
 * 落札実績オープンデータのファイル仕様（PDF）のコード表（3.1 府省コード・3.2 入札方式コード）を、`pdftotext -layout` の文字から読む。
 * 仕様: docs/guides/procurement.md
 *
 * 項番が 1 から途切れず続くこと、コードが重ならないこと、名称が空でないことを確かめる。合わなければ止まる（件数は版で変わるので、決め打ちしない）。
 */

export interface ProcurementCodeTables {
  /** 仕様書の版（例: 令和 8 年 10 月版） */
  edition: string;
  ministries: [code: string, name: string][];
  methods: [code: string, name: string][];
}

/** 項番・コード・名称の行を読む。見出しとページ番号の行は、読まずに飛ばす */
function readTable(lines: readonly string[], codeRe: RegExp, what: string): [string, string][] {
  const out: [string, string][] = [];
  let no = 0;
  for (const line of lines) {
    const m = /^\s*(\d+)\s+(\S+)\s+(\S.*?)\s*$/.exec(line);
    if (!m) continue;
    // ページ番号の行は項番 1 つだけで、ここには来ない。コードの形が合わない行は、表の行ではない（止める）
    if (!codeRe.test(m[2]!)) throw new Error(`${what}: コードの形が合わない行: 「${line.trim()}」`);
    no++;
    if (Number(m[1]) !== no) throw new Error(`${what}: 項番が続かない: ${no} のはずが ${m[1]}（「${line.trim()}」）`);
    out.push([m[2]!, m[3]!]);
  }
  if (out.length === 0) throw new Error(`${what}: 行が読めなかった`);
  const codes = new Set(out.map(([c]) => c));
  if (codes.size !== out.length) throw new Error(`${what}: コードが重なっている`);
  return out;
}

export function parseProcurementCodeTables(text: string): ProcurementCodeTables {
  const edition = /(令和\s*\d+\s*年\s*\d+\s*月版)/.exec(text)?.[1]?.replace(/\s+/g, ' ');
  if (!edition) throw new Error('仕様書の版（「令和 N 年 M 月版」）が読めない');
  const lines = text.split('\n');
  // 目次にも同じ見出しがあるので、本文の見出し（最後に出てくるもの）を使う
  const at31 = lines.findLastIndex(l => /^\s*3\.1\s+府省コード/.test(l));
  const at32 = lines.findLastIndex(l => /^\s*3\.2\s+入札方式コード/.test(l));
  if (at31 < 0 || at32 < 0 || at32 < at31) throw new Error('「3.1 府省コード」「3.2 入札方式コード」の見出しが、この順に無い');
  return {
    edition,
    ministries: readTable(lines.slice(at31 + 1, at32), /^[A-Z][A-Z0-9]$/, '府省コード'),
    methods: readTable(lines.slice(at32 + 1), /^\d{7}$/, '入札方式コード'),
  };
}
