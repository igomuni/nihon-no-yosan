/**
 * 基準データ（reference dataset）の manifest を作る部品。仕様: docs/guides/data.md
 *
 * 純粋な関数だけ。ファイルの読み書きは freeze.ts。
 */

/** PDF の `localPdfPath`（`data/download/<ドメイン>/…/x.pdf`）→ CSV・plain text の名前の元（`/` を `__` に、末尾の `.pdf` を除く） */
export const slugOf = (localPdfPath: string): string =>
  localPdfPath.replace(/^data\/download\//, '').replaceAll('/', '__').replace(/\.pdf$/i, '');

export type TermsStatus = 'pdl1.0' | 'diet-courts' | 'unconfirmed';
export type TermsBasis = 'page-read' | 'search-summary' | 'none';
export interface DomainTerms {
  authority: string;
  status: TermsStatus;
  basis: TermsBasis;
  url: string;
}
export interface TermsFile {
  domains: Record<string, DomainTerms>;
}

/** manifest の 1 ファイル。パスは基準データのルートからの相対 */
export interface FileEntry {
  sha256: string;
  bytes: number;
}

/** 1 つの PDF（書）と、そこから作られたファイル。確かめた範囲を `evidence` に分けて持つ */
export interface SourceRecord {
  year: string;
  slug: string;
  domain: string;
  authority: string;
  sourceUrl: string;
  pdf: {
    sha256: string;
    bytes: number | null;
    pageCount: number;
    /** `pipeline-fetch`（スクリプトで取得）/ `manual`（手で取得）/ null（記録なし） */
    acquisition: string | null;
  };
  evidence: {
    /** 手元の PDF の SHA-256 が、前のリポジトリの記録（pdf-corpus-freeze.json）と一致した（この凍結の時点で確かめた） */
    pdfLocalHashMatchesRecord: true;
    /** 公式サイトから取り直して比べたか。していない */
    pdfComparedWithOfficialSite: false;
    /** plain text の SHA-256 と頁数が、前のリポジトリの plain-text-manifest.json と一致した。plain text が無ければ null */
    plainTextMatchesRecord: boolean | null;
    /** CSV と PDF の対応の根拠。ファイル名（slug）が同じこと。CSV がその PDF から作られたことの独立の証明ではない */
    csvLinkedToPdfBy: 'file-name';
  };
  terms: { status: TermsStatus; basis: TermsBasis };
  /** 種類 → 基準データのルートからの相対パス */
  files: Record<string, string>;
}

/** ドメインの利用条件の状態。無いドメインは例外（分類の漏れを黙って通さない） */
export function termsOf(terms: TermsFile, domain: string): DomainTerms {
  const t = terms.domains[domain];
  if (!t) throw new Error(`terms.json にドメインが無い: ${domain}`);
  return t;
}

/** 状態ごとの書の数 */
export function termsSummary(sources: readonly SourceRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sources) {
    const k = `${s.terms.status}/${s.terms.basis}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** 入れなかったファイルのパス → グループ名（年度を除いた `種類/ファイル名`。`sources/` の下は `種類/sources/*`） */
export function excludedGroup(pathUnderYear: string): string {
  const parts = pathUnderYear.split('/');
  const [kind, second] = parts;
  if (parts.length >= 3 && second === 'sources') return `${kind}/sources/*`;
  return pathUnderYear;
}

/** キーを辞書順に並べたオブジェクト（manifest を決まった順で書くため） */
export function sortedRecord<T>(r: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** files と sources は 1 エントリ 1 行、ほかは字下げ 1 の JSON（manifest の行数を抑え、差分を読みやすくする） */
export function stringifyManifest(m: { files: Record<string, FileEntry>; sources: SourceRecord[] } & Record<string, unknown>): string {
  const { files, sources, ...rest } = m;
  const parts = Object.entries(rest).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v, null, 1).replaceAll('\n', '\n ')}`);
  const fileLines = Object.entries(sortedRecord(files)).map(([p, e]) => `  ${JSON.stringify(p)}: ${JSON.stringify(e)}`);
  parts.push(` "files": {\n${fileLines.join(',\n')}\n }`);
  parts.push(` "sources": [\n${sources.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]`);
  return `{\n${parts.join(',\n')}\n}\n`;
}
