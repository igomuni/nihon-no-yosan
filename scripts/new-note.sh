#!/bin/bash
# 作業メモを作る。使い方: npm run note -- <タイトル>
# ファイル名の日時と「作成日」を、時計（日本時間）から付ける。推測で書かない（docs/guides/documentation.md）。
set -euo pipefail
title="${1:?usage: npm run note -- <タイトル>}"
stamp=$(TZ=Asia/Tokyo date '+%Y%m%d_%H%M')
day=$(TZ=Asia/Tokyo date '+%Y-%m-%d')
file="docs/notes/${stamp}_${title// /_}.md"
if [ -e "$file" ]; then echo "既にある: $file" >&2; exit 1; fi
printf '# %s\n\n作成日: %s（日本時間）\n状態: （作業メモ。結論や承認ではないことなど、1〜2 行で書く）\n\n' "$title" "$day" > "$file"
echo "$file"
