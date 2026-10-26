import { describe, expect, it } from 'vitest';
import type { LifecycleKou } from './lifecycle.ts';
import { buildLifecycleLinks } from './lifecycle-links.ts';
import { lifecycleLinkState, lifecycleLinksByKou } from './lifecycle-list.ts';
import type { LifecycleValues } from './lifecycle-view.ts';

const kou = (year: number, code: string, name: string, o: Partial<LifecycleKou> = {}): LifecycleKou => {
  const k = { id: '', year, account: 'general' as const, ministry: '内閣府', org: '本府', specialAccount: '', subAccount: '', code, name, seenIn: ['budget' as const], ...o };
  return { ...k, id: `${year}:${k.account}:${k.account === 'general' ? `${k.ministry}|${k.org}` : `${k.specialAccount}|${k.subAccount}`}|${code}|${name}` };
};
const run = (ks: LifecycleKou[], vs: LifecycleValues[]) => buildLifecycleLinks(ks, vs, [2023, 2024]).map(l => ({ f: l.from < 0 ? null : ks[l.from]!.id.split('|').slice(-2).join('/'), t: l.to < 0 ? null : ks[l.to]!.id.split('|').slice(-2).join('/'), e: l.evidence.join(';'), a: l.amount, s: l.status }));

describe('buildLifecycleLinks', () => {
  it('links the same key as RESOLVED and records the amount check separately (a mismatch does not change the status)', () => {
    const ks = [kou(2023, '001', 'A'), kou(2024, '001', 'A'), kou(2023, '002', 'B'), kou(2024, '002', 'B'), kou(2023, '003', 'C'), kou(2024, '003', 'C')];
    const vs: LifecycleValues[] = [{ revised_amount: 100, budget_amount: 90 }, { budget_prev: 100 }, { budget_amount: 50 }, { budget_prev: 50 }, { revised_amount: 7 }, { budget_prev: 8 }];
    expect(run(ks, vs)).toEqual([
      { f: '001/A', t: '001/A', e: 'same_key;prev_amount_eq_revised', a: 'eq_revised', s: 'RESOLVED' },
      { f: '002/B', t: '002/B', e: 'same_key;prev_amount_eq_budget', a: 'eq_budget', s: 'RESOLVED' },
      { f: '003/C', t: '003/C', e: 'same_key', a: 'ne', s: 'RESOLVED' },
    ]);
  });
  it('does not treat a previous-year amount of 0 as evidence', () => {
    const ks = [kou(2023, '001', 'A', { ministry: '甲' }), kou(2024, '009', 'X')];
    const vs: LifecycleValues[] = [{ revised_amount: 0 }, { budget_prev: 0 }];
    expect(run(ks, vs).map(l => l.s)).toEqual(['UNRESOLVED', 'UNRESOLVED']);
  });
  it('resolves a 項 that moved to another ministry only when the name and the amount both match and the pair is the only candidate', () => {
    const ks = [kou(2023, '035', '水道', { ministry: '厚労', org: '本省' }), kou(2024, '378', '水道', { ministry: '国交', org: '本省' })];
    expect(run(ks, [{ revised_amount: 6887 }, { budget_prev: 6887 }])).toEqual([{ f: '035/水道', t: '378/水道', e: 'same_name_other_org;prev_amount_eq_revised', a: 'eq_revised', s: 'RESOLVED' }]);
    // 名前だけ → AMBIGUOUS（額の根拠が無い）
    expect(run(ks, [{ revised_amount: 1 }, { budget_prev: 2 }]).map(l => [l.e, l.s])).toEqual([['same_name_other_org', 'AMBIGUOUS']]);
  });
  it('a code change under the same ministry and organization is its own evidence', () => {
    const ks = [kou(2023, '141', 'サイバー'), kou(2024, '139', 'サイバー')];
    expect(run(ks, [{ revised_amount: 5 }, { budget_prev: 5 }])[0]).toMatchObject({ e: 'same_name_other_code;prev_amount_eq_revised', s: 'RESOLVED' });
  });
  it('a name in the same organization is enough when the code changes and the pair is the only candidate, even without an amount to compare', () => {
    const ks = [kou(2023, '141', 'サイバー'), kou(2024, '139', 'サイバー')];
    expect(run(ks, [{}, {}]).map(l => [l.e, l.a, l.s])).toEqual([['same_name_other_code', 'n/a', 'RESOLVED']]);
    expect(run(ks, [{ revised_amount: 5 }, { budget_prev: 0 }]).map(l => [l.e, l.a, l.s])).toEqual([['same_name_other_code', 'zero', 'RESOLVED']]);
  });
  it('a name in another organization of the same ministry resolves only when the amounts can be compared; another ministry does not', () => {
    const ks = [kou(2023, '072', '入管業務', { ministry: '法務省', org: '地方官署' }), kou(2024, '103', '入管業務', { ministry: '法務省', org: '入管庁' })];
    expect(run(ks, [{ revised_amount: 20274 }, { budget_prev: 20309 }]).map(l => [l.e, l.a, l.s])).toEqual([['same_name_other_org', 'ne', 'RESOLVED']]);
    expect(run(ks, [{}, {}]).map(l => [l.a, l.s])).toEqual([['n/a', 'AMBIGUOUS']]);
    const moved = [kou(2023, '034', '水道', { ministry: '厚労', org: '本省' }), kou(2024, '378', '水道', { ministry: '国交', org: '本省' })];
    expect(run(moved, [{ revised_amount: 75 }, { budget_prev: 42 }]).map(l => [l.a, l.s])).toEqual([['ne', 'AMBIGUOUS']]);
  });
  it('the same code under the same ministry with a different name resolves only together with an amount match', () => {
    const ks = [kou(2023, '164', '国営公園事業工事諸費', { org: '整備局' }), kou(2024, '164', '国営公園等事業工事諸費', { org: '整備局' })];
    expect(run(ks, [{ budget_amount: 1766, revised_amount: 1706 }, { budget_prev: 1766 }])).toEqual([{ f: '164/国営公園事業工事諸費', t: '164/国営公園等事業工事諸費', e: 'prev_amount_eq_budget;same_code_other_name', a: 'eq_budget', s: 'RESOLVED' }]);
    // 額が違えば、候補にならない（項コードの使い回しかもしれない）
    expect(run(ks, [{ budget_amount: 1766, revised_amount: 1706 }, { budget_prev: 5 }]).map(l => l.s)).toEqual(['UNRESOLVED', 'UNRESOLVED']);
    // 項コードが違う名前の違う組は、額が合うだけでは AMBIGUOUS のまま
    const other = [kou(2023, '010', '航路標識整備事業費'), kou(2024, '255', '船舶交通安全基盤整備事業費')];
    expect(run(other, [{ budget_amount: 8197 }, { budget_prev: 8197 }]).map(l => [l.e, l.s])).toEqual([['prev_amount_eq_budget', 'AMBIGUOUS']]);
  });
  it('a similar name under the same ministry resolves together with an amount match; a far name does not', () => {
    const near = [kou(2023, '018', '農業生産基盤整備事業調査諸費'), kou(2024, '039', '農業農村整備事業調査諸費')];
    expect(run(near, [{ budget_amount: 1138 }, { budget_prev: 1138 }]).map(l => [l.e, l.s])).toEqual([['prev_amount_eq_budget;similar_name', 'RESOLVED']]);
    const far = [kou(2023, '030', '農村整備推進対策費'), kou(2024, '033', '多面的機能発揮促進対策費')];
    expect(run(far, [{ budget_amount: 81544 }, { budget_prev: 81544 }]).map(l => [l.e, l.s])).toEqual([['prev_amount_eq_budget', 'AMBIGUOUS']]);
    // 所管が違えば、名前が近くても根拠にしない
    const otherMinistry = [kou(2023, '018', '農業生産基盤整備事業調査諸費'), kou(2024, '039', '農業農村整備事業調査諸費', { ministry: '農水' })];
    expect(run(otherMinistry, [{ budget_amount: 1138 }, { budget_prev: 1138 }]).map(l => [l.e, l.s])).toEqual([['prev_amount_eq_budget', 'AMBIGUOUS']]);
  });
  it('is AMBIGUOUS when the previous 項 has several candidates', () => {
    const ks = [kou(2023, '001', '費', { org: '甲' }), kou(2024, '001', '費', { org: '乙' }), kou(2024, '002', '費', { org: '丙' })];
    expect(run(ks, [{ revised_amount: 9 }, { budget_prev: 9 }, { budget_prev: 9 }]).map(l => l.s)).toEqual(['AMBIGUOUS', 'AMBIGUOUS']);
  });
  it('a name-only pair is a candidate only when both 項 have no same-key partner, but a pair with an amount match is also a candidate when one side has a partner', () => {
    // 前の年度の 'A' は同じ鍵の相手（2024 の 'A'）がある。2024 の別の組織の 'A' は相手が無い
    const ks = [kou(2023, '001', 'A', { org: '甲' }), kou(2024, '001', 'A', { org: '甲' }), kou(2024, '001', 'A', { org: '乙' })];
    expect(run(ks, [{ revised_amount: 9 }, { budget_prev: 1 }, { budget_prev: 2 }]).map(l => [l.e, l.s])).toEqual([['same_key', 'RESOLVED'], ['', 'UNRESOLVED']]);
    expect(run(ks, [{ revised_amount: 9 }, { budget_prev: 1 }, { budget_prev: 9 }]).map(l => [l.e, l.s])).toEqual([['same_key', 'RESOLVED'], ['same_name_other_org;prev_amount_eq_revised', 'RESOLVED']]);
  });
  it('a 項 with no candidate is UNRESOLVED on its own row, and links never cross the account', () => {
    const ks = [kou(2023, '001', '費', { account: 'special', specialAccount: '年金', subAccount: '' }), kou(2024, '001', '費', { org: '甲' })];
    expect(run(ks, [{ revised_amount: 9 }, { budget_prev: 9 }]).map(l => [l.f !== null, l.t !== null, l.s])).toEqual([[false, true, 'UNRESOLVED'], [true, false, 'UNRESOLVED']]); // 一般会計の次の年度の項、特別会計の前の年度の項の順
  });
});

describe('lifecycleLinkState', () => {
  it('is RESOLVED when any link is resolved, otherwise AMBIGUOUS if a candidate exists, otherwise UNRESOLVED', () => {
    const l = (status: 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED') => ({ from: 0, to: 1, evidence: [], amount: 'n/a' as const, status });
    expect(lifecycleLinkState([l('AMBIGUOUS'), l('RESOLVED')])).toBe('RESOLVED');
    expect(lifecycleLinkState([l('UNRESOLVED'), l('AMBIGUOUS')])).toBe('AMBIGUOUS');
    expect(lifecycleLinkState([l('UNRESOLVED')])).toBe('UNRESOLVED');
    expect(lifecycleLinkState(undefined)).toBeNull();
    expect([...lifecycleLinksByKou([{ from: 0, to: -1, evidence: [], amount: 'n/a', status: 'UNRESOLVED' }]).keys()]).toEqual([0]);
  });
});
