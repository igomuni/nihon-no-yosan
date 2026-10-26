import { describe, expect, it } from 'vitest';
import { buildJikouLinks, jikouRunLengths, linkSuppOnly, type JikouLink, type JikouNode } from './jikou-links.ts';

const node = (year: number, o: Partial<JikouNode> & { name: string }): JikouNode => ({
  year, account: 'general', ministry: '内閣府', specialAccount: '', subAccount: '', org: '本府', itemCode: '001', itemName: '共通費', budget: 100, prev: 90, ...o,
});
const years = [2020, 2021, 2022];

describe('buildJikouLinks', () => {
  it('links the same key as RESOLVED and records the amount check without changing the status', () => {
    const nodes = [node(2020, { name: 'A', budget: 100, revised: 120 }), node(2021, { name: 'A', prev: 120 }), node(2022, { name: 'A', prev: 7 })];
    const links = buildJikouLinks(nodes, years);
    expect(links).toEqual([
      { from: 0, to: 1, evidence: ['same_key', 'prev_amount_eq_revised'], amount: 'eq_revised', status: 'RESOLVED' },
      { from: 1, to: 2, evidence: ['same_key'], amount: 'ne', status: 'RESOLVED' },
    ]);
  });

  it('does not use the 所管 of a special account in the key (the notation in the contents changes by year)', () => {
    const sp = (year: number, ministry: string): JikouNode => ({ ...node(year, { name: 'A' }), account: 'special', ministry, specialAccount: '復興', subAccount: '', org: '' });
    const links = buildJikouLinks([sp(2020, '内閣府及び厚生労働省'), sp(2021, '内閣府、厚生労働省及びデジタル庁')], [2020, 2021]);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ from: 0, to: 1, status: 'RESOLVED', evidence: expect.arrayContaining(['same_key']) });
  });

  it('resolves a move to another 項 only with the name and the previous-year amount, and leaves a name-only pair AMBIGUOUS', () => {
    const nodes = [
      node(2020, { name: '移った事項', itemCode: '001', itemName: '甲', budget: 500, revised: 520 }),
      node(2021, { name: '移った事項', itemCode: '002', itemName: '乙', prev: 520 }),
      node(2020, { name: '名前だけ', itemCode: '001', itemName: '甲', budget: 10 }),
      node(2021, { name: '名前だけ', itemCode: '002', itemName: '乙', prev: 99 }),
    ];
    const links = buildJikouLinks(nodes, [2020, 2021]);
    expect(links.find(l => l.from === 0)).toMatchObject({ to: 1, evidence: ['same_name_other_item', 'prev_amount_eq_revised'], status: 'RESOLVED' });
    expect(links.find(l => l.from === 2)).toMatchObject({ to: 3, evidence: ['same_name_other_item'], status: 'AMBIGUOUS' });
  });

  it('treats a rename inside a 項 as a candidate only when it is the only leftover on both sides', () => {
    const only = [node(2020, { name: '旧名', budget: 50, revised: 55 }), node(2021, { name: '新名', prev: 55 })];
    expect(buildJikouLinks(only, [2020, 2021])).toEqual([{ from: 0, to: 1, evidence: ['same_item_other_name', 'prev_amount_eq_revised'], amount: 'eq_revised', status: 'RESOLVED' }]);
    const two = [...only, node(2020, { name: '旧名2', budget: 1 }), node(2021, { name: '新名2', prev: 1 })];
    const links = buildJikouLinks(two, [2020, 2021]);
    expect(links.every(l => !l.evidence.includes('same_item_other_name'))).toBe(true);
  });

  it('makes a row with no counterpart UNRESOLVED on the side that has no partner, and never links across accounts', () => {
    const sp = { ...node(2021, { name: '会計をまたぐ' }), account: 'special' as const, ministry: '', specialAccount: '特', subAccount: '', org: '' };
    const links = buildJikouLinks([node(2020, { name: '会計をまたぐ' }), sp], [2020, 2021]);
    expect(links).toEqual([
      { from: 0, to: -1, evidence: [], amount: 'n/a', status: 'UNRESOLVED' },
      { from: -1, to: 1, evidence: [], amount: 'n/a', status: 'UNRESOLVED' },
    ]);
  });
});

describe('jikouRunLengths', () => {
  it('counts the years back through resolved links with exactly one counterpart, including the year itself', () => {
    const nodes = [node(2020, { name: 'A' }), node(2021, { name: 'A' }), node(2022, { name: 'A' }), node(2022, { name: 'B' })];
    const links = buildJikouLinks(nodes, years);
    expect(jikouRunLengths(nodes, links)).toEqual([1, 2, 3, 1]);
  });
});

describe('linkSuppOnly', () => {
  const node = (year: number, name: string, extra: Partial<JikouNode> = {}): JikouNode => ({ year, account: 'general', ministry: 'm', specialAccount: '', subAccount: '', org: 'o', itemCode: '001', itemName: '項', name, budget: 100, prev: null, ...extra });
  it('joins a 事項 that exists only in the supplementary budget to the same-key 事項 of the next year', () => {
    const nodes = [node(2020, 'a'), node(2021, 'b')];
    const suppOnly = [node(2020, 'b', { budget: null, revised: 500, suppNet: 500 })];
    const r = linkSuppOnly(nodes, suppOnly, []);
    expect(r).toEqual([{ from: 2, to: 1, evidence: ['same_key'], amount: 'n/a', status: 'RESOLVED' }]);
  });
  it('joins from the same-key 事項 of the previous year, and records the amount check', () => {
    const nodes = [node(2019, 'b', { revised: 120 }), node(2020, 'z', { prev: 120 })];
    const suppOnly = [node(2020, 'b', { budget: null, prev: 120, revised: 300, suppNet: 300 })];
    const r = linkSuppOnly(nodes, suppOnly, []);
    expect(r).toEqual([{ from: 0, to: 2, evidence: ['same_key', 'prev_amount_eq_revised'], amount: 'eq_revised', status: 'RESOLVED' }]);
  });
  it('does not add to a 事項 that already has a resolved link in that direction', () => {
    const nodes = [node(2020, 'a'), node(2021, 'b')];
    const suppOnly = [node(2020, 'b', { budget: null, revised: 500, suppNet: 500 })];
    const taken: JikouLink[] = [{ from: 0, to: 1, evidence: ['same_name_other_item', 'prev_amount_eq_budget'], amount: 'eq_budget', status: 'RESOLVED' }];
    expect(linkSuppOnly(nodes, suppOnly, taken)).toEqual([]);
  });
});
