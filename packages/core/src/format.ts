/**
 * 金額の表示。入力は千円。兆・億・万・円の単位で、整数部の桁数に応じて小数の桁を決める。
 * 例: 123,456,789（千円）→ `1,235億円`（整数部 4 桁 → 小数なし）、12,345,678 → `123.5億円`（3 桁 → 小数第一位）、1,234,567 → `12.35億円`（2 桁以下 → 小数第二位）
 */
export function formatBudgetShort(amount: number): string {
  const yen = amount * 1000;
  const unit = (value: number, name: string): string => {
    const digits = Math.floor(value).toString().length;
    return digits >= 4 ? `${Math.round(value).toLocaleString()}${name}` : digits === 3 ? `${value.toFixed(1)}${name}` : `${value.toFixed(2)}${name}`;
  };
  if (yen >= 1_000_000_000_000) return unit(yen / 1_000_000_000_000, '兆円');
  if (yen >= 100_000_000) return unit(yen / 100_000_000, '億円');
  if (yen >= 10_000) return unit(yen / 10_000, '万円');
  return `${Math.round(yen).toLocaleString()}円`;
}

/** 千円の金額を表示する。負の値は先頭に − を付ける。null は – */
export function formatSen(amount: number | null): string {
  if (amount === null) return '–';
  return amount < 0 ? `−${formatBudgetShort(-amount)}` : formatBudgetShort(amount);
}

/** 符号付き（増減用）。0 は符号なし */
export function formatSenSigned(amount: number | null): string {
  if (amount === null) return '–';
  return amount > 0 ? `+${formatSen(amount)}` : formatSen(amount);
}

export function formatRate(rate: number | null): string {
  if (rate === null) return '–';
  return `${rate > 0 ? '+' : ''}${(rate * 100).toFixed(2)}%`;
}
