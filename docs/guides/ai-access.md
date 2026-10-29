# AI・プログラムから使うための入口

公開サイト（`https://igomuni.github.io/nihon-no-yosan/`）は、画面を JavaScript で描く静的サイトなので、ページの HTML には中身が無い。画面を読めない取得ツールや、データだけがほしい AI・プログラムのために、**データを、画面を介さず、直接取れる入口**を置く。

## 入口

| 入口 | 場所 | 中身 |
|---|---|---|
| データの目録 | `data/index.json` | 配る JSON の一覧。ファイルごとに、説明・読み方の文書・大きさ・SHA-256・トップレベルのキーの形と件数と説明。読み方の約束（`conventions`）、元の CSV（GitHub Releases のデータセット）の置き場（`releases`）、文書（`guides`） |
| AI 向けの案内 | `llms.txt` | 目的・最初に読むもの・データの一覧・読み方の要点・利用条件を、短い Markdown で。英語の要約を 1 段落つける |
| 出典と利用条件 | `data/about.json` | 取り込んだ機関と利用規約のページ、基準データの版、予算書・RS の出どころ |
| `index.html` | ルート | `<meta name="description">`、`<link rel="alternate">`（目録と `llms.txt`）、`<noscript>`（目的と、目録・`llms.txt`・出典・文書へのリンク）。JavaScript を実行しない取得でも、ここから入口に着く |

## 読み方の約束（`index.json` の `conventions`）

- 各 `*.json.gz` は gzip の JSON。配信先が Content-Encoding を付けるかは決まっていないので、受け取ったバイト列が gzip（先頭が `1f 8b`）なら、伸ばしてから読む。`about.json` と `index.json` は、そのままの JSON。
- 年度は西暦。値が無いことは `null`（0 とは別）。
- 額の単位は、`lifecycle/jikou`・`lifecycle/moku`・`trend/*`・`mof/*` が千円、`rs/jigyo` と `lifecycle/data` の events の「円」の列が円。決算の目の額は、原本が円なので千円に直した値（小数がありうる）。
- 項の id は `{年度}:{general|special}:{鍵}`。`lifecycle/*` と `rs/jigyo` は、この id で結べる。
- 配列の多くは、列名の無い配列（位置で意味が決まる）。列の意味は、各ファイルの `docs` の文書にある。
- 目の分類コードの位置は、一般会計と特別会計で違う（特別会計は、財政法の区分が無い）。コードの名前は `lifecycle/codes.json.gz`（主要経費別・使途別だけ）。

## 目録の作り方

- `npm run build:data`（`packages/pipeline/src/build/web-data-cli.ts`）が、配る JSON を書いたあとに、`data-catalog.ts` の `buildDataCatalog` で `index.json` を作る。大きさ・SHA-256・キーの形と件数は、出力したバイト列から数える。説明・文書・約束は、`DATA_FILE_SPECS` と `CONVENTIONS`（`data-catalog.ts`）に 1 か所で持つ。
- **説明の無いファイルを配ろうとすると、ビルドが止まる**（目録に載らないファイルを作らない）。目録の説明にあるキーがデータに無いときも止まる（ビルドによって出ないキーは、`optionalKeys`）。
- 元の CSV の置き場は、`datasets/*/release.json` のタグから（`web-publish.md`）。
- `llms.txt` と `index.html` は、リポジトリの静的なファイル（`apps/web/public/llms.txt`、`apps/web/index.html`）。ファイルを足したり、約束を変えたときは、目録と同じ内容に直す。

## `robots.txt` と `sitemap.xml` を置かない理由

- `robots.txt` は、ホストのルート（`https://igomuni.github.io/robots.txt`）に置かないと、クローラーは読まない。このサイトは、プロジェクトのページ（`/nihon-no-yosan/` 以下）なので、ここに置いても、効かない。
- 画面の URL は、ハッシュ（`#/lifecycle`）で切り替える。ハッシュは、検索のインデックスでは、別の URL として扱われないので、`sitemap.xml` に並べる意味が無い。

## 未確認

- 各種の AI・取得ツールが、この入口を、実際にどう読むか（試していない。構造からの設計）。
- `llms.txt` を、サイトのパス（`/nihon-no-yosan/llms.txt`）に置いて、ホストのルート（`/llms.txt`）を読むツールに届くか（届かない）。URL を渡されたときに読める、という前提。

## このあと（予定）

列名を、データ自身に添える（`columns`）。画面の状態（タブ・年度・フィルタ・選択）を URL で共有する。
