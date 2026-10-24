# データの置き場と再現性

## 段

| 段 | 中身 | 置き場 |
|---|---|---|
| 原本 | 概算要求書の PDF、予算書・決算書の CSV（zip）・XML、行政事業レビューの CSV | 各自の `data/download/`（git に入れない）。URL と SHA-256 を manifest に書く |
| 基準データ | 原本の形の CSV（原本の列・行のまま。足し算・補完をしない） | 版つきのデータセット（予定） |
| 構築データ | 予算の一生の表・突合・年度推移など | 版つきのデータセット（予定） |
| 画面用 | 画面が読む JSON（gz） | git |

## 正と基準

- **最終的な正は公式の原本。** 基準データの値に疑いがあれば、原本で確かめる。
- **基準データは、正規化と構築の起点。** 構築データは、基準データから決まった手順で再生成でき、出力の SHA-256 が一致することを確かめる。

## 再現性の境界

- 初版で保証するのは、凍結した基準データ（データセットの初版）からの再生成まで。
- 原本からの再抽出（PDF → plain text、総表・明細表・表紙・目次の CSV）は、`docs/guides/extract.md`。手元の PDF からバイト一致で作り直せることを確かめた。

## 公開の関門

データセットは、各出典（行政事業レビューシステム、財務省、各府省、国会・裁判所）の利用条件と出典表記を確かめるまで公開しない（下の「出典の利用条件」）。原本そのもの（PDF・zip）は再配布しない。

## 基準データの初版（reference-v0）

前のリポジトリ（marumie-rssystem）の `3aef2de9d0f08a438c94efd32a3c0bc2ae33af19` から、バイト同一でコピーして作った。置き場は各自の `data/dataset/reference-v0/`（git に入れない）。git には `datasets/reference-v0/manifest.json`（全ファイルの SHA-256 とバイト数、書ごとの来歴と利用条件）と `datasets/terms.json` を入れる。

```text
budget-request/{年度}/{cover,toc,total-table,detail-table}/sources/{slug}.csv   概算要求書の CSV（原本の形）
budget-request/{年度}/detail-table/unresolved.csv                               明細表で列の決まらなかった行（build が読む）
budget-request/{年度}/plain-text/{slug}.txt, plain-text-manifest.json           PDF の全文（pdftotext -layout）とその記録
budget-request/{年度}/pdf-corpus-freeze.json                                    PDF の一覧（URL・SHA-256・頁数・取得方法）
mof-archive/{版}/*.csv, manifest.json                                           予算書の CSV（項・事項・目、補正・決算）
```

- `slug`: PDF の取得元のパス（`data/download/` を除き、`/` を `__` に、末尾の `.pdf` を除く）。CSV・plain text の名前と、PDF の一覧の対応はこれ。
- **入れないもの:** 診断・研究の出力（`arithmetic-diagnostics.csv`・`token-ledger.csv`・`line-audit.csv`・各 `summary.json` など）。件数は manifest の `excluded`。PDF そのものは再配布しない。
- 作る・確かめる:

```bash
node packages/pipeline/src/migrate/freeze.ts <前のリポジトリ> <commit> data/dataset/reference-v0 datasets/reference-v0/manifest.json datasets/terms.json
node packages/pipeline/src/migrate/verify.ts data/dataset/reference-v0 datasets/reference-v0/manifest.json
```

- `freeze` は、記録の SHA-256 と合わないものがあれば止まる（手元の PDF、plain text、予算書の CSV）。別のディレクトリに 2 回作って、manifest とディレクトリがバイト同一になることを確かめた。

**確かめた範囲（書ごとの `evidence`）**

| 項目 | 確かめたこと | 確かめていないこと |
|---|---|---|
| PDF | 手元のファイルの SHA-256 が、前のリポジトリの記録と一致した | 公式サイトから取り直して比べていない。`manual` で取った PDF（103 本）は、記録の上でも原本との同一性を照合できない |
| plain text | SHA-256 と頁数が、前のリポジトリの記録と一致した | 手元の PDF から取り直していない |
| CSV と PDF の対応 | ファイル名（slug）が同じ | CSV がその PDF から作られたことの独立の証明はない |
| 予算書の CSV | `mof-archive/manifest.json` の SHA-256 と一致した | 予算書の原本（zip・XML）から作り直していない。`kou-*.csv` は目の行を項で集計したもの（原本の形ではない） |

**範囲の限界**

- PDF の記録の `acquisition` が空の 82 本（FY2024）がある。
- 13 本の PDF は、CSV が 1 つも無い（plain text だけ、または文字層が無い）。
- `unresolved.csv` は、年度ごとに全機関の行が 1 ファイルに混ざっている。機関ごとに分けて公開するときは、行を `source_file` で分ける必要がある（まだ分けていない）。

## 出典の利用条件

ドメインごとの状態は `datasets/terms.json`（機械で読める記録。確認日 2026-10-22。2026-10-23 に、未確認と検索結果の説明だけだった分を読み直し、ドメインごとの `checkedOn` を付けた）。manifest の書ごとに、その状態を写している。規約は変わることがあるので、公開の前に確かめ直す。

| 状態 | ドメイン | 意味 |
|---|---|---|
| `pdl1.0` | 29（ページ本文を読んだ 28、サーバーが応答せず検索結果の説明だけ 1: 会計検査院） | [公共データ利用規約（第1.0版）](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)（PDL1.0。CC BY 4.0 と互換）。出典と、加工したこと・加工した者を書けば、加工したものを再配布できる。加工したものを、国が作った未加工の情報のように見せない |
| `diet-courts` | 5（衆議院・参議院・裁判所・裁判官弾劾裁判所・裁判官訴追委員会。ページ本文を読んだ 4、サーバーが応答せず検索結果の説明だけ 1: 裁判官訴追委員会） | 著作権法で認められる利用（私的使用・引用など）に限り、出所を明示して転載・複製できる。無断の改変はできない。規約の上では再配布は認められていない。名前・コード・額・頁の表（0004）と plain text（0005）は、著作物でない、または創作的な部分が小さいと判断して入れる |
| `unconfirmed` | 0 | 利用条件を確かめられていない。公開しない |

- **公開の関門:** 公開できるのは、`pdl1.0` と `diet-courts` のドメインの分。`basis` が `search-summary` のもの（会計検査院 `jbaudit.go.jp` の 5 本と、裁判官訴追委員会 `sotsui.go.jp` の 5 本）は、ページ本文を読んでから公開する（2026-10-23 に開こうとしたが、どちらのサーバーも応答しなかった）。`unconfirmed` の分は、確かめるまで公開しない（今は無い）。
- PDL1.0 は「数値データ、簡単な表・グラフ等は著作権による保護の対象ではありません」としている。国会・裁判所の書から作った表と plain text は、この解釈と 0004・0005 の判断で入れる。法律の専門家には確かめていない。
- 予算書の CSV・XML の出どころは、財務省の予算書・決算書データベース（`www.bb.mof.go.jp`）。このデータベースは自身の利用規約（`https://www.bb.mof.go.jp/terms/`）に PDL1.0 と出典の書き方を持つ。`www.mof.go.jp` の規約が及ぶとは書かれていない。
- 行政事業レビュー見える化サイト（`rssystem.go.jp`）自体の利用規約のページは見つけられていない。運営する内閣官房 行政改革推進本部事務局のサイトは PDL1.0 に準拠。

**出典表記の例（PDL1.0）:** `出典：財務省「令和8年度予算書」（ページの URL）を加工して作成`。

## 公開

公開できる分（利用条件の本文を確かめた書）だけを `reference-v0.tar.gz` にして、GitHub Releases（タグ `dataset-reference-v0`）に置く。作り方、入れない書、CI での照合は `docs/guides/web-publish.md`。公開分の manifest は `datasets/reference-v0/published-manifest.json`、tar.gz の SHA-256 は `datasets/reference-v0/release.json`。

## 未確認

- データセットの置き場（GitHub Releases の予定）の、1 ファイルの上限など。基準データの初版は 283 MB（2,298 ファイル）。
