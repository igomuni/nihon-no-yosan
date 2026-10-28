import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MOKU_FLAG, type LifecycleKou } from '@nihon-no-yosan/core';
import type { LifecycleRequestOnlyRow, LifecycleSource } from './lifecycle.ts';
import { buildLifecycleMoku, requestOnlyMoku } from './lifecycle-moku.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-moku-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const write = (file: string, text: string): void => { const dir = path.join(tmp, 'mof-archive', '2024'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };

const G = '所管,組織,項コード,主要経費別分類コード,目的別分類コード,財政法公債金対象非対象別分類コード,経済性質別分類コード,使途別分類コード';
const S = '所管,特別会計,勘定,項コード,主要経費別分類コード,目的別分類コード,経済性質別分類コード,使途別分類コード';
const SETTLE = '歳出予算額(円),前年度繰越額(円),予備費使用額(円),流用等増△減額(円),予算決定後移替増△減額(円),歳出予算現額(円),支出済歳出額(円),翌年度繰越額(円),不用額(円),source_row';
const g = '内閣府,本府,010,95,016,2,12,9';
const s = '内閣府,復興,,601,95,199,81,5';
// 一般会計: 当初に 庁費・委託費・旅費。補正は 委託費（個別の行）、「庁費外1目」（集約行）、施設整備費（補正で出る目）。決算は 3 つの目と、決算にだけある目
write('moku-general.csv', `${G},目別分類コード,項名,目名,令和6年度要求額(千円),前年度予算額(千円),比較増△減額(千円),source_row
${g},06,共通費,庁費,100,100,0,1
${g},07,共通費,委託費,50,50,0,2
${g},08,共通費,旅費,30,30,0,3
`);
write('moku-general-hosei.csv', `${G},目別分類コード,項名,目名,令和6年度成立予算額(千円),補正要求追加額(千円),補正要求修正減少額(千円),補正要求差引額(千円),改令和6年度予算額(千円),source_row
${g},07,共通費,委託費,50,20,0,20,70,1
${g},06,共通費,庁費外1目,130,0,0,0,130,2
${g},15,共通費,施設整備費,0,300,0,300,300,3
`);
write('moku-general-kessan.csv', `${G},目番号,項名,目名,${SETTLE}
${g},02,共通費,庁費,100000,0,0,0,0,100000,90000,0,10000,1
${g},03,共通費,委託費,70000,0,0,0,0,70000,70000,0,0,2
${g},04,共通費,旅費,30000,0,0,0,0,30000,29500,0,500,3
${g},05,共通費,施設整備費,300000,40000,0,0,0,340000,0,300000,40000,4
${g},06,共通費,情報処理業務庁費,0,0,0,0,5000,5000,5000,0,0,5
`);
// 特別会計: 当初に 交付金。決算は、同じ識別の行が共管の組織ごとに 2 つ
write('moku-special.csv', `${S},目別分類コード,共管所管名,共管組織名,項名,目名,令和6年度予定額(千円),前年度予算額(千円),比較増△減額(千円),source_row
${s},16,復興庁,復興庁,復興費,交付金,500,500,0,1
`);
write('moku-special-hosei.csv', `${S},目別分類コード,共管所管名,共管組織名,項名,目名,令和6年度成立予算額(千円),補正予定追加額(千円),補正予定修正減少額(千円),補正予定差引額(千円),改令和6年度予定額(千円),source_row
`);
write('moku-special-kessan.csv', `${S},目番号,共管所管名,共管組織名,項名,目名,歳出予算額(円),前年度繰越額(円),予備費使用額(円),予算総則の規定による経費増額(円),流用等増△減額(円),予算決定後移替増△減額(円),歳出予算現額(円),支出済歳出額(円),翌年度繰越額(円),不用額(円),source_row
${s},16,A省,A局,復興費,交付金,250000,0,0,0,0,0,250000,240000,0,10000,1
${s},16,B省,B局,復興費,交付金,250000,0,0,0,0,0,250000,250000,0,0,2
`);

const SOURCES: LifecycleSource[] = [{ year: 2024, budget: '2024', supp: { general: '2024', special: '2024' }, settle: { general: '2024', special: '2024' } }];
const kou = (id: string): LifecycleKou => ({ id, year: 2024, account: id.includes(':special:') ? 'special' : 'general', ministry: '内閣府', org: '', specialAccount: '', subAccount: '', code: '', name: '', seenIn: ['budget'] });
const GK = '2024:general:内閣府|本府|010|共通費', SK = '2024:special:復興||601|復興費';
const request = new Map([[GK, { m: [['庁費', '', 110, 100], ['旅費', '', null, 30], ['委託費', '', 55, 50], ['調査費', '', 10, null]] as [string, string, number | null, number | null][], noReq: false }]]);

describe('buildLifecycleMoku', () => {
  const { data, stats } = buildLifecycleMoku({ datasetDir: tmp, sources: SOURCES, kous: [kou(GK), kou(SK)], request });
  const at = (name: string, part = '') => data.nodes.find(n => n[2] === name && n[4] === part)!;

  it('keeps the 補正 of a 目 with its own row, and leaves it empty for a 目 in a 外N目 row (no 目 for the aggregate row)', () => {
    expect(at('委託費').slice(5, 8)).toEqual([50, 70, 20]);
    expect(at('委託費')[13] & MOKU_FLAG.suppItem).toBeTruthy();
    expect(at('庁費').slice(5, 7)).toEqual([100, null]);
    expect(at('庁費')[13] & MOKU_FLAG.suppAggregated).toBeTruthy();
    expect(data.nodes.some(n => n[2].endsWith('外1目'))).toBe(false);
    expect(stats.suppAggregatedRows).toBe(1);
  });

  it('adds a 目 that appears only in the 補正 or only in the 決算, with the other stages empty, and converts the 決算 from 円 to 千円', () => {
    expect(at('施設整備費').slice(5, 9)).toEqual([null, 300, 300, 340]);
    expect(at('情報処理業務庁費').slice(5, 12)).toEqual([null, null, null, 5, 5, 0, 0]);
    expect(at('庁費').slice(8, 12)).toEqual([100, 90, 0, 10]);
    expect([stats.suppOnly, stats.settleOnly]).toEqual([1, 1]);
  });

  it('keeps the 前年度繰越額 of the 決算 (千円) at the end of a 目, and leaves it empty for a 目 without a 決算', () => {
    expect(at('施設整備費')[14]).toBe(40);
    expect(at('庁費')[14]).toBe(0);
    expect(at('庁費')[10]).toBe(0); // 翌年度繰越額
    expect(at('施設整備費')[10]).toBe(300);
    expect(data.nodes.every(n => n.length === 15)).toBe(true);
    expect(data.nodes.filter(n => n[1] === 2024 && n[14] === null).length).toBe(data.nodes.filter(n => n[8] === null).length);
  });

  it('splits 決算 rows of the same 目 by the 共管 and leaves the 決算 of the 当初 目 empty', () => {
    expect(at('交付金').slice(5, 9)).toEqual([500, null, null, null]);
    expect(at('交付金')[13] & MOKU_FLAG.settleSplit).toBeTruthy();
    expect(at('交付金', 'A省|A局').slice(8, 10)).toEqual([250, 240]);
    expect(at('交付金', 'B省|B局')[13] & MOKU_FLAG.settlePart).toBeTruthy();
    expect([stats.settleSplit, stats.settleParts]).toEqual([1, 2]);
  });

  it('puts the request on the 当初 目 of the same name, adds a request-only 目, and records how the request 目 were read', () => {
    expect(at('庁費')[12]).toBe(110);
    expect(at('旅費')[12]).toBeNull();
    expect(at('調査費').slice(5, 13)).toEqual([null, null, null, null, null, null, null, 10]);
    expect(at('調査費')[13] & MOKU_FLAG.requestOnly).toBeTruthy();
    expect(data.requestCoverage).toEqual([[data.kous.indexOf(GK), 'partial']]);
    expect([data.suppYears, data.settleYears, data.requestYears]).toEqual([[2024], [2024], [2024]]);
  });

  it('stops when a 目 belongs to a 項 that is not in the lifecycle table', () => {
    expect(() => buildLifecycleMoku({ datasetDir: tmp, sources: SOURCES, kous: [kou(GK)], request })).toThrow(/予算の一生の表に無い/);
  });
});

describe('request-only 項', () => {
  const RK = '2027:general:request|内閣府|||新設費';
  const rk: LifecycleKou = { ...kou(RK), year: 2027, requestOnly: 'noBudget', seenIn: ['request'] };
  const m: [string, string, number | null, number | null][] = [['職員基本給', '95|016|2|11|1', 400, null], ['庁費', '', 90, null], ['不明', '', null, null]];
  const { data, stats } = buildLifecycleMoku({ datasetDir: tmp, sources: SOURCES, kous: [kou(GK), kou(SK), rk], request: new Map([...request, [RK, { m, noReq: false }]]) });
  it('makes a 目 of each request 目 with an amount, all marked as in the request book only, in the year of the 項', () => {
    const ns = data.nodes.filter(n => data.kous[n[0]] === RK);
    expect(ns.map(n => [n[1], n[2], n[3], n[12], n[5], n[13]])).toEqual([[2027, '職員基本給', '95|016|2|11|1', 400, null, MOKU_FLAG.requestOnly], [2027, '庁費', '', 90, null, MOKU_FLAG.requestOnly]]);
    expect(stats.requestOnlyKou).toBe(2);
    expect(data.years).toContain(2027);
    expect(data.requestYears).toContain(2027);
  });
  it('stops for a request 項 that is not in the lifecycle table', () => {
    expect(() => buildLifecycleMoku({ datasetDir: tmp, sources: SOURCES, kous: [kou(GK), kou(SK)], request: new Map([[RK, { m, noReq: false }]]) })).toThrow('予算の一生の表に無い');
  });
});

describe('requestOnlyMoku', () => {
  const row = (o: Partial<LifecycleRequestOnlyRow>): LifecycleRequestOnlyRow => ({ y: 2027, kind: 'noBudget', acct: 0, grp: '', min: '内閣府', sub: '', org: '本府', name: '新設費', req: 100, reqPrev: null, multiBook: false, publishers: [], ...o });
  const H = '年度,会計区分,所管,特別会計,勘定,組織,項名,項コード,事項名,主要経費目的別コード,目別コード,目名,目コード(原文),前年度予算額_千円,要求額_千円,行数,細分の合計を使った行,額の空き,要求書,PDF頁';
  const line = (year: number, host: string, moku: string, amt: number, code = '95016-2111-02-0000') => `${year},一般,内閣府,,,本府,新設費,001,事項,95016,02,${moku},${code},,${amt},1,0,0,${host}__a,1`;
  it('reads the 目 of a 項, with the 分類コード made from the 要求書 code, using the book with the largest amount when the 項 is in several', () => {
    const csv = [H, line(2027, 'a.go.jp', '職員基本給', 400), line(2027, 'a.go.jp', '庁費', 90, '95016-2123-09-0100'), line(2027, 'b.go.jp', '職員基本給', 10)].join('\n');
    const out = requestOnlyMoku([row({})], new Map([[2027, csv]]));
    expect(out.get('2027:general:request|内閣府||本府|新設費')).toEqual({ m: [['職員基本給', '95|016|2|11|1', 400, null], ['庁費', '95|016|2|12|3', 90, null]], noReq: false });
  });
  it('reads a 項 that did not match the 予算書 (reqOnly・zero) from the same CSV, and leaves the code empty for a form it cannot read', () => {
    const csv = [H, line(2024, 'a.go.jp', '庁費', 50, '95016-111-09-0100')].join('\n');
    const out = requestOnlyMoku([row({ kind: 'reqOnly', y: 2024, grp: '内閣府' })], new Map([[2024, csv]]));
    expect(out.get('2024:general:request|内閣府||本府|新設費')).toEqual({ m: [['庁費', '', 50, null]], noReq: false });
  });
  it('marks a 項 without 目 lines as noReq, and puts a same-year pair on the 予算書 項', () => {
    const out = requestOnlyMoku([row({}), row({ name: '別費' })], new Map([[2027, H]]), new Map([['2027:general:request|内閣府||本府|別費', '2027:general:内閣府|本府|001|別費']]));
    expect(out.get('2027:general:request|内閣府||本府|新設費')).toEqual({ m: [], noReq: true });
    expect(out.get('2027:general:内閣府|本府|001|別費')).toEqual({ m: [], noReq: true });
  });
});
