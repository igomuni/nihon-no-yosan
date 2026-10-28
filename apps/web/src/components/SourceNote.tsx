/** 出典と加工の表示（全画面の下に出す。PDL1.0 の出典の記載・加工したことの記載）。詳細は「出典と利用条件」 */
export function SourceNote({ rs = false }: { /** RS（行政事業レビュー）のデータを出している画面 */ rs?: boolean }) {
  return (
    <footer className="shrink-0 border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-500 dark:border-neutral-800">
      出典: 各府省・機関の歳出概算要求書、財務省「予算書・決算書データベース」{rs ? '、行政事業レビュー見える化サイト（https://rssystem.go.jp）' : ''}を加工して作成。国や各府省が作成した加工していない情報ではありません。
      <a href="#/about" className="ml-1 text-emerald-700 underline dark:text-emerald-400">出典と利用条件</a>
    </footer>
  );
}
