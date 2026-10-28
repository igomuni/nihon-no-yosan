import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from '@nihon-no-yosan/core';
import { buildRsLink } from './rs-link.ts';

const kou = (o: Partial<LifecycleKou>): LifecycleKou => ({ id: '', year: 2025, account: 'general', ministry: '', org: '', specialAccount: '', subAccount: '', code: '', name: '', seenIn: ['budget'], ...o });
const kous = [
  kou({ id: 'g1', ministry: '内閣', org: '内閣官房', code: '001', name: '内閣官房共通費' }),
  kou({ id: 'g1-24', year: 2024, ministry: '内閣', org: '内閣官房', code: '001', name: '内閣官房共通費' }),
  // 同じ名前で、項コードが違う項が 2 つ（1 つに決められない）
  kou({ id: 'g2a', ministry: '財務省', org: '財務本省', code: '010', name: '共通費' }),
  kou({ id: 'g2b', ministry: '財務省', org: '財務本省', code: '011', name: '共通費' }),
  // 特別会計: 同じ会計・項名で、勘定が違う 2 つ
  kou({ id: 's1', account: 'special', ministry: '厚生労働省', specialAccount: '労働保険', subAccount: '雇用勘定', code: '01', name: '雇用安定費' }),
  kou({ id: 's2', account: 'special', ministry: '厚生労働省', specialAccount: '労働保険', subAccount: '労災勘定', code: '01', name: '雇用安定費' }),
  kou({ id: 's3', account: 'special', ministry: '経済産業省', specialAccount: 'エネルギー対策', subAccount: '', code: '01', name: '安全規制対策費' }),
  // 概算要求書にだけある項は、結ばない
  kou({ id: 'r1', ministry: '内閣', org: '内閣官房', code: '', name: '要求だけの項', requestOnly: 'reqOnly' }),
];
const row = (o: Record<string, string>): Record<string, string> => ({ 予算事業ID: '1', 予算年度: '2025', 会計区分: '一般会計', 会計: '一般会計', 勘定: '', 予算種別: '当初予算', 所管: '内閣', '組織・勘定': '内閣官房', 項: '内閣官房共通費', 目: '庁費', '予算額(歳出予算項目ごと)': '28381000', ...o });
const hasMoku = (id: string, key: string): boolean => id === 'g1' && key === '庁費';

describe('buildRsLink', () => {
  const { rows, stats } = buildRsLink([
    row({}), //  0 結べる（目も）
    row({ 目: '旅費' }), //  1 項は結べるが、予算書に同じ目名が無い
    row({ 予算年度: '2024' }), //  2 年度が違えば、その年度の項に
    row({ 項: '', 目: '', 所管: '', '組織・勘定': '', 予算種別: '前年度から繰越し' }), //  3 項が空欄
    row({ 項: '無い項' }), //  4 項が書いてあるが、予算書に無い
    row({ 所管: '財務省', '組織・勘定': '財務本省', 項: '共通費' }), //  5 同じ名前の項が 2 つ
    row({ 会計区分: '特別会計', 会計: '労働保険', 勘定: '雇用勘定', 所管: '厚生労働省', '組織・勘定': '雇用勘定', 項: '雇用安定費' }), //  6 勘定で絞る
    row({ 会計区分: '特別会計', 会計: '労働保険', 勘定: '', 所管: '厚生労働省', 項: '雇用安定費' }), //  7 勘定が空で、絞れない
    row({ 会計区分: '特別会計', 会計: 'エネルギー対策', 勘定: '電源開発促進勘定', 所管: '経済産業省', 項: '安全規制対策費', 目: '' }), //  8 予算書の勘定が空でも、1 つなら結ぶ
    row({ 項: '要求だけの項' }), //  9
    row({ '予算額(歳出予算項目ごと)': '' }), // 10 額が空欄
  ], kous, hasMoku);

  it('links a row to the 項 of the same 年度 by 所管・組織・項名 (名前でそろえる)', () => {
    expect([rows[0]!.status, rows[0]!.kouId, rows[0]!.mokuHit]).toEqual(['linked', 'g1', true]);
    expect([rows[2]!.status, rows[2]!.kouId]).toEqual(['linked', 'g1-24']);
  });

  it('keeps a row that is not linked, with the reason (nothing is dropped)', () => {
    expect(rows).toHaveLength(11);
    expect([rows[1]!.status, rows[1]!.mokuHit]).toEqual(['linked', false]);
    expect(rows.map(r => r.status)).toEqual(['linked', 'linked', 'linked', 'noKou', 'unmatched', 'ambiguous', 'linked', 'ambiguous', 'linked', 'unmatched', 'linked']);
    expect(rows[3]!.kind).toBe('前年度から繰越し');
  });

  it('narrows a 特別会計 by 勘定 only when several 項 have the same 会計 and 項名', () => {
    expect(rows[6]!.kouId).toBe('s1');
    expect(rows[8]!.kouId).toBe('s3');
  });

  it('does not link to a 項 that is only in the 概算要求書', () => {
    expect(rows[9]!.status).toBe('unmatched');
  });

  it('reads the 予算額 as 円, and null for a blank', () => {
    expect(rows[0]!.yen).toBe(28381000);
    expect(rows[10]!.yen).toBeNull();
  });

  it('counts the rows by 年度 and 状態, the 事業 that have a linked row, and the 目', () => {
    expect(stats.rows[2025]).toEqual({ linked: 5, noKou: 1, unmatched: 2, ambiguous: 2 });
    expect(stats.rows[2024]).toEqual({ linked: 1, noKou: 0, unmatched: 0, ambiguous: 0 });
    expect(stats.jigyo[2025]).toEqual({ total: 1, linked: 1 });
    expect(stats.moku).toEqual({ named: 5, hit: 2 });
  });
});
