# nihon-no-yosan

日本の国の予算を、概算要求から当初予算・補正予算・決算まで、さらに行政事業レビュー（RS）の事業までつないで見るための、データ基盤と画面。

状態: 立ち上げ中。いまあるのは骨組みと、名前の表記の揃え方（`packages/core`）だけ。

## 構成

```text
packages/
  core/        純粋な関数と型（表記の揃え方・鍵・突合・検算）。React と Node の fs を使わない
  pipeline/    データを作る CLI（download → extract → build → publish）。未作成
apps/
  web/         画面（Next.js の予定）。未作成
datasets/      データセットの manifest（版・ファイル・SHA-256）。未作成
docs/
  guides/      恒久的な仕様。これだけで作り直せることを基準に書く
  decisions/   決めたこと（1 件 1 ファイル、理由つき）
  notes/       作業メモ
```

依存の向きは `web → core ← pipeline`。web は pipeline を import しない。

## データの方針

- 最終的な正は、公式の原本（各府省の概算要求書の PDF、財務省の予算書・決算書の CSV・XML、行政事業レビューの CSV）。
- 原本は git に入れない。URL と SHA-256 だけを manifest に書く。
- 原本の形の CSV を、正規化と構築の基準データにする。版つきのデータセットとして配る予定。ただし、データの再配布の条件を確かめるまでは公開しない。
- 詳しくは `docs/guides/data.md`。

## 開発

Node.js 24 以上。

```bash
npm install
npm run check      # 型チェック・lint・テスト
```

## 出典

- 各府省の歳出概算要求書
- 財務省の予算書・決算書（予算書・決算書データベース）
- 行政事業レビューシステム（rssystem.go.jp）

## ライセンス

コードは MIT（`LICENSE`）。データの利用条件は、それぞれの出典に従う。
