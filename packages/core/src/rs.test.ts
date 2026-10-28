import { describe, expect, it } from 'vitest';
import { INITIAL_RS_FILTERS, filterRsRows, rsAmountShown, rsIndex, rsListRows, sortRsRows, type RsJigyoData } from './rs.ts';

const data: RsJigyoData = {
  years: [2024, 2025],
  kous: ['2025:general:A', '2025:general:B'],
  jigyo: [['1', '研修事業', '内閣官房', '室', ''], ['2', '調査事業', '総務省', '大臣官房', '一般歳出|その他'], ['10', '基金事業', '総務省', '局', '']],
  amounts: [
    [0, 2025, 100, null, 5, 0, 105, 90, 15, 120], [0, 2024, 80, 10, null, null, 90, 85, 5, 100],
    [1, 2025, 50, 7, 0, 0, 57, null, null, null],
    [2, 2024, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  links: [[0, 2025, 0, '庁費', '当初予算', 60], [0, 2025, 0, '旅費', '当初予算', 40], [0, 2025, 1, '', '前年度から繰越し', null], [1, 2024, 1, '庁費', '当初予算', 5]],
};
const index = rsIndex(data);
const NONE = '__none__';

describe('rsListRows', () => {
  it('lists the 事業 that have a row in the 年度, with or without a link to a 項', () => {
    const rows = rsListRows(index, 2025);
    expect(rows.map(r => r.id)).toEqual(['1', '2']);
    expect(rows[1]!.kouCount).toBe(0); // 項に結べない事業も一覧にある
    expect(rsListRows(index, 2024).map(r => r.id)).toEqual(['1', '10']);
  });

  it('counts the 項 that a 事業 is linked to in the 年度 (one 項 with several rows counts once)', () => {
    expect(rsListRows(index, 2025)[0]!.kouCount).toBe(2);
    expect(rsListRows(index, 2024)[0]!.kouCount).toBe(0); // 事業 1 は 2024 年度には結べた行が無い
  });

  it('keeps a missing value as null, not 0', () => {
    const r = rsListRows(index, 2025)[1]!;
    expect([r.spent, r.request, r.supp]).toEqual([null, null, 7]);
    expect(rsListRows(index, 2024)[1]!.initial).toBe(0);
  });
});

describe('filterRsRows', () => {
  const rows = rsListRows(index, 2025);
  it('filters by 府省庁, 局・庁, 事業名 and by whether the 事業 is linked', () => {
    expect(filterRsRows(rows, { ...INITIAL_RS_FILTERS, ministries: ['総務省'] }, NONE).map(r => r.id)).toEqual(['2']);
    expect(filterRsRows(rows, { ...INITIAL_RS_FILTERS, bureau: '大臣' }, NONE).map(r => r.id)).toEqual(['2']);
    expect(filterRsRows(rows, { ...INITIAL_RS_FILTERS, name: '^研', nameRegex: true }, NONE).map(r => r.id)).toEqual(['1']);
    expect(filterRsRows(rows, { ...INITIAL_RS_FILTERS, link: 'linked' }, NONE).map(r => r.id)).toEqual(['1']);
    expect(filterRsRows(rows, { ...INITIAL_RS_FILTERS, link: 'unlinked' }, NONE).map(r => r.id)).toEqual(['2']);
  });

  it('returns nothing when no 府省庁 is selected', () => {
    expect(filterRsRows(rows, { ...INITIAL_RS_FILTERS, ministries: [NONE] }, NONE)).toEqual([]);
  });
});

describe('sortRsRows', () => {
  const rows = rsListRows(index, 2025);
  it('puts the 事業 without a value last, whatever the direction', () => {
    expect(sortRsRows(rows, 'spent', 1).map(r => r.id)).toEqual(['1', '2']);
    expect(sortRsRows(rows, 'spent', -1).map(r => r.id)).toEqual(['1', '2']);
    expect(sortRsRows(rows, 'initial', -1).map(r => r.id)).toEqual(['1', '2']);
  });

  it('breaks ties by the number of the 事業 ID, not by the text', () => {
    const tie = rsListRows(rsIndex({ years: [2025], kous: [], jigyo: [['10', 'b', '総務省', '局', ''], ['2', 'a', '総務省', '局', '']], amounts: [[0, 2025, 1, null, null, null, null, null, null, null], [1, 2025, 1, null, null, null, null, null, null, null]], links: [] }), 2025);
    expect(sortRsRows(tie, 'initial', 1).map(r => r.id)).toEqual(['2', '10']); // 文字の順なら '10' が先
    expect(sortRsRows(tie, 'ministry', -1).map(r => r.id)).toEqual(['2', '10']);
  });
});

describe('spentUnfilled (執行額が全事業で 0 の年度)', () => {
  const mk = (rows: [number, number, number | null][]): RsJigyoData => ({ years: [2024, 2025], kous: [], jigyo: [['1', 'a', 'x', 'y', ''], ['2', 'b', 'x', 'y', '']], amounts: rows.map(([i, y, spent]) => [i, y, 10, null, null, null, 10, spent, null, null]), links: [] });

  it('finds the 年度 whose 執行額 is 0 in every 事業 that has a value, and shows it as no value', () => {
    const idx = rsIndex(mk([[0, 2024, 5], [1, 2024, 0], [0, 2025, 0], [1, 2025, 0]]));
    expect([...idx.spentUnfilled]).toEqual([2025]);
    expect(rsListRows(idx, 2025).map(r => r.spent)).toEqual([null, null]);
    expect(rsListRows(idx, 2024).map(r => r.spent)).toEqual([5, 0]); // ほかの年度の 0 は値のまま
    expect(rsAmountShown(idx, idx.data.amounts[2]!, 'spent')).toBeNull();
    expect(rsAmountShown(idx, idx.data.amounts[2]!, 'initial')).toBe(10); // ほかの列は、そのまま
  });

  it('does not treat a 年度 without any value as unfilled', () => {
    expect(rsIndex(mk([[0, 2025, null], [1, 2025, null]])).spentUnfilled.size).toBe(0);
  });
});
