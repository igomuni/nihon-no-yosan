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
- 配列の多くは、列名の無い配列（タプル。位置で意味が決まる）。列の名前・型・単位・意味は、**データ自身のトップレベルの `columns`**（キー → 列の配列）と、目録の `files[].columns` にある（次の「列の定義」）。
- 目の分類コードの位置は、一般会計と特別会計で違う（特別会計は、財政法の区分が無い）。コードの名前は `lifecycle/codes.json.gz`（主要経費別・使途別だけ）。

## 列の定義（`columns`）

タプルの配列を持つファイル（`lifecycle/data`・`lifecycle/jikou`・`lifecycle/moku`・`rs/jigyo`）は、トップレベルに `columns` を持つ。`columns[キー]` は、そのキーの配列の列の定義の配列。

```json
{ "name": "flags", "type": "number", "description": "状態（ビット）", "bits": { "suppItem": 1, "requestOnly": 32 } }
```

- `name`: 列の名前。`type`: `number`・`string`（値が無いことがあるときは `| null`）。`unit`: 額の単位（千円・円。額でない列は無し）。`description`: 意味。
- `values`: 取りうる値（出来事の種類、概算要求の目の取れ方、年度をまたぐ対応の額の確認など）。`valueLabels`: その日本語名。`bits`: ビットの列で、立てるビットの値（`flags` の目の状態、`evidence` の対応の根拠）。
- 定義は、`packages/core/src/data-columns.ts`（`DATA_COLUMNS`）に 1 か所で持つ。ビルド（`withColumns`）が、**全行の長さと列の数を照合して、合わなければ止まる**。配列の並びを変えたときは、定義も変える。
- 定義の無いもの: オブジェクトの配列（`lifecycle/data` の `kous`・`checks`・`links`）は、キーが名前なので不要。`trend/*`・`mof/*`（古い画面のデータ）は、短いキーのオブジェクトで、`docs` の文書（`trend.md`・`mof-ui.md`）にある。`lifecycle/codes` の `[コード, 名前]` の組は、`description` で説明している。

## 画面の状態を URL で共有する（`#/lifecycle?...`）

「予算の推移」の画面（`#/lifecycle`）は、状態（タブ・年度・フィルタ・選んだ行）を、URL のハッシュのクエリに書く。URL を渡せば、同じ画面（同じ一覧・同じ合計）を再現できる。実装は `packages/core/src/lifecycle-url.ts`（`encodeLifecycleUrl`・`decodeLifecycleUrl`。テストあり）。

| パラメーター | 意味 |
|---|---|
| `view` | タブ: `list`（項。既定は書かない）・`jikou`（事項）・`moku`（目）・`rs`（RS） |
| `year` | 年度（西暦）。画面は、いつも書く（既定の年度が変わっても、再現できるように） |
| `sel` | 選んだ行（見ているタブのもの）。項は項の id、事項は `{項の id}\|{事項名}`、目は `{項の id}\|{目の識別}`、RS は予算事業 ID |
| `publisher`・`group`・`acct`・`major`・`use` | 要求所管・予算所管・会計・主要経費別（コード）・使途別（コード）。複数は、同じ名前を繰り返す（`major=35&major=95`）。`__none__` は「なし」 |
| `org`・`name`・`jikou`・`moku` | 組織／勘定・項名・事項名・目名の検索語。正規表現のときは `org_re=1` のように、`_re=1` を付ける |
| `pattern`・`links` | 値のある段階（`all_stages`・`partial`・`no_budget`・`request_only`・`settle_only`）、年度をまたぐ対応（`unsettled`） |
| `ministry`・`bureau`・`name`・`link`（RS のとき） | 府省庁（繰り返し）・局・庁・事業名（`bureau_re=1`・`name_re=1`）・項への結び（`linked`・`unlinked`） |

- 書くのは、既定と違う値だけ（`year` を除く）。**URL にクエリがあるときは、それが状態のすべて**で、書かれていない項目は既定になる（ブラウザに保存した前回の状態は使わない）。クエリが無い `#/lifecycle` は、これまでどおり、保存した状態で始める。
- 知らないパラメーターと、不正な値は、無視して既定にする（落とさない）。
- **並べ替えと、列の幅は、URL に入れない**（一覧の合計・件数は変わらない。一覧は最大 600 行で、並びは既定）。
- 画面は、状態を変えるたびに、URL を書き換える（履歴は増やさない。戻るボタンで状態は戻らない）。
- 例: FY2024 の目で、主要経費別 = 防衛関係費（コード 35）かつ 使途別 = 人件費（コード 1）: `#/lifecycle?view=moku&year=2024&major=35&use=1`（32 件、政府案 1.94 兆円）。
- ほかの画面（`#/trend`・`#/mof`）の状態は、URL に入れない（まだ）。

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

ほかの画面（`#/trend`・`#/mof`）の状態の URL 化。分類別の内訳を、事前に計算して配る（`data/agg/`）。分類別の集計の画面。
