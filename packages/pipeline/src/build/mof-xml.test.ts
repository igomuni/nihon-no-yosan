import { describe, expect, it } from 'vitest';
import { yearLabelOf } from './mof-jikou.ts';
import { MofXmlParseError, parseMofBudgetXmlItemFile, parseMofSpecialXmlFile, readMenuAncestorChains } from './mof-xml.ts';

// パーサーの本体の確認は、基準データの FY2023・FY2024 の事項の CSV との全件のバイト一致（`compare-mof-jikou.ts`）と、項の CSV との突き合わせ（`mof-jikou-cli.ts`）。
// ここは、年度の見出しの文字・目次・失敗の仕方だけを、小さな入力で確かめる。
const ASCII_XML = '<?xml version="1.0" encoding="Shift_JIS" ?>\n<!DOCTYPE budget SYSTEM "../dtd/999901.dtd">\n<budget><title_for_list><![CDATA[x]]></title_for_list></budget>';
const spec = { documentId: '201711001', doctype: 'DOCTYPE budget SYSTEM "../dtd/201701.dtd"', yearLabel: '平成29年度' };

describe('yearLabelOf', () => {
  it('uses 平成 until FY2019 (the FY2019 initial budget is 平成31年度) and 令和 from FY2020', () => {
    expect([2017, 2018, 2019, 2020, 2023].map(yearLabelOf)).toEqual(['平成29年度', '平成30年度', '平成31年度', '令和2年度', '令和5年度']);
  });
});

describe('readMenuAncestorChains', () => {
  it('gives each XML file the chain of headings above its first appearance', () => {
    const menu = 'LineOut(1,1,"内閣府所管","","")\nLineOut(2,1,"甲号予定経費要求書","","")\nLineOut(3,0,"組織別事項別内訳","a.xml#1","")\nLineOut(3,0,"別の表","b.xml#2","")';
    const chains = readMenuAncestorChains(menu);
    expect(chains.get('a.xml')).toEqual(['内閣府所管', '甲号予定経費要求書', '組織別事項別内訳']);
    expect(chains.get('b.xml')).toEqual(['内閣府所管', '甲号予定経費要求書', '別の表']);
  });
});

describe('the parsers stop on a file they do not recognise (no silent skip)', () => {
  const bytes = new TextEncoder().encode(ASCII_XML); // ASCII だけなので、Shift_JIS としても同じに読める
  it('rejects a DOCTYPE that is not the one for the year', () => {
    expect(() => parseMofBudgetXmlItemFile({ filename: 'a.xml', bytes, documentId: spec.documentId, menuChain: [], spec })).toThrow(MofXmlParseError);
    expect(() => parseMofSpecialXmlFile({ filename: 'a.xml', bytes, menuChain: [], spec: { ...spec, documentId: '201712001' } })).toThrow(MofXmlParseError);
  });
  it('returns unsupported for another document id, without reading the bytes', () => {
    const r = parseMofBudgetXmlItemFile({ filename: 'a.xml', bytes: new Uint8Array(), documentId: '201711001', menuChain: [], spec: { ...spec, documentId: '202211001' } });
    expect(r).toEqual({ status: 'unsupported', file: 'a.xml', reason: 'document_id' });
  });
});

describe('補正予算の事項の CSV の名前と列', async () => {
  const { hoseiColumns, hoseiFileName, hoseiYearLabelOf, hoseiDocumentIdOf } = await import('./mof-jikou-hosei.ts');
  it('uses 令和元年度 for the FY2019 supplementary budget (the initial budget says 平成31年度), and names later rounds -2, -3', () => {
    expect([2018, 2019, 2020].map(hoseiYearLabelOf)).toEqual(['平成30年度', '令和元年度', '令和2年度']);
    expect([hoseiFileName('general', 1), hoseiFileName('special', 2), hoseiFileName('general', 3)]).toEqual(['jikou-general-hosei.csv', 'jikou-special-hosei-2.csv', 'jikou-general-hosei-3.csv']);
    expect([hoseiDocumentIdOf(2020, 'general', 3), hoseiDocumentIdOf(2020, 'special', 1)]).toEqual(['202021003', '202022001']);
  });
  it('keeps the general and special column sets of the 項 / 事項 CSVs', () => {
    expect(hoseiColumns(2023, 'general').slice(0, 7)).toEqual(['所管', '組織', '項コード', '項名', '事項名', '主要経費別分類コード', '令和5年度成立予算額(千円)']);
    expect(hoseiColumns(2023, 'special').slice(0, 9)).toEqual(['所管', '特別会計', '勘定', '組織', '項コード', '項名', '事項名', '分類コード', '令和5年度成立予算額(千円)']);
    expect(hoseiColumns(2023, 'special').at(-4)).toBe('行の種類');
  });
});
