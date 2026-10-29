/**
 * 公開サイトの `data/index.json`（データの目録）を作る。仕様: docs/guides/ai-access.md
 *
 * サイトが配る JSON（`web-data-cli.ts` の出力）ごとに、説明・先頭のキーの形と件数・文書へのリンク・大きさ・SHA-256 を並べ、読み方の約束（単位・値なし・項の id・コード）を添える。
 * 目録に載せる説明は、ここ（`DATA_FILE_SPECS`）に 1 か所で持つ。説明の無いファイルが出力に増えたときは、止まる（目録に載らないファイルを作らない）。
 */
import { createHash } from 'node:crypto';
import * as zlib from 'node:zlib';
import { DATA_COLUMNS, type DataColumn } from '@nihon-no-yosan/core';

export const SITE_URL = 'https://igomuni.github.io/nihon-no-yosan/';
export const REPO_URL = 'https://github.com/igomuni/nihon-no-yosan';
const guide = (name: string): string => `${REPO_URL}/blob/main/docs/guides/${name}.md`;

export interface DataFileSpec {
  /** 何のデータか */
  description: string;
  /** 読み方の文書（リポジトリの `docs/guides/`） */
  docs: string[];
  /** トップレベルのキーごとの説明（無いキーは、形だけ載せる） */
  keys: Record<string, string>;
  /** データに無くてもよいキー（ビルドによって出ないもの） */
  optionalKeys?: string[];
}

/** 配るファイル（`data/` からの相対パス）→ 説明。新しいファイルを配るときは、ここに足す */
export const DATA_FILE_SPECS: Record<string, DataFileSpec> = {
  'about.json': {
    description: '出典と利用条件。取り込んだ機関（要求書の公開元）と利用規約のページ、基準データの版、予算書・RS の出どころ。',
    docs: [guide('web-publish'), guide('data')],
    optionalKeys: ['rs'],
    keys: { dataset: '基準データの版と、取り込んだ書・ファイルの数', authorities: '取り込んだ機関（要求書の公開元）と、利用規約のページと、状態', budgetBook: '予算書の出どころ（財務省 予算書・決算書データベース）', rs: '行政事業レビュー（RS）の出どころと、事業数・予算年度（RS を載せたビルドだけ）' },
  },
  'lifecycle/data.json.gz': {
    description: '予算の一生の表（項の粒度。FY2017〜FY2027）。項ごとに、概算要求・政府案（当初予算）・補正・決算の値（events）と、年度をまたぐ項の対応（links）、検算（checks）。',
    docs: [guide('budget-lifecycle'), guide('lifecycle-status')],
    keys: {
      years: '年度（西暦。令和 8 年度 = 2026）',
      kous: '項（年度ごと）。オブジェクトの配列（id・year・account・ministry・org・specialAccount・subAccount・code・name・seenIn・requestOnly・publishers）。他のデータの「項の添字」は、この配列の添字',
      events: '値の出来事（1 行 = 値 1 つ）。配列の配列。先頭は項の添字',
      checks: '検算の結果（年度・会計・名前・一致数・不一致数）',
      links: '年度をまたぐ項の対応（from・to は kous の添字、evidence・amount・status）。status が RESOLVED のものだけが確定',
    },
  },
  'lifecycle/jikou.json.gz': {
    description: '事項（項の下の区分）のデータ（FY2017〜FY2027）。概算要求・政府案・補正後の額と、年度をまたぐ事項の対応。決算の事項は無い（決算は項と目だけ）。',
    docs: [guide('lifecycle-jikou'), guide('budget-codes')],
    keys: { years: '年度', kous: '項の id（`lifecycle/data.json.gz` の kous[].id）。nodes の先頭は、この配列の添字', nodes: '事項 1 件（1 年度）。配列の配列。額は千円', links: '確定した年度をまたぐ事項の対応（前の年度の事項・次の年度の事項の添字、根拠のビット、額の確認）', requestRead: '概算要求の事項を読めた項（kous の添字）' },
  },
  'lifecycle/moku.json.gz': {
    description: '目（項の下の区分）のデータ（FY2017〜FY2027）。当初予算・補正・決算・概算要求の額と、分類コード（主要経費別・目的別・財政法・経済性質別・使途別）。',
    docs: [guide('lifecycle-moku'), guide('budget-codes')],
    keys: { years: '目がある年度', suppYears: '補正の書を読んだ年度', settleYears: '決算の書を読んだ年度', requestYears: '概算要求の目を読んだ年度', kous: '項の id（`lifecycle/data.json.gz` の kous[].id）。nodes の先頭は、この配列の添字', nodes: '目 1 件（1 年度）。配列の配列。額は千円（決算は原本が円なので千円に直した値で、小数がありうる）。分類コードは `|` でつなぐ', requestCoverage: '項ごとの概算要求の目の取れ方（[kous の添字, full・partial・none・noReq]）' },
  },
  'lifecycle/codes.json.gz': {
    description: '主要経費別・使途別の分類コードの名前。当初予算のコード表のページ（一般会計 11001・特別会計 12001 など）ごと。コードの意味は年度・帳票で変わる。',
    docs: [guide('budget-codes')],
    keys: { pages: 'コード表のページ（year・form・major・use）。major・use は [コード, 名前] の配列' },
  },
  'rs/jigyo.json.gz': {
    description: '行政事業レビュー（RS）の事業と、年度ごとの予算・執行額、予算書の項・目への結びつき（RS を載せたビルドだけ）。',
    docs: [guide('rs-tab'), guide('rs-link')],
    keys: { years: '予算年度', kous: '項の id（`lifecycle/data.json.gz` の kous[].id）。links の項の添字は、この配列の添字', jigyo: '事業 1 件。配列の配列（予算事業 ID・事業名・府省庁・局・庁・主要経費）', amounts: '事業 × 予算年度の額（円）。配列の配列。先頭は jigyo の添字', links: '予算書の項に結べた行（RS の歳出予算項目）。配列の配列。額は円' },
  },
  'trend/kou.json.gz': {
    description: '概算要求の年度推移（項の粒度。FY2023〜FY2027）。画面「年度推移」（#/trend）のデータ。',
    docs: [guide('trend'), guide('trend-screen')],
    keys: { years: '年度', urls: '要求書の PDF の URL', rows: '項（オブジェクトの配列。年度ごとの値は y）' },
  },
  'trend/jikou.json.gz': {
    description: '概算要求の「金額を示さない要求」（事項要求など）の候補（FY2023〜FY2027）。',
    docs: [guide('jikou-youkyu')],
    keys: { years: '年度ごとの事項要求の候補', orgs: '年度ごとの、組織の注記' },
  },
  'trend/detail.json.gz': {
    description: '概算要求の事項・目の年度推移（FY2023〜FY2027）。',
    docs: [guide('trend-detail')],
    keys: { years: '年度 → 項のキー → 事項（j）・目（m）' },
  },
  'mof/kou.json.gz': {
    description: '概算要求と当初予算の差（項の粒度。FY2023〜FY2026）。画面「概算要求と当初予算の差」（#/mof）のデータ。',
    docs: [guide('mof-ui'), guide('mof-screen')],
    keys: { years: '年度', versions: '年度ごとの予算書の版', urls: '要求書の PDF の URL', rows: '項（オブジェクトの配列）' },
  },
  'mof/detail.json.gz': {
    description: '概算要求と当初予算の差の、事項・目の内訳（FY2023〜FY2026）。',
    docs: [guide('mof-ui')],
    keys: { rows: '行のキー（年度|種類|会計|所管|府省|勘定|組織|名前）→ 内訳（j = 事項、m = 目。[名前, コード, 要求額, 当初予算額]。千円）' },
  },
};

/** 読み方の約束（目録の先頭に置く） */
export const CONVENTIONS: string[] = [
  '各 `*.json.gz` は、gzip で圧縮した JSON。サーバーが Content-Encoding を付けるかは配信先しだいなので、受け取ったバイト列が gzip（先頭が 1f 8b）なら、伸ばしてから読む。`about.json` と、この `index.json` は、そのままの JSON。',
  '年度は西暦（令和 8 年度 = 2026）。一部のデータは、予算書が無い年度（FY2027 は概算要求だけ）を含む。',
  '値が無いことは `null`（0 とは別）。画面は「—」で出す。0 は、観測した値が 0。',
  '額の単位は、`lifecycle/jikou.json.gz`・`lifecycle/moku.json.gz`・`trend/*`・`mof/*` が千円、`rs/jigyo.json.gz` と `lifecycle/data.json.gz` の events の「円」の列が円。決算の目の額は、原本が円なので、千円に直した値で、小数がありうる。',
  '項の id は `{年度}:{general|special}:{鍵}`。一般会計の鍵は `所管|組織|項コード|項名`、特別会計は `特別会計|勘定|項コード|項名`、概算要求書にだけある項は `request|所管|勘定|組織|項名`。`lifecycle/*` と `rs/jigyo.json.gz` の項は、この id で結べる（`kous` の配列と、その添字）。',
  '多くの配列は、列名の無い配列（タプル。位置で意味が決まる）。列の名前・型・単位・意味は、各ファイルのトップレベルの `columns`（キー → 列の配列）と、この目録の `files[].columns` にある。ビットの列は `bits`、取りうる値が決まっている列は `values`。',
  '分類コード（目）: 一般会計は 主要経費別|目的別|財政法|経済性質別|使途別、特別会計は 主要経費別|目的別|経済性質別|使途別（財政法の区分が無い）。コードの名前は `lifecycle/codes.json.gz`（主要経費別・使途別だけ）。',
  '数字は、各府省・財務省・RS の公表資料を、名前でそろえてつないだ加工物で、国や府省が作成した、加工していない情報ではない。出典と利用条件は `about.json`。',
];

export interface CatalogFile {
  path: string;
  /** `gzip-json`（gzip で圧縮した JSON）または `json` */
  encoding: 'gzip-json' | 'json';
  bytes: number;
  sha256: string;
  description: string;
  docs: string[];
  /** タプルの配列の、列の定義（キー → 列）。データ自身のトップレベルの `columns` と同じ */
  columns?: Record<string, DataColumn[]>;
  /** トップレベルのキーごとの、形（`array` と件数、`object` とキー数、など）と説明 */
  keys: Record<string, { type: string; length?: number; item?: string; description: string }>;
}

export interface DataCatalog {
  schema: 'nihon-no-yosan/data-catalog/v0';
  site: { name: string; url: string; repo: string; about: string };
  conventions: string[];
  files: CatalogFile[];
  /** 元の CSV（GitHub Releases のデータセット）。公開分の基準データ・過去年度・RS */
  releases: { name: string; url: string; tag: string; asset: string; bytes: number; sha256: string }[];
  guides: { url: string; note: string };
}

/** 値の形（トップレベルのキーごと） */
function shapeOf(value: unknown): { type: string; length?: number; item?: string } {
  if (Array.isArray(value)) {
    const first = value[0];
    return { type: 'array', length: value.length, item: first === undefined ? 'empty' : Array.isArray(first) ? 'array（位置で意味が決まる）' : first === null ? 'null' : typeof first === 'object' ? 'object' : typeof first };
  }
  if (value !== null && typeof value === 'object') return { type: 'object', length: Object.keys(value).length };
  return { type: value === null ? 'null' : typeof value };
}

export function buildDataCatalog(input: {
  /** `data/` からの相対パス → ファイルのバイト列（`*.gz` は gzip） */
  files: ReadonlyMap<string, Buffer>;
  releases: readonly { name: string; tag: string; asset: string; bytes: number; sha256: string }[];
}): DataCatalog {
  const files: CatalogFile[] = [];
  for (const [path, bytes] of [...input.files].sort((a, b) => a[0].localeCompare(b[0]))) {
    const spec = DATA_FILE_SPECS[path];
    if (!spec) throw new Error(`データの目録に説明が無いファイル: ${path}（data-catalog.ts の DATA_FILE_SPECS に足す）`);
    const gz = path.endsWith('.gz');
    const { columns, ...body } = JSON.parse((gz ? zlib.gunzipSync(bytes) : bytes).toString('utf8')) as Record<string, unknown> & { columns?: Record<string, DataColumn[]> };
    const keys: CatalogFile['keys'] = {};
    for (const [k, v] of Object.entries(body)) keys[k] = { ...shapeOf(v), description: spec.keys[k] ?? '' };
    for (const k of Object.keys(spec.keys)) if (!(k in body) && !spec.optionalKeys?.includes(k)) throw new Error(`目録の説明にあるキーが、データに無い: ${path} ${k}`);
    files.push({ path, encoding: gz ? 'gzip-json' : 'json', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), description: spec.description, docs: spec.docs, ...(columns ? { columns } : {}), keys });
  }
  return {
    schema: 'nihon-no-yosan/data-catalog/v0',
    site: { name: '日本の予算', url: SITE_URL, repo: REPO_URL, about: `${SITE_URL}data/about.json` },
    conventions: CONVENTIONS,
    files,
    releases: input.releases.map(r => ({ ...r, url: `${REPO_URL}/releases/tag/${r.tag}` })),
    guides: { url: `${REPO_URL}/tree/main/docs/guides`, note: 'データの列・規則・検算の文書（Markdown）。目録の各ファイルの docs は、ここの文書' },
  };
}

/**
 * 配るデータに、タプルの配列の列の定義（`columns`）を添える。定義（`DATA_COLUMNS`）の配列は、全行が配列で、長さが列の数と同じでなければならない（違えば止まる）。
 * 定義の無いファイルは、そのまま返す。
 */
export function withColumns<T extends object>(path: string, data: T): T & { columns?: Record<string, DataColumn[]> } {
  const spec = DATA_COLUMNS[path];
  if (!spec) return data;
  for (const [key, cols] of Object.entries(spec)) {
    const rows = (data as Record<string, unknown>)[key];
    if (!Array.isArray(rows)) throw new Error(`列の定義があるキーが、配列でない: ${path} ${key}`);
    rows.forEach((r: unknown, i) => {
      if (!Array.isArray(r) || r.length !== cols.length) throw new Error(`列の数が合わない: ${path} ${key}[${i}] は ${Array.isArray(r) ? r.length : '配列でない'}、定義は ${cols.length}`);
    });
  }
  return { ...data, columns: spec };
}
