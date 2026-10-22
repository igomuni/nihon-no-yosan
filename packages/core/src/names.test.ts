import { describe, expect, it } from 'vitest';
import { fold, nameKey, normalizeCodeHyphen } from './names.ts';

describe('fold', () => {
  it('turns full-width ASCII into ASCII and half-width kana into full-width, and leaves other characters', () => {
    expect(fold('Ａ４（ｶﾅ）')).toBe('A4(カナ)');
    expect(fold('①Ⅱ')).toBe('①Ⅱ');
  });
  it('turns only the confirmed PDF gaiji into the character', () => {
    expect(fold('貨幣交換差減補\uE5E3金')).toBe('貨幣交換差減補填金');
    expect(fold('Ａ４\uEF63５冊')).toBe('A4\uEF635冊');
  });
});

describe('nameKey', () => {
  it('removes half- and full-width spaces after folding', () => {
    expect(nameKey('消費者庁\u3000共通費 ')).toBe('消費者庁共通費');
    expect(nameKey(undefined)).toBe('');
  });
});

describe('normalizeCodeHyphen', () => {
  it('unifies hyphen variants in codes', () => {
    expect(normalizeCodeHyphen('01\u201195')).toBe('01-95');
    expect(normalizeCodeHyphen('01\u221295\uFF0D3')).toBe('01-95-3');
  });
});
