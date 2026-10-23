/** 増減の色（増=赤系、減=青系）。値が無い・0 は既定色 */
export function changeColor(v: number | null): string {
  if (v === null || v === 0) return '';
  return v > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-blue-700 dark:text-blue-400';
}
