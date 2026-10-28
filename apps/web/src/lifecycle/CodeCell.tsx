import { CODE_AXIS_LABEL, codeNameOf, type CodeAxis, type LifecycleCodeTables, type LifecycleKou } from '@nihon-no-yosan/core';

/**
 * 分類コード（主要経費別・使途別）の列のセル。名前は、その年度の当初予算のコード表から引く（`codeNameOf`）。
 * コードが無いときは「—」（概算要求書にだけある目・事項の一部）。コード表が無い年度は、年度の近いページの名前を使い、ツールチップに書く。コード表を読み込み中は「…」。
 */
export function CodeCell({ tables, axis, code, year, account }: { tables: LifecycleCodeTables | null; axis: CodeAxis; code: string; year: number; account: LifecycleKou['account'] }) {
  const dim = 'whitespace-nowrap px-2 py-1 text-left text-neutral-300 dark:text-neutral-600';
  if (code === '') return <td className={dim} title={`${CODE_AXIS_LABEL[axis]}のコードが無い（概算要求書にだけある目・事項で、要求書のコードが読めなかった）`}>—</td>;
  if (!tables) return <td className={dim}>…</td>;
  const hit = codeNameOf(tables, axis, code, year, account);
  return (
    <td className="break-words px-2 py-1 text-left" title={`${CODE_AXIS_LABEL[axis]} ${code}${hit ? `${hit.approx ? '（この年度のコード表が無いので、近い年度の名前）' : ''}` : '（コード表に名前が無い）'}`}>
      {hit?.name ?? <span className="text-neutral-400">{code}</span>}
    </td>
  );
}
