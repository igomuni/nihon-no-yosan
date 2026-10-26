import { describe, expect, it } from 'vitest';
import type { BudgetRequestMofDetail } from './budget-request-mof.ts';
import type { BudgetRequestJikouData } from './budget-request-trend.ts';
import { bigramDice, jikouKeyOfMofRow, requestJikouPairing } from './request-jikou-pairing.ts';

const j = (...rows: [string, number | null, number | null][]): BudgetRequestMofDetail => ({ j: rows.map(([n, q, b]) => [n, '', q, b]), m: [] });
const rows: Record<string, BudgetRequestMofDetail> = {
  // 対応のある項: 両側 2、要求のみ 2（1 つは要求額 0、1 つは予算のみの事項と名前が近い）、予算のみ 2（額あり）
  '2024|matched|0|財務省|財務省||財務本省|項 A': j(['甲に必要な経費', 100, 110], ['乙に必要な経費', 100, 400], ['大学等における修学に必要な経費', 500, null], ['終了した経費', 0, null], ['大学等における修学の支援に必要な経費', null, 520], ['新しい経費', null, 30]),
  '2024|zero|0|財務省|財務省||財務本省|項 B': j(['廃止の経費', 0, null]),
  '2024|reqOnly|0|財務省|財務省||財務本省|項 C': j(['要求だけの経費', 5, null]),
  '2024|mofOnly|0|財務省|財務省||財務本省|項 D': j(['予算だけの経費', null, 7]),
  '2025|matched|0|財務省|財務省||財務本省|項 A': j(['甲に必要な経費', 100, 100]),
};

describe('bigramDice', () => {
  it('is 1 for the same name, 0 for names with no shared 2-grams', () => {
    expect(bigramDice('abc', 'abc')).toBe(1);
    expect(bigramDice('abc', 'xyz')).toBe(0);
    expect(bigramDice('大学等における修学に必要な経費', '大学等における修学の支援に必要な経費')).toBeGreaterThan(0.5);
  });
});

describe('requestJikouPairing', () => {
  const jikou: BudgetRequestJikouData = { years: { '2024': [[jikouKeyOfMofRow('2024|matched|0|財務省|財務省||財務本省|項 A'), ['印'], '']] } };
  const [y24, y25] = requestJikouPairing(rows, jikou);
  it('counts the 事項 on each side and where the one-sided ones are', () => {
    expect(y24).toMatchObject({ year: 2024, request: 6, budget: 5, both: 2 });
    expect(y24!.requestOnly).toEqual({ matched: 2, zeroKou: 1, requestOnlyKou: 1, matchedZero: 1 });
    expect(y24!.budgetOnly).toEqual({ matched: 2, mofOnlyKou: 1, matchedZero: 0 });
    expect(y25).toMatchObject({ year: 2025, request: 1, budget: 1, both: 1 });
  });
  it('measures how close the paired amounts are (budget ÷ request)', () => {
    expect(y24!.ratio).toEqual({ n: 2, near: 1, median: 4, extreme: 0 });
  });
  it('pairs the one-sided 事項 of a matched 項 by name closeness, one to one', () => {
    expect(y24!.leftover).toEqual({ namePairs: 1, samePairs: 1, requestZeroPairs: 0, unpairedRequest: 1, unpairedRequestZero: 1, unpairedBudget: 1, unpairedBudgetZero: 0 });
  });
  it('counts how many of them are in a 項 with a 事項要求 mark', () => {
    expect(y24!.marks).toEqual({ budgetOnlyPositive: 2, budgetOnlyInMarkedKou: 2, requestZero: 1, requestZeroInMarkedKou: 1 });
    expect(y25!.marks).toEqual({ budgetOnlyPositive: 0, budgetOnlyInMarkedKou: 0, requestZero: 0, requestZeroInMarkedKou: 0 });
  });
  it('gives no marks when the 事項要求 data is not passed', () => {
    expect(requestJikouPairing(rows)[0]!.marks).toBeNull();
  });
});
