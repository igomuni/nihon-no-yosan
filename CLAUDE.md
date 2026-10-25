# CLAUDE.md

このリポジトリで作業する AI エージェント向けの指示。

## コマンド

```bash
npm run check      # 型チェック（tsc -b）・lint・テスト（vitest）
npm run build:data # 基準データ（と、あれば過去年度のデータ）から画面用の JSON を作る（apps/web/public/data/）
npm run dev        # 画面の開発サーバー（先に build:data）
```

## 構成と依存

- `packages/core`: 純粋な関数と型。React と Node の fs を使わない。
- `packages/pipeline`: データを作る（基準データの凍結・照合など）。core を使う。
- `apps/web`: 画面（Vite + React の静的サイト）。core を使う。pipeline は import しない。画面が読む JSON は `npm run build:data` で作り、git に入れない（`docs/decisions/0006-web-app.md`）。
- 構成の理由は `docs/decisions/0001-repository.md`。

## ドキュメント

書き方の規則は `docs/guides/documentation.md`。要点:

- 恒久的な仕様は `docs/guides/`、決めたことは `docs/decisions/`、作業メモは `docs/notes/`。
- コードとガイドから `docs/notes/` を参照しない。
- 事実はデータで裏を取り、取れないものは「未確認」「推測」と書く。

## データ

- 原本（`data/`）は git に入れない。方針は `docs/guides/data.md`。
- データセットは、利用条件を確かめるまで公開しない。
- `data/` の原本は大きい（PDF・zip は GB 級）。中身を見るときは `head` や集計のスクリプトで必要な部分だけ読み、全体を読み込まない。

## 作業の進め方

- `main` に直接 push しない。作業はブランチで行う。
- 実装と `npm run check` が済んだら、draft PR を作ってよい（`gh pr create --draft`）。PR の説明は、レビューにそのまま渡せる形で書く。
- ready 化とマージはユーザーが行う。マージは merge commit（squash しない）。別の PR に依存するブランチは、その PR のブランチを merge して積んでよい。依存は PR の説明に書く。
- データの処理では、便宜的な仮定や「初期は簡易版で」を置かない。データで判定できるならそちらを使う。
