import { describe, expect, it } from 'vitest';
import { amount, normalizeRsText, parseCsv, readCsv, readRsCsv } from './csv.ts';

describe('parseCsv', () => {
  it('handles quoted commas, newlines and doubled quotes, and drops CR', () => {
    expect(parseCsv('a,"b,c","d\n""e"""\r\n1,2,3')).toEqual([
      ['a', 'b,c', 'd\n"e"'],
      ['1', '2', '3'],
    ]);
  });
});

describe('readCsv', () => {
  it('strips the BOM, skips blank lines and fills missing columns with empty strings', () => {
    expect(readCsv('\uFEFF項名,額\n事務取扱費,100\n\n施設費\n')).toEqual([
      { 項名: '事務取扱費', 額: '100' },
      { 項名: '施設費', 額: '' },
    ]);
    expect(readCsv('')).toEqual([]);
  });
});

describe('amount', () => {
  it('reads △ as minus and commas, and keeps blanks and non-numbers as null', () => {
    expect(amount('△1,234')).toBe(-1234);
    expect(amount(' 1,234 ')).toBe(1234);
    expect(amount('0')).toBe(0);
    expect(amount('')).toBeNull();
    expect(amount(undefined)).toBeNull();
    expect(amount('－')).toBeNull();
  });
});

describe('readRsCsv', () => {
  it('normalizes the header to NFKC and trims cell edges, but keeps the cell text otherwise', () => {
    const text = '\uFEFF予算事業ID,当初予算（合計）,事業名\n1,3025000 ,令和７年度　事業（Ａ）\n';
    expect(readRsCsv(text)).toEqual([{ 予算事業ID: '1', '当初予算(合計)': '3025000', 事業名: '令和７年度　事業（Ａ）' }]);
  });
  it('normalizeRsText applies NFKC and trims', () => {
    expect(normalizeRsText(' ＡＢＣ\u3000Ｌｔｄ． ')).toBe('ABC Ltd.');
  });
});
