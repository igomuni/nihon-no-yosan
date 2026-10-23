/** 会計区分のバッジ（一般 / 特別）。白文字とのコントラスト比 4.5:1 前後の濃さ */
export function AccountBadge({ account }: { account: 'general' | 'special' }) {
  const [label, background] = account === 'general' ? ['一般', '#e45f6f'] : ['特別', '#5f8ee8'];
  return (
    <span className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-white" style={{ background }}>
      {label}
    </span>
  );
}
