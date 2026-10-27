import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MOKU_FLAG, type LifecycleKou } from '@nihon-no-yosan/core';
import type { LifecycleSource } from './lifecycle.ts';
import { buildLifecycleMoku } from './lifecycle-moku.ts';

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
${g},05,共通費,施設整備費,300000,0,0,0,0,300000,0,300000,0,4
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
    expect(at('施設整備費').slice(5, 9)).toEqual([null, 300, 300, 300]);
    expect(at('情報処理業務庁費').slice(5, 12)).toEqual([null, null, null, 5, 5, 0, 0]);
    expect(at('庁費').slice(8, 12)).toEqual([100, 90, 0, 10]);
    expect([stats.suppOnly, stats.settleOnly]).toEqual([1, 1]);
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
