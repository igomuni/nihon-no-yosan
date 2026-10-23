import { Icon } from './Icon.tsx';

/** 文字列の検索。既定は部分一致で、`.*` で正規表現に切り替える（大文字小文字は区別しない。長さの上限は `maxRegexLength`） */
export function RegexTextFilter({ label, value, onChange, useRegex, onToggleRegex, maxRegexLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  useRegex: boolean;
  onToggleRegex: (useRegex: boolean) => void;
  maxRegexLength?: number;
}) {
  const invalid = useRegex && value !== '' && (!isValidRegex(value) || (maxRegexLength !== undefined && value.length > maxRegexLength));
  return (
    <div className="space-y-1">
      <span className="text-neutral-500">{label}</span>
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={useRegex ? '正規表現' : '部分一致'}
            aria-label={label}
            aria-invalid={invalid}
            className={`w-full rounded border bg-white py-1 pl-2 pr-7 text-xs outline-none dark:bg-neutral-900 ${invalid ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-700'}`}
          />
          <button
            type="button"
            onClick={() => onToggleRegex(!useRegex)}
            aria-pressed={useRegex}
            title={useRegex ? '正規表現をオフ' : '正規表現で絞り込み'}
            className={`absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 font-mono text-[10px] font-bold leading-none ${useRegex ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
          >
            .*
          </button>
        </div>
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label={`${label}を消す`} className="shrink-0 px-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {invalid && <p className="text-[10px] text-red-500">正規表現が不正です</p>}
    </div>
  );
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
