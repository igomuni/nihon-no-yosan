import { describe, expect, it } from 'vitest';
import { pairSameYear, type SameYearItem } from './lifecycle-same-year.ts';

const item = (id: string, name: string, prev: number | null, unit = '厚生労働省|職業安定局'): SameYearItem => ({ id, unit, name, prev });

describe('pairSameYear', () => {
  it('結ぶ: 同じ所属・前年度予算額が同じ・名前が近い', () => {
    const m = pairSameYear([item('r1', '育児休業等給付費', 785_000)], [item('b1', '育児休業給付費', 785_000)]);
    expect([...m]).toEqual([['r1', 'b1']]);
  });
  it('前年度予算額が違う・0・無いときは結ばない', () => {
    expect(pairSameYear([item('r', '育児休業等給付費', 100)], [item('b', '育児休業給付費', 101)]).size).toBe(0);
    expect(pairSameYear([item('r', '育児休業等給付費', 0)], [item('b', '育児休業給付費', 0)]).size).toBe(0);
    expect(pairSameYear([item('r', '育児休業等給付費', null)], [item('b', '育児休業給付費', null)]).size).toBe(0);
  });
  it('所属が違う、名前が遠いときは結ばない', () => {
    expect(pairSameYear([item('r', '育児休業等給付費', 100)], [item('b', '育児休業給付費', 100, '農林水産省|本省')]).size).toBe(0);
    expect(pairSameYear([item('r', '育児休業等給付費', 100)], [item('b', '船舶建造費', 100)]).size).toBe(0);
  });
  it('1 対 1 に決まらないときは結ばない', () => {
    const two = pairSameYear([item('r', '育児休業等給付費', 100)], [item('b1', '育児休業給付費', 100), item('b2', '育児休業等給付金', 100)]);
    expect(two.size).toBe(0);
  });
});
