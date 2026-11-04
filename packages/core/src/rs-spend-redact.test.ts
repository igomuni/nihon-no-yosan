import { describe, expect, it } from 'vitest';
import { normalizeRsText } from './csv.ts';
import { hasNoCorpNumber, redactSpend, REDACT_MARK, type SpendKey } from './rs-spend-redact.ts';
import type { Rec } from './csv.ts';

const empty = (): Record<SpendKey, Rec[]> => ({ '5-1': [], '5-2': [], '5-3': [], '5-4': [] });
const r51 = (name: string, corp: string, extra: Rec = {}): Rec => ({ 府省庁: '厚生労働省', 支出先名: name, 法人番号: corp, 所在地: '東京都千代田区', 契約概要: '', ...extra });

describe('hasNoCorpNumber', () => {
  it('空と 9 だけは「ない」', () => {
    expect(hasNoCorpNumber('')).toBe(true);
    expect(hasNoCorpNumber(undefined)).toBe(true);
    expect(hasNoCorpNumber('9999999999999')).toBe(true);
    expect(hasNoCorpNumber('1234567890123')).toBe(false);
  });
});

describe('redactSpend', () => {
  const input = empty();
  input['5-1'] = [
    r51('山田太郎', ''),
    r51('山田太郎', '9999999999999'),
    r51('株式会社甲', '1111111111111'),
    r51('株式会社甲', ''), // 規則 5: 法人番号のある行にも出る名前は残す
    r51('受給者（一括）', ''), // 規則 1
    r51('九州防衛局', ''), // 規則 4
    r51('東京都', ''), // 規則 2（都道府県）
    r51('厚生労働省', ''), // 規則 2（府省庁）
    r51('World Bank', ''), // 規則 3
    r51('Incorporated大郎', ''), // 英語の語は単独でないと当たらない → 伏せる
    r51('鈴木花子', '', { 契約概要: '鈴木花子への委託' }),
    r51('法人あり', '2222222222222', { 契約概要: '山田太郎のほか' }),
  ];
  input['5-2'] = [{ 府省庁: '厚生労働省', 支出元の支出先ブロック名: '山田太郎', 支出先の支出先ブロック名: 'A', 資金の流れの補足情報: '', 国自らが支出する間接経費の項目: '' }];
  const out = redactSpend(input);
  const names = out.tables['5-1'].map(r => r['支出先名']);

  it('個人名らしい名前を置き換え、集計・機関・法人番号のある名前は残す', () => {
    expect(names).toEqual([REDACT_MARK, REDACT_MARK, '株式会社甲', '株式会社甲', '受給者（一括）', '九州防衛局', '東京都', '厚生労働省', 'World Bank', REDACT_MARK, REDACT_MARK, '法人あり']);
  });
  it('法人番号がない行の所在地は置き換え、ある行は残す', () => {
    const a = out.tables['5-1'].map(r => r['所在地']);
    expect(a[0]).toBe(REDACT_MARK);
    expect(a[2]).toBe('東京都千代田区');
    expect(a[3]).toBe(REDACT_MARK);
  });
  it('自由記述にも置き換えた名前が出れば置き換える（法人番号のある行も）', () => {
    expect(out.tables['5-1'][10]!['契約概要']).toBe(`${REDACT_MARK}への委託`);
    expect(out.tables['5-1'][11]!['契約概要']).toBe(`${REDACT_MARK}のほか`);
    expect(out.tables['5-2'][0]!['支出元の支出先ブロック名']).toBe(REDACT_MARK);
  });
  it('元の行は変えない', () => {
    expect(input['5-1'][0]!['支出先名']).toBe('山田太郎');
  });
  it('件数を数える', () => {
    expect(out.report.maskedDistinctNames).toBe(3);
    expect(out.report.stat['5-1']!.nameMaskedRows).toBe(4);
  });
  it('自由記述に 20 回以上出る語は、一般の語として自由記述では置き換えない', () => {
    const many = empty();
    many['5-1'] = [r51('あいう', ''), ...Array.from({ length: 20 }, () => r51('株式会社乙', '3333333333333', { 契約概要: 'あいうの件' }))];
    const o = redactSpend(many);
    expect(o.tables['5-1'][0]!['支出先名']).toBe(REDACT_MARK);
    expect(o.tables['5-1'][1]!['契約概要']).toBe('あいうの件');
    expect(o.report.freeTextNamesExcludedAsGeneric).toBe(1);
  });
});

describe('redactSpend on full-width (September) input', () => {
  it('keeps foreign organizations written in full-width letters once the text is normalized', () => {
    const raw = empty();
    raw['5-1'] = [r51('ＡＡＩＣ\u3000Ｐａｒｔｎｅｒｓ\u3000Ａｆｒｉｃａ\u3000Ｌｉｍｉｔｅｄ', ''), r51('山田太郎', '')];
    const norm = empty();
    norm['5-1'] = raw['5-1'].map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, normalizeRsText(v)])));
    expect(redactSpend(norm).tables['5-1'].map(r => r['支出先名'])).toEqual(['AAIC Partners Africa Limited', REDACT_MARK]);
    // 正規化しないと、全角の英字は規則（英語の組織語）に当たらず、伏せすぎになる
    expect(redactSpend(raw).tables['5-1'][0]!['支出先名']).toBe(REDACT_MARK);
  });
});
