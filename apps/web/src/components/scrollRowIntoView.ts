/**
 * 一覧（固定ヘッダーつきの表）の中で、行が見える位置までスクロールする。
 * `scrollIntoView({ block: 'nearest' })` は、行を端に寄せるので、上へ動くときに固定ヘッダーの下に隠れる。ここでは、ヘッダーを除いた範囲で、見えていなければ中央に置く。
 */
export function scrollRowIntoView(container: HTMLElement | null, row: HTMLElement | undefined): void {
  if (!container || !row) return;
  const head = container.querySelector('thead')?.getBoundingClientRect().height ?? 0;
  const box = container.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const top = r.top - box.top, bottom = r.bottom - box.top;
  if (top >= head && bottom <= container.clientHeight) return;
  container.scrollTop += top - head - (container.clientHeight - head - r.height) / 2;
}
