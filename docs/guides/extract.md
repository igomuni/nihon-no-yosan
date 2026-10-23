# 概算要求書の PDF からの抽出

概算要求書の PDF から、頁ごとの plain text を作り、そこから総表・明細表・表紙の CSV を作る。目次は、PDF の文字層（pdf.js）から直接作る。基準データの `budget-request/{年度}/{cover,toc,total-table,detail-table,plain-text}/` を、原本の PDF から作り直す処理。

```bash
# PDF → plain text（基準データの pdf-corpus-freeze.json にある PDF。置き場は記録の data/download/ に当たるディレクトリ）
node packages/pipeline/src/extract/plain-text-cli.ts data/dataset/reference-v0 <年度> <PDF の置き場> <出力ディレクトリ>
# plain text → 総表・明細表の CSV
node packages/pipeline/src/extract/total-table-cli.ts  <plain text のディレクトリ> <plain-text-manifest.json> <年度> <出力ディレクトリ>
node packages/pipeline/src/extract/detail-table-cli.ts <plain text のディレクトリ> <plain-text-manifest.json> <年度> <出力ディレクトリ>
# 表紙・目次（頁分類 → 表紙は plain text から、目次は PDF から）。目次はリポジトリのルートで動かす
node packages/pipeline/src/extract/cover-cli.ts data/dataset/reference-v0 <年度> <出力ディレクトリ>
node packages/pipeline/src/extract/toc-cli.ts   data/dataset/reference-v0 <年度> <PDF の置き場> <出力ディレクトリ>
```

実装は、パーサーが `packages/core/src/request-*.ts`（純粋な関数）、PDF や基準データの読み込みと出力が `packages/pipeline/src/extract/`。

## plain text

- 道具は `pdftotext -layout -enc UTF-8`（poppler。記録の版は 26.09.0）。頁の区切りは Form Feed。
- PDF の SHA-256 と頁数が `pdf-corpus-freeze.json` の記録と違えば止まる。処理の前後で PDF が変わっていないことも確かめる。頁ごとの SHA-256 の記録があれば、それとも照合する。
- slug は、記録の `localPdfPath` から先頭の `data/download/` と末尾の `.pdf` を除き、`/` を `__` にしたもの。重複すれば止まる。
- 出力は `{slug}.txt` と `plain-text-manifest.json`（頁ごとの SHA-256）。

## 総表・明細表の CSV

- 入力は plain text だけ（OCR・他の資料による補完はしない）。頁の分類 → 表のまとまり → 物理行の分類 → 数字の並び → 行頭の読み → 折り返しの結合、の順。符号の補完・空欄を 0 にすること・行や頁をまたぐ推定はしない。
- 読めなかった行は捨てず、理由つきで `unresolved.csv` に残す。計算で合わない行は `arithmetic-diagnostics.csv`（検算の記録で、値は書き換えない）。総表は全行の分類を `line-audit.csv` に残す。
- 明細表の見出しの語彙は FY2024 の v0 のまま（`６年度`）で、年度は入力の範囲を決めるだけ。備考は読まない。

## 頁分類と表紙

- 頁分類（`request-page-classification.ts`）は、頁の先頭 5 行の表題（`令和…歳出概算要求書`・`…目次` など）で頁の種類を決め（DIRECT）、表題の無い頁は、同じ PDF の直前の「続く種類」（目次・総表・明細表・定員表）を引き継ぐ（INHERITED）。表紙は引き継がない。曖昧なら推測せず、未分類にする。
- 空の頁: FY2024 だけ、目視でなく画素で「全面が白」「画像だけ」を分けた記録（`datasets/reference-v0/empty-pages-2024.json`）を使う。白い頁は状態を保ち、画像の頁は状態を捨てる。他の年度の空の頁は、理由未確定として状態を捨てる。
- 表紙（`request-cover.ts`）: 見出し（所管・会計）、表題、目次の行（総表・明細表・（組織）…）を、行の順に取り出す。名称の空白（均等割付）は除いて出力する。
- 出力は `sources/{slug}.csv`、`unclassified.csv`（どの項目にも分類できなかった行）、`summary.json`。

## 目次の CSV

- 入力は PDF の文字層だけ（pdf.js 5.4.296 に固定。版が違えば出力が変わりうる）。頁ごとに、見出し帯の `要求`・`ページ` が2個ずつ並ぶ頁だけ左右の列を確定し、列ごとに行を作る。根拠が揃った行だけ `sources/{slug}.csv` に出し、判断できない行は `unresolved.csv` に理由つきで残す。
- 回転した頁は未対応で、その PDF は `source-errors.csv` に残す（処理できない PDF があっても、残りの出力は書く）。
- 出力は `sources/{slug}.csv`、`sources.csv`、`entry-provenance.csv`、`unresolved.csv`、`token-ledger.csv`、`page-summary.csv`、`source-errors.csv`、`summary.json`、`output-hashes.json`。出力はコードと入力が同じならバイト一致する。

## 確かめたこと

前のリポジトリの `3aef2de9d0f08a438c94efd32a3c0bc2ae33af19` と比べた。

| 比べたもの | 結果 |
|---|---|
| plain text（FY2023〜FY2027、681 書） | 手元の PDF から作り直して、基準データの `.txt` が全件バイト一致。`plain-text-manifest.json` は、凍結した PDF の一覧の置き場の文字列だけ違う（`datasets/reference-v0/plain-text-comparison.json`） |
| 総表の CSV（342 ファイル） | 全ファイルがバイト一致（`total-table-comparison.json`）。`summary.json` は入力の置き場の文字列だけ、`output-manifest.json` は `summary.json` の行だけが違うので、その分を除いて比べた |
| 明細表の CSV（649 ファイル） | 同上（`detail-table-comparison.json`） |
| 頁分類（表紙・目次の頁、FY2023〜FY2027 で 791 頁） | 書・頁・種類・DIRECT か INHERITED か・PDF と頁の SHA-256 が、前のリポジトリの構造 inventory と一致（`page-classification-comparison.json`） |
| 表紙の CSV（325 ファイル） | 全ファイルがバイト一致（`cover-comparison.json`） |
| 目次の CSV（328 ファイル） | 全ファイルがバイト一致（`toc-comparison.json`）。`summary.json` は入力の記録（前のリポジトリの inventory とコードの SHA-256）を除き、`output-hashes.json` は `summary.json` の行を除いて比べた |

比べ方は `packages/pipeline/src/migrate/compare-plain-text.ts` と `compare-extract-csv.ts`。

## 限界

- 手元の PDF は、公式サイトから取り直して比べていない（`docs/guides/data.md`）。PDF から出力への一致は「記録の SHA-256 の PDF からなら同じ出力」まで。
- パーサーの出力の件数は、正解率ではない。正解の見本との照合はしていない。
- 頁分類の規則は FY2024 で凍結した v0 のまま、他の年度にも当てている。FY2024 の空の頁の分類（`empty-pages-2024.json`）は、前のリポジトリの記録を写したもので、他の年度には無い。
- 実物の頁を使うテスト（総表・明細表）は、基準データ（`data/dataset/reference-v0/`）がある環境だけで動く。原文を git に入れないため、頁の一部は行の抜き出しの記録（`request-*.excerpts.json`）から、基準データの plain text で組み立てる（`packages/core/test-support/excerpts.ts`）。CI では飛ばされる。表紙のテストには、前のリポジトリで観測した表紙の数行（所管名と目次の見出し）を、そのまま入れてある。
