import { describe, expect, it } from 'vitest';
import { buildRsJigyo } from './rs-jigyo.ts';
import type { RsLinkRow } from './rs-link.ts';

const ov = (o: Record<string, string>): Record<string, string> => ({ 予算事業ID: '1', 事業名: '研修事業', 府省庁: '内閣官房', '局・庁': '室', 主要経費: '', ...o });
const sm = (o: Record<string, string>): Record<string, string> => ({ 予算事業ID: '1', 予算年度: '2025', 会計区分: '', '当初予算(合計)': '100', '補正予算(合計)': '', '前年度からの繰越し(合計)': '5', '予備費等(合計)': '0', '計(歳出予算現額合計)': '105', '執行額(合計)': '90', '翌年度への繰越し(合計)': '15', '翌年度要求額(合計)': '120.0', ...o });
const lk = (o: Partial<RsLinkRow>): RsLinkRow => ({ id: '1', year: 2025, kind: '当初予算', status: 'linked', kouId: '2025:general:A', moku: '庁費', mokuHit: true, yen: 60, ...o });

describe('buildRsJigyo', () => {
  it('makes one 事業 per ID, and merges the 主要経費 of the rows that are split by it', () => {
    const d = buildRsJigyo([ov({ 主要経費: '一般歳出' }), ov({ 主要経費: 'その他' }), ov({ 予算事業ID: '10', 事業名: '調査事業' }), ov({ 予算事業ID: '2', 事業名: '別の事業' })], [], []);
    expect(d.jigyo).toEqual([['1', '研修事業', '内閣官房', '室', '一般歳出|その他'], ['2', '別の事業', '内閣官房', '室', ''], ['10', '調査事業', '内閣官房', '室', '']]);
  });

  it('stops when the rows of one ID differ in the 事業名', () => {
    expect(() => buildRsJigyo([ov({}), ov({ 事業名: '違う名前' })], [], [])).toThrow('事業名');
  });

  it('reads the 合計 row of the 2-1 as 円 (a value like 120.0 is 120), keeping a blank as null; the rows by 会計区分 are not used', () => {
    const d = buildRsJigyo([ov({})], [sm({}), sm({ 会計区分: '一般会計', '当初予算(合計)': '999' })], []);
    expect(d.amounts).toEqual([[0, 2025, 100, null, 5, 0, 105, 90, 15, 120]]);
    expect(d.years).toEqual([2025]);
  });

  it('drops the blank 合計 row when another row has values, and stops when two rows with values differ', () => {
    const blank = sm({ '当初予算(合計)': '', '前年度からの繰越し(合計)': '', '予備費等(合計)': '', '計(歳出予算現額合計)': '', '執行額(合計)': '', '翌年度への繰越し(合計)': '', '翌年度要求額(合計)': '' });
    expect(buildRsJigyo([ov({})], [blank, sm({})], []).amounts).toHaveLength(1);
    expect(buildRsJigyo([ov({})], [blank], []).amounts[0]!.slice(2)).toEqual(Array(8).fill(null));
    expect(() => buildRsJigyo([ov({})], [sm({}), sm({ '執行額(合計)': '91' })], [])).toThrow('違う値');
  });

  it('stops on a value that is not an integer, and on a 事業 that is not in the 1-2', () => {
    expect(() => buildRsJigyo([ov({})], [sm({ '当初予算(合計)': '12.5' })], [])).toThrow('整数でない');
    expect(() => buildRsJigyo([ov({})], [sm({ 予算事業ID: '9' })], [])).toThrow('1-2 に無い');
  });

  it('keeps only the linked rows, pointing at the 項 by an index', () => {
    const d = buildRsJigyo([ov({})], [], [lk({}), lk({ moku: '旅費', kouId: '2025:general:B', yen: null }), lk({ status: 'noKou', kouId: '' }), lk({ status: 'ambiguous', kouId: '' })]);
    expect(d.kous).toEqual(['2025:general:A', '2025:general:B']);
    expect(d.links).toEqual([[0, 2025, 0, '庁費', '当初予算', 60], [0, 2025, 1, '旅費', '当初予算', null]]);
  });
});
