# CLAUDE.md

このリポジトリで作業する AI エージェント向けの指示。

## コマンド

```bash
npm run check      # 型チェック（tsc -b）・lint・テスト（vitest）
```

## 構成と依存

- `packages/core`: 純粋な関数と型。React と Node の fs を使わない。
- `packages/pipeline`（予定）: データを作る。core を使う。
- `apps/web`（予定）: 画面。core を使う。pipeline は import しない。
- 構成の理由は `docs/decisions/0001-repository.md`。

## ドキュメント

書き方の規則は `docs/guides/documentation.md`。要点:

- 恒久的な仕様は `docs/guides/`、決めたことは `docs/decisions/`、作業メモは `docs/notes/`。
- コードとガイドから `docs/notes/` を参照しない。
- 事実はデータで裏を取り、取れないものは「未確認」「推測」と書く。

## データ

- 原本（`data/`）は git に入れない。方針は `docs/guides/data.md`。
- データセットは、利用条件を確かめるまで公開しない。
