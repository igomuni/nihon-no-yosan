import { describe, expect, it } from 'vitest';
import { mofAmountJikou, mofAmountKou, mofAmountMoku, mofKouKey, mofKouNameKey, mofMokuCode, reqMokuClassCodes, reqMokuCode } from './mof.ts';

describe('mofKouKey / mofKouNameKey', () => {
  const general = { 所管: '内閣府', 組織: '内閣本府', 項コード: '01', 項名: '内閣本府共通費 ' };
  const special = { 特別会計: '東日本大震災復興', 勘定: '', 項コード: '01', 項名: '復興庁共通費' };
  it('uses 所管・組織 for the general account and 特別会計・勘定 for special accounts, with names aligned', () => {
    expect(mofKouKey(general, 'general')).toBe('内閣府|内閣本府|01|内閣本府共通費');
    expect(mofKouKey(special, 'special')).toBe('東日本大震災復興||01|復興庁共通費');
  });
  it('leaves the 項 code out of the name key', () => {
    expect(mofKouNameKey(general, 'general')).toBe('内閣府|内閣本府|内閣本府共通費');
    expect(mofKouNameKey(special, 'special')).toBe('東日本大震災復興||復興庁共通費');
  });
});

describe('mofAmount*', () => {
  it('reads this year’s amount column of each table', () => {
    expect(mofAmountKou({ '前年度予算額の合計': '9', '令和8年度要求額の合計': '1,000' })).toBe(1000);
    expect(mofAmountJikou({ '前年度予算額': '9', '令和8年度要求額': '△5' })).toBe(-5);
    expect(mofAmountMoku({ '令和8年度要求額(千円)': '7' })).toBe(7);
    expect(mofAmountMoku({ '令和8年度要求額の合計': '7' })).toBeNull();
  });
});

describe('目のコード', () => {
  it('takes 主要経費＋目的別 and 目別 on both sides', () => {
    expect(reqMokuCode('95016-2725-16-9902')).toBe('95016-16');
    expect(reqMokuCode('65061-9-18-1010、65061-9-18-1020')).toBe('65061-18');
    expect(reqMokuCode('95016')).toBe('');
    expect(mofMokuCode({ 主要経費別分類コード: '95', 目的別分類コード: '016', 目別分類コード: '16' })).toBe('95016-16');
  });
});

describe('reqMokuClassCodes', () => {
  it('splits the 要求書 code of a 一般会計 目 into 主要経費・目的別・財政法・経済性質・使途', () => {
    expect(reqMokuClassCodes('95016-2111-02-0000', 'general')).toBe('95|016|2|11|1');
    expect(reqMokuClassCodes('95016\u20112111\u201103\u20110000', 'general')).toBe('95|016|2|11|1');
  });
  it('splits a 特別会計 code (no 財政法; 経済性質 is 2 digits, left out when 00)', () => {
    expect(reqMokuClassCodes('63191-815-16-5209', 'special')).toBe('63|191|81|5');
    expect(reqMokuClassCodes('65061-9-18-1010', 'special')).toBe('65|061|00|9');
  });
  it('takes the first of several codes, and gives null instead of guessing for a form it does not know', () => {
    expect(reqMokuClassCodes('95016-2111-02-0000、95016-2111-02-0100', 'general')).toBe('95|016|2|11|1');
    expect(reqMokuClassCodes('95016-111-02-0000', 'general')).toBeNull();
    expect(reqMokuClassCodes('95016-2111-02', 'general')).toBeNull();
    expect(reqMokuClassCodes('95016-11-02-0000', 'special')).toBeNull();
    expect(reqMokuClassCodes('03-0300', 'general')).toBeNull();
  });
});
