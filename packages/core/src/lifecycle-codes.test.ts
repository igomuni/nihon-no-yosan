import { describe, expect, it } from 'vitest';
import { codeNameOf, codesOfMoku, type LifecycleCodeTables } from './lifecycle-codes.ts';

const t: LifecycleCodeTables = {
  pages: [
    { year: 2023, form: '11001', major: [['20', '国債費'], ['94', 'コロナ予備費']], use: [['1', '人件費']] },
    { year: 2025, form: '11001', major: [['20', '国債費'], ['94', '物価高騰対応予備費']], use: [['1', '人件費']] },
    { year: 2024, form: '12001', major: [['20', '国債費（特別）']], use: [['1', '人件費']] },
  ],
};

describe('codesOfMoku', () => {
  it('takes the 主要経費別 as the first code, and the 使途別 as the 5th (一般会計) or the 4th (特別会計, no 財政法)', () => {
    expect(codesOfMoku('95|016|2|11|1', 'general')).toEqual({ major: '95', use: '1' });
    expect(codesOfMoku('95|016|81|5', 'special')).toEqual({ major: '95', use: '5' });
  });

  it('returns blanks when the 目 has no code (a 目 only in the 概算要求書)', () => {
    expect(codesOfMoku('', 'general')).toEqual({ major: '', use: '' });
    expect(codesOfMoku('95|016', 'general')).toEqual({ major: '95', use: '' });
  });
});

describe('codeNameOf', () => {
  it('uses the table of the 当初予算 of the same year and account, and tells when it had to use a nearby year', () => {
    expect(codeNameOf(t, 'major', '94', 2023, 'general')).toEqual({ name: 'コロナ予備費', approx: false });
    expect(codeNameOf(t, 'major', '94', 2025, 'general')).toEqual({ name: '物価高騰対応予備費', approx: false });
    expect(codeNameOf(t, 'major', '20', 2024, 'special')).toEqual({ name: '国債費（特別）', approx: false });
    // 2024 の一般会計のページは無いので、近い年度（同じ距離なら前の年度）
    expect(codeNameOf(t, 'major', '94', 2024, 'general')).toEqual({ name: 'コロナ予備費', approx: true });
  });

  it('returns null for a code that no table has', () => {
    expect(codeNameOf(t, 'major', '77', 2024, 'general')).toBeNull();
    expect(codeNameOf(t, 'use', '7', 2024, 'special')).toBeNull();
  });
});
