# 0006 画面（apps/web）は Vite + React の静的サイトにする

日付: 2026-10-23。状態: 決定（暫定。変えるかもしれない）。

## 決めたこと

- **土台:** [Vite](https://vite.dev/) + React 19 + TypeScript。サーバー処理を持たない静的サイト（HTML・JS・CSS と JSON）として出す。画面は、ブラウザが JSON を読んで表示するだけ。
- **データ:** 画面が読む JSON（`kou.json.gz` など）は git に入れない。`npm run build:data` が、手元の基準データ（`data/dataset/reference-v0/`）から作って `apps/web/public/data/` に置く（`packages/pipeline/src/build/web-data-cli.ts`）。画面を動かすには、先に `build:data` が要る。
- **gzip の読み方:** サーバーが `Content-Encoding: gzip` を付けて返すとき（Vite の開発サーバー）は、ブラウザがすでに伸ばしている。付けないとき（GitHub Pages など）は `DecompressionStream` で伸ばす（`apps/web/src/data.ts`）。
- **依存の向き:** `web → core`。web は pipeline を import しない（`0001`）。絞り込み・並べ替えなどの純粋な関数は core に置き、テストする。
- **画面の規則:** 画面の文言・機能名・aria-label に「まるみえ」を使わない。アイコンは Material Icons を基準にし、Unicode の記号を直接埋め込まない。

## 理由

- 前のリポジトリの画面（年度推移、概算要求と当初予算の差）は、Next.js のサーバー機能を使っていない。クライアントで JSON を読んで表示するだけなので、静的サイトで足りる。依存と設定が少ない。
- JSON を git に入れると、数 MB の gzip がコミットのたびに履歴に残る。前のリポジトリが重くなった原因の一つ。

## 選ばなかった案

- **Next.js（前と同じ）:** 前のコードを移しやすいが、サーバー機能を使わないのに依存と設定が多い。
- **生成物を git に入れる:** 画面の確認が基準データ無しでできるが、履歴が重くなる。

## 変えるとき

土台を変えても、データ（JSON）と core の関数は変わらない。サーバー機能（API・認証）が要るようになったら、Next.js などを選び直す。
