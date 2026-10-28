import { describe, expect, it } from 'vitest';
import { jikouEvidenceOf, type JikouLink, type JikouNode, type LifecycleKou, type LifecycleLink } from '@nihon-no-yosan/core';
import { buildLifecycleJikou } from './lifecycle-jikou.ts';

const kou = (year: number, code: string, name: string, extra: Partial<LifecycleKou> = {}): LifecycleKou => ({ id: `${year}:general:${code}`, year, account: 'general', ministry: '財務省', org: '財務本省', specialAccount: '', subAccount: '', code, name, seenIn: ['budget'], ...extra });
const node = (year: number, itemCode: string, itemName: string, name: string, budget: number | null, extra: Partial<JikouNode> = {}): JikouNode => ({ year, account: 'general', ministry: '財務省', specialAccount: '', subAccount: '', org: '財務本省', itemCode, itemName, name, major: '95', budget, prev: null, ...extra });

describe('buildLifecycleJikou: 概算要求の事項', () => {
  const kousR = [kou(2024, '001', '項Ａ'), kou(2025, '001', '項Ａ'), kou(2024, '002', '項Ｂ'), kou(2025, '', '概算のみの項', { requestOnly: 'reqOnly', id: '2025:general:request|財務省||財務本省|概算のみの項' }), kou(2026, '', '概算のみの項', { requestOnly: 'reqOnly', id: '2026:general:request|財務省||財務本省|概算のみの項' }), kou(2026, '', '項Ａ', { requestOnly: 'noBudget', id: '2026:general:request|財務省||財務本省|項Ａ' })];
  const budget = [node(2024, '001', '項A', '事項 X', 100), node(2024, '001', '項A', '事項 Y', 50), node(2025, '001', '項A', '事項 X', 120), node(2024, '002', '項B', '事項 Z', 7)];
  const links: JikouLink[] = [{ from: 0, to: 2, evidence: ['same_key'], amount: 'n/a', status: 'RESOLVED' }];
  const request = {
    matched: new Map([
      ['2024:general:001', { j: [['事項 X', '', 90, 100], ['事項 Y', '', null, 50], ['事項 N', '', 30, null]] as [string, string, number | null, number | null][], noReq: false }],
      ['2024:general:002', { j: [['事項 Z', '', null, 7]] as [string, string, number | null, number | null][], noReq: true }],
    ]),
    requestOnly: new Map([
      ['2025:general:request|財務省||財務本省|概算のみの項', [{ name: '新規の事項', req: 500 }, { name: '額の読めない事項', req: null }]],
      ['2026:general:request|財務省||財務本省|概算のみの項', [{ name: '新規の事項', req: 520 }]],
      ['2026:general:request|財務省||財務本省|項Ａ', [{ name: '事項 X', req: 125 }]],
    ]),
  };
  // 項の対応: 概算のみの項（FY2025 → FY2026）、項Ａ（FY2025 の予算書の項 → FY2026 の概算要求のみの項）
  const links3 = [{ from: 3, to: 4, evidence: [], amount: 'n/a', status: 'RESOLVED' }, { from: 1, to: 5, evidence: [], amount: 'n/a', status: 'RESOLVED' }] as unknown as LifecycleLink[];
  it('puts the requested amount on the paired 事項, makes the one-sided ones separate nodes, and remembers which 項 had their request read', () => {
    const { data, unplaced } = buildLifecycleJikou({ years: [2024, 2025], nodes: budget, links }, kousR, links3, request);
    expect(unplaced).toBe(0);
    const byName = (name: string, year: number) => data.nodes.find(n => n[2] === name && n[1] === year)!;
    expect(byName('事項 X', 2024)[7]).toBe(90);
    expect(byName('事項 Y', 2024)[7]).toBeNull(); // 予算のみ
    expect(byName('事項 N', 2024)).toMatchObject({ 3: null, 5: null, 7: 30 }); // 要求のみ
    expect(byName('事項 Z', 2024)[7]).toBeNull(); // 要求側の内訳が取れていない項
    expect(data.requestRead.map(i => data.kous[i]).sort()).toEqual(['2024:general:001', '2025:general:request|財務省||財務本省|概算のみの項', '2026:general:request|財務省||財務本省|概算のみの項', '2026:general:request|財務省||財務本省|項Ａ']);
    expect(data.nodes.find(n => n[2] === '額の読めない事項')).toBeUndefined();
  });
  it('keeps the 主要経費別 code of the 予算書, and takes the one of a 概算要求にだけある事項 from the second half of the 事項コード (blank when it cannot be read)', () => {
    const withCode = {
      matched: new Map([['2024:general:001', { j: [['事項 X', '', 90, 100], ['事項 N', '01\u201135', 30, null], ['事項 M', 'xx', 5, null]] as [string, string, number | null, number | null][], noReq: false }]]),
      requestOnly: new Map([['2025:general:request|財務省||財務本省|概算のみの項', [{ name: '新規の事項', code: '02-95', req: 500 }, { name: 'コードの無い事項', req: 7 }]]]),
    };
    const { data } = buildLifecycleJikou({ years: [2024, 2025], nodes: budget, links }, kousR, links3, withCode);
    const major = (name: string, year: number): string | undefined => data.nodes.find(n => n[2] === name && n[1] === year)?.[8];
    expect(major('事項 X', 2024)).toBe('95'); // 予算書の事項は、予算書のコード
    expect(major('事項 N', 2024)).toBe('35');
    expect(major('事項 M', 2024)).toBe('');
    expect(major('新規の事項', 2025)).toBe('95');
    expect(major('コードの無い事項', 2025)).toBe('');
  });
  it('joins a 概算要求にだけある事項 to the same-name 事項 of the 項 linked in the next year (the key of a 項 without 項コード never matches)', () => {
    const { data } = buildLifecycleJikou({ years: [2024, 2025], nodes: budget, links }, kousR, links3, request);
    const a = data.nodes.findIndex(n => n[2] === '事項 X' && n[1] === 2025), b = data.nodes.findIndex(n => n[2] === '事項 X' && n[1] === 2026);
    expect(data.links.some(l => l[0] === a && l[1] === b && jikouEvidenceOf(l[2]).join() === 'same_name_linked_kou')).toBe(true);
    // 概算のみの項どうし（項コードが同じ空）は、同じ鍵で結ばれる
    const c = data.nodes.findIndex(n => n[2] === '新規の事項' && n[1] === 2025), d = data.nodes.findIndex(n => n[2] === '新規の事項' && n[1] === 2026);
    expect(data.links.some(l => l[0] === c && l[1] === d && jikouEvidenceOf(l[2]).join() === 'same_key')).toBe(true);
  });
  it('joins a requested-only 事項 of a matched 項 to the same-key 事項 of the next year', () => {
    const next = [...budget, node(2025, '001', '項A', '事項 N', 35)];
    const { data } = buildLifecycleJikou({ years: [2024, 2025], nodes: next, links }, kousR, [], request);
    const a = data.nodes.findIndex(n => n[2] === '事項 N' && n[1] === 2024), b = data.nodes.findIndex(n => n[2] === '事項 N' && n[1] === 2025);
    expect(data.links.some(l => l[0] === a && l[1] === b && jikouEvidenceOf(l[2]).join() === 'same_key')).toBe(true);
  });
  it('counts the paired amount whose budget-side 事項 cannot be found', () => {
    const lost = { ...request, matched: new Map([['2024:general:001', { j: [['無い事項', '', 10, 5]] as [string, string, number | null, number | null][], noReq: false }]]) };
    expect(buildLifecycleJikou({ years: [2024], nodes: budget, links: [] }, kousR, [], lost).unplaced).toBe(1);
  });
});

describe('buildLifecycleJikou', () => {
  const kous = [kou(2023, '001', '項Ａ'), kou(2024, '001', '項Ａ'), kou(2024, '', '概算要求のみ', { requestOnly: 'reqOnly' })];
  it('puts each 事項 under its 項 (names compared after width folding), keeping only the 項 that have 事項', () => {
    const nodes = [node(2023, '001', '項A', '事項 X', 100, { revised: 110, suppNet: 10 }), node(2024, '001', '項A', '事項 X', 120)];
    const links: JikouLink[] = [{ from: 0, to: 1, evidence: ['same_key'], amount: 'eq_budget', status: 'RESOLVED' }];
    const { data, unmatched } = buildLifecycleJikou({ years: [2023, 2024], nodes, links }, kous);
    expect(unmatched).toEqual({});
    expect(data.kous).toEqual(['2023:general:001', '2024:general:001']);
    expect(data.nodes).toEqual([[0, 2023, '事項 X', 100, null, 110, 10, null, '95'], [1, 2024, '事項 X', 120, null, null, null, null, '95']]);
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
