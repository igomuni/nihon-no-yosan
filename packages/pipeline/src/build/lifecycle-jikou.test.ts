import { describe, expect, it } from 'vitest';
import type { JikouLink, JikouNode, LifecycleKou } from '@nihon-no-yosan/core';
import { buildLifecycleJikou } from './lifecycle-jikou.ts';

const kou = (year: number, code: string, name: string, extra: Partial<LifecycleKou> = {}): LifecycleKou => ({ id: `${year}:general:${code}`, year, account: 'general', ministry: '財務省', org: '財務本省', specialAccount: '', subAccount: '', code, name, seenIn: ['budget'], ...extra });
const node = (year: number, itemCode: string, itemName: string, name: string, budget: number | null, extra: Partial<JikouNode> = {}): JikouNode => ({ year, account: 'general', ministry: '財務省', specialAccount: '', subAccount: '', org: '財務本省', itemCode, itemName, name, budget, prev: null, ...extra });

describe('buildLifecycleJikou', () => {
  const kous = [kou(2023, '001', '項Ａ'), kou(2024, '001', '項Ａ'), kou(2024, '', '概算要求のみ', { requestOnly: 'reqOnly' })];
  it('puts each 事項 under its 項 (names compared after width folding), keeping only the 項 that have 事項', () => {
    const nodes = [node(2023, '001', '項A', '事項 X', 100, { revised: 110, suppNet: 10 }), node(2024, '001', '項A', '事項 X', 120)];
    const links: JikouLink[] = [{ from: 0, to: 1, evidence: ['same_key'], amount: 'eq_budget', status: 'RESOLVED' }];
    const { data, unmatched } = buildLifecycleJikou({ years: [2023, 2024], nodes, links }, kous);
    expect(unmatched).toEqual({});
    expect(data.kous).toEqual(['2023:general:001', '2024:general:001']);
    expect(data.nodes).toEqual([[0, 2023, '事項 X', 100, null, 110, 10], [1, 2024, '事項 X', 120, null, null, null]]);
    expect(data.links).toEqual([[0, 1, 1, 1]]);
  });
  it('counts a 事項 whose 項 is not found, and drops the links that touch it; keeps only RESOLVED links', () => {
    const nodes = [node(2023, '001', '項Ａ', '事項 X', 100), node(2024, '999', '無い項', '事項 X', 120), node(2024, '001', '項Ａ', '事項 Y', 5)];
    const links: JikouLink[] = [
      { from: 0, to: 1, evidence: ['same_key'], amount: 'n/a', status: 'RESOLVED' },
      { from: 0, to: 2, evidence: ['same_name_other_org'], amount: 'n/a', status: 'AMBIGUOUS' },
    ];
    const { data, unmatched } = buildLifecycleJikou({ years: [2023, 2024], nodes, links }, kous);
    expect(unmatched).toEqual({ 2024: 1 });
    expect(data.nodes).toHaveLength(2);
    expect(data.links).toEqual([]);
  });
  it('stops when two 項 have the same key after folding', () => {
    expect(() => buildLifecycleJikou({ years: [2023], nodes: [], links: [] }, [kou(2023, '001', '項Ａ'), { ...kou(2023, '001', '項A'), id: 'dup' }])).toThrow('項の鍵が重なる');
  });
});
