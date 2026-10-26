import { describe, expect, it } from 'vitest';
import { classifySuppRequest, suppRequestPairs } from './supp-request-pairs.ts';

const kou = (id: string, year: number, code: string): Record<string, string> => ({ kou_id: id, year: String(year), account: 'general', ministry: 'm', org: 'o', special_account: '', sub_account: '', code, name: `項${code}`, seen_in: '' });
const ev = (id: string, event: string, measure: string, yen: number): Record<string, string> => ({ kou_id: id, event, measure, value_yen: String(yen) });
const link = (from: string, to: string, status = 'RESOLVED'): Record<string, string> => ({ from_kou_id: from, to_kou_id: to, evidence: 'same_key', amount: '', status });

describe('classifySuppRequest', () => {
  const base = { suppAdd: 100, request: 100, requestPrev: 1000, budget: 1000, revised: 1100 };
  it('puts a request near the previous-year budget first', () => {
    expect(classifySuppRequest({ ...base, request: 1030 })).toBe('要求が前年度予算に近い');
  });
  it('recognises a zero initial budget and a supplementary amount near the initial budget', () => {
    expect(classifySuppRequest({ suppAdd: 50, request: 50, requestPrev: 0, budget: 0, revised: 50 })).toBe('当初予算0で補正と要求が一致');
    expect(classifySuppRequest({ ...base, suppAdd: 980, request: 500, requestPrev: 700 })).toBe('補正追加額が当初予算に近い');
  });
  it('splits requests near the revised budget by whether the supplement is the main source', () => {
    expect(classifySuppRequest({ suppAdd: 400, request: 504, requestPrev: 150, budget: 100, revised: 500 })).toBe('補正が主財源で、要求は補正後予算と同水準');
    expect(classifySuppRequest({ suppAdd: 150, request: 1155, requestPrev: 1500, budget: 1000, revised: 1150 })).toBe('要求が補正後予算と同水準');
    expect(classifySuppRequest({ suppAdd: 50, request: 52, requestPrev: 5, budget: null, revised: 52 })).toBe('補正が主財源で、要求は補正後予算と同水準');
  });
  it('separates a request equal to the supplement above the initial budget from a mere coincidence', () => {
    expect(classifySuppRequest({ suppAdd: 200, request: 201, requestPrev: 50, budget: 50, revised: 250 })).toBe('要求が補正追加額と同額で、当初予算を上回る');
    expect(classifySuppRequest({ suppAdd: 300, request: 301, requestPrev: 900, budget: 800, revised: 1100 })).toBe('補正追加額に近いが、補正後予算とも当初予算とも離れる');
  });
});

describe('suppRequestPairs', () => {
  const kous = [kou('a', 2023, '001'), kou('b', 2024, '001'), kou('c', 2023, '002'), kou('d', 2024, '002'), kou('e', 2023, '003'), kou('f', 2024, '003')];
  const events = [
    ev('a', 'supp', 'supp_add', 100), ev('a', 'budget', 'budget_amount', 0), ev('a', 'supp', 'revised_amount', 100),
    ev('b', 'request', 'request_amount', 100), ev('b', 'request', 'request_prev', 0),
    // c: 補正と要求の差が 5% を超える
    ev('c', 'supp', 'supp_add', 100), ev('d', 'request', 'request_amount', 120), ev('d', 'request', 'request_prev', 120),
    // e: 対応が AMBIGUOUS
    ev('e', 'supp', 'supp_add', 100), ev('f', 'request', 'request_amount', 100), ev('f', 'request', 'request_prev', 0),
  ];
  const links = [link('a', 'b'), link('c', 'd'), link('e', 'f', 'AMBIGUOUS')];
  it('lists only the RESOLVED pairs whose supplementary amount is within 5% of the next request', () => {
    const r = suppRequestPairs(kous, events, links);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ year: 2023, nextKouId: 'b', match: '要求増額+要求額', exact: true, diffPct: 0, budgetZero: true, class: '当初予算0で補正と要求が一致' });
  });
  it('skips a 項 with two next candidates', () => {
    expect(suppRequestPairs(kous, events, [link('a', 'b'), link('a', 'd')])).toHaveLength(0);
  });
});
