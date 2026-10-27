# 画面の公開（GitHub Pages）と基準データの配り方

画面（`apps/web`）は静的サイトで、GitHub Pages に公開する。画面が読む JSON は git に入れず、GitHub Releases の基準データ（公開分）から CI で作る。土台の理由は `docs/decisions/0006-web-app.md`。

公開先: https://igomuni.github.io/nihon-no-yosan/

## 流れ

```text
Releases (dataset-reference-v0)          リポジトリ                       CI（.github/workflows/pages.yml）
  reference-v0.tar.gz  ──ダウンロード──▶  datasets/reference-v0/             ① SHA-256 を release.json と照合
  （公開分の基準データ）                    release.json                      ② 展開して published-manifest.json と全ファイル照合
                                           published-manifest.json          ③ npm run build:data（JSON と about.json）
                                           datasets/terms.json              ④ npm run build（vite）
                                                                            ⑤ GitHub Pages に配る
```

`main` に入るたびに動く（手動でも動かせる）。過去年度のデータも、同じ流れで、もう 1 つの tar.gz（`dataset-mof-history-v0`）から取り込む（下の「過去年度のデータ」）。基準データを更新したときは、新しい tar.gz を同じ手順で作り直し、`release.json`・`published-manifest.json` を更新する。

## 過去年度のデータ（FY2017〜FY2024 と、補正の事項 FY2025・FY2026）

基準データ（FY2023 以降）とは別のデータセット `mof-history-v0`（`docs/guides/mof-history.md`）を、同じやり方で配る。財務省の予算書・決算書データベースの公式 CSV・XML から作った CSV だけ（PDF・原本は入れない）。

```bash
node packages/pipeline/src/migrate/package-history.ts data/dataset/mof-history-v0 datasets/mof-history-v0/manifest.json datasets/terms.json <出力ディレクトリ>
gh release create dataset-mof-history-v0 <出力ディレクトリ>/mof-history-v0.tar.gz --title ... --notes-file ...
cp <出力ディレクトリ>/release.json datasets/mof-history-v0/release.json
```

- **入れるもの:** `datasets/mof-history-v0/manifest.json` の全ファイル（143 件）と `manifest.json`。計 144 ファイル、4.7 MB（tar.gz）。中身を足して出し直すときは、タグを変える（例: `dataset-mof-history-v0-r2`。`package-history.ts` の最後の引数）。同じタグの tar.gz を差し替えると、`main` の CI が SHA-256 の不一致で失敗する。現在のタグは `datasets/mof-history-v0/release.json`。
- **公開してよい条件:** `terms.json` で `bb.mof.go.jp` が `pdl1.0`・`page-read`（利用条件の本文を読んだ）。違えば `package-history.ts` が止まる。
- **照合:** 作る前に、ディレクトリが manifest と全件一致することを確かめる。CI は、tar.gz の SHA-256 を `release.json` と照合し、展開して `verify.ts` で manifest と全件照合してから、`npm run build:data` に渡す（`build:data` は、過去年度のディレクトリがあるときだけ、過去年度を足す）。
- **順序:** Releases に tar.gz を置いてから、`release.json` をコミットした変更を `main` に入れる（置く前に入れると、`main` に入るたびに動く CI がダウンロードに失敗する）。
- 画面の出典の 1 行と「出典と利用条件」のページは、財務省の予算書・決算書データベース（PDL1.0）の表記のまま（過去年度で変わらない）。

## 基準データの公開分

`packages/pipeline/src/migrate/package.ts` が、基準データ（`data/dataset/reference-v0/`、手元の全体）から、公開できる分だけの `reference-v0.tar.gz` を作る。

```bash
node packages/pipeline/src/migrate/package.ts data/dataset/reference-v0 datasets/reference-v0/manifest.json <出力ディレクトリ>
gh release create dataset-reference-v0 <出力ディレクトリ>/reference-v0.tar.gz --title ... --notes-file ...
cp <出力ディレクトリ>/manifest.json datasets/reference-v0/published-manifest.json
cp <出力ディレクトリ>/release.json datasets/reference-v0/release.json
```

- **入れる書:** `datasets/terms.json` で、利用条件の本文を読んだ（`basis` = `page-read`）書で、`status` が `unconfirmed` でないもの。今は 671 書（`pdl1.0` 651、`diet-courts` 20）。
- **入れない書:** 会計検査院と裁判官訴追委員会の 10 書（規約のサイトが応答せず、本文が未読）。CSV と plain text を入れず、`unresolved.csv` からその書の行を除く。`pdf-corpus-freeze.json` と `plain-text-manifest.json` は全 PDF の記録（URL・SHA-256）のままで、その 10 書の内容は含まない。manifest の `published.excludedSources` に、入れなかった書を残す。
- **PDF は入れない。** CSV と plain text、予算書の CSV だけ（40.7 MB、2,248 ファイル）。
- **照合:** tar.gz の中身は `verify.ts` で公開分の manifest と全件一致する。tar.gz 自体の SHA-256 は `release.json` に固定する（tar の並びは決まっているが、tar.gz のバイト列は作るたびに変わりうるので、リリースに置いたものを正とする）。
- 出力は公開分の基準データだけで作るので、手元の全体から作る JSON より、会計検査院・裁判官訴追委員会の項が少ない（FY2023〜FY2027 の年度推移で 1,239 → 1,236 行、概算要求書の URL 474 → 464）。

## 出典と利用条件の表示

PDL1.0 は、出典の記載と、加工したことの記載を求め、加工した情報を国が作成した未加工の情報のように見せることを禁じる。画面は次を出す。

- 全画面の下に、出典と加工の 1 行（`apps/web/src/components/SourceNote.tsx`）。
- 「出典と利用条件」のページ（`#/about`、`apps/web/src/AboutPage.tsx`）: 出典と加工の説明、誤りの可能性、機関ごとの規約へのリンク（`about.json`。`build:data` が、取り込んだ書の機関と `terms.json` から作る）、国会・裁判所の資料の扱い、取り込んだ資料の数、入れていない機関。
- `build:data` は、`terms.json` で `pdl1.0` か `diet-courts` でない機関の書が基準データに含まれていたら止まる（公開してはいけないものを黙って通さない）。

## 未確認

- 会計検査院と裁判官訴追委員会の規約の本文（サイトが応答しない）。読めたら、その 10 書を入れて公開分を作り直す。
- 規約は変わることがある。基準データを更新するときに、規約のページを読み直す。
- 国会・裁判所の資料を画面に載せる範囲（名前・コード・金額・頁の表）は、法律の専門家には確かめていない（`docs/decisions/0004`、`0005`）。
