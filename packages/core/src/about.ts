/** 画面の「出典と利用条件」のページが読むデータ（pipeline の `web-data-cli.ts` が `about.json` に出す）。仕様: docs/guides/web-publish.md */

export interface SiteAboutAuthority {
  /** 機関名（例: 消費者庁） */
  authority: string;
  /** 公開元のドメイン（例: caa.go.jp） */
  domain: string;
  /** `pdl1.0` = 公共データ利用規約（第1.0版）、`diet-courts` = 国会・裁判所（著作権法で認められる範囲） */
  status: 'pdl1.0' | 'diet-courts';
  /** 利用規約のページ */
  termsUrl: string;
  /** この機関から取り込んだ要求書の数 */
  books: number;
}

export interface SiteAbout {
  /** 基準データの版（例: v0）と、取り込んだ書・ファイルの数 */
  dataset: { version: string; books: number; files: number };
  authorities: SiteAboutAuthority[];
  /** 予算書の出どころ */
  budgetBook: { authority: string; domain: string; termsUrl: string };
  /** RS（行政事業レビュー）の事業を載せた版だけ。出典と利用条件（`docs/guides/rs-tab.md`） */
  rs?: { authority: string; domain: string; termsUrl: string; /** 事業の数 */ jigyo: number; /** 予算年度 */ years: number[] };
}
