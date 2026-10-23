# 概算要求書の PDF からの抽出（plain text と総表）

概算要求書の PDF から、頁ごとの plain text を作り、そこから歳出概算要求額総表の CSV を作る。他の表（表紙・明細表・目次）の抽出は、まだ移していない（下の「移していないもの」）。

```bash
# PDF → plain text（基準データの pdf-corpus-freeze.json にある PDF。置き場は記録の data/download/ に当たるディレクトリ）
node packages/pipeline/src/extract/plain-text-cli.ts data/dataset/reference-v0 <年度> <PDF の置き場> <出力ディレクトリ>
# plain text → 総表の CSV
node packages/pipeline/src/extract/total-table-cli.ts <plain text のディレクトリ> <plain-text-manifest.json> <年度> <出力ディレクトリ>
```

実装は、パーサーが `packages/core/src/request-total-table.ts`（純粋な関数）、PDF の読み込みと出力が `packages/pipeline/src/extract/`。

## plain text

- 道具は `pdftotext -layout -enc UTF-8`（poppler。記録の版は 26.09.0）。頁の区切りは Form Feed。
- PDF の SHA-256 と頁数が `pdf-corpus-freeze.json` の記録と違えば止まる。処理の前後で PDF が変わっていないことも確かめる。頁ごとの SHA-256 の記録があれば、それとも照合する。
- slug は、記録の `localPdfPath` から先頭の `data/download/` と末尾の `.pdf` を除き、`/` を `__` にしたもの。重複すれば止まる。
- 出力は `{slug}.txt` と `plain-text-manifest.json`（頁ごとの SHA-256）。

## 総表の CSV

- 入力は plain text だけ（OCR・他の資料による補完はしない）。頁の分類 → 表のまとまり → 物理行の分類 → 数字の並び → 行頭の読み → 折り返しの結合、の順。符号の補完・空欄を 0 にすること・行や頁をまたぐ推定はしない。
- 読めなかった行は捨てず、理由つきで `unresolved.csv` に残す。全行の分類は `line-audit.csv`、計算で合わない行は `arithmetic-diagnostics.csv`（検算の記録で、値は書き換えない）。
- 出力は `sources/{slug}.csv`、`unresolved.csv`、`line-audit.csv`、`arithmetic-diagnostics.csv`、`summary.json`、`output-manifest.json`。基準データに入るのは `sources/` と `unresolved.csv` の対象だけ（`docs/guides/data.md`）。

## 確かめたこと

前のリポジトリの `3aef2de9d0f08a438c94efd32a3c0bc2ae33af19` と比べた。

| 比べたもの | 結果 |
|---|---|
| plain text（FY2023〜FY2027、681 書） | 手元の PDF から作り直して、基準データの `.txt` とバイト一致。`plain-text-manifest.json` は、凍結した PDF の一覧の置き場の文字列だけ違う |
| 総表の CSV（FY2023〜FY2027、342 ファイル） | 全ファイルがバイト一致（`datasets/reference-v0/total-table-comparison.json`）。`summary.json` は入力の置き場の文字列だけ、`output-manifest.json` は `summary.json` の行だけが違うので、その分を除いて比べた |

比べ方は `packages/pipeline/src/migrate/compare-plain-text.ts`（結果は `datasets/reference-v0/plain-text-comparison.json`）と `compare-total-table.ts`。

## 限界

- 手元の PDF は、公式サイトから取り直して比べていない（`docs/guides/data.md`）。PDF から plain text への一致は「記録の SHA-256 の PDF からなら同じ出力」まで。
- パーサーの出力の件数は、正解率ではない。正解の見本との照合はしていない。
- `request-total-table.test.ts` の実物の頁を使うテストは、基準データ（`data/dataset/reference-v0/`）がある環境だけで動く。原文を git に入れないため、頁の一部は基準データの plain text から行の抜き出し（`request-total-table.excerpts.json`）で組み立てる。CI では飛ばされる。

## 移していないもの

表紙（cover）、明細表（detail-table）、目次（toc、pdf.js を使う）の抽出。
