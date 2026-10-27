import { describe, expect, it } from 'vitest';
import { codeName, codeNameChanges, codeTableFileInfo, parseCodeNumberPage, type CodeTablePage } from './code-tables.ts';

const cell = (...lines: string[]): string => `<clm id="x"><p>${lines.map(l => `<l><![CDATA[${l}]]></l>`).join('')}</p></clm>`;
const line = (l: string): string => `<l><![CDATA[${l}]]></l>`;
const section = (mark: string, title: string, rows: [string, ...string[]][]): string => `${line(`(${mark})`)}${line(title)}${rows.map(([c, ...n]) => cell(c) + cell(...n)).join('')}`;
const PAGE = `<budget>${line('(参考)コード番号について')}
  ${section('イ', '所管', [['01', '皇室費'], ['07', 'デジタル庁']])}
  ${line('(ロ)')}${line('項－所管別に')}${line('001')}${line('から始まるコード番号。')}
  ${section('ハ', '主要経費別分類', [['94', '新型コロナウイルス感染症', '及び原油価格・物価高騰対', '策予備費'], ['98', '予備費']])}
  ${section('ト', '使途別分類', [['1', '人件費'], ['9', 'その他']])}
  ${line('(参考)予定経費要求書の科目別内訳の各目に付したコード番号の読み方の例')}${cell('032')}${cell('海岸事業費')}
</budget>`;

describe('parseCodeNumberPage', () => {
  const sections = parseCodeNumberPage(PAGE)!;
  it('takes the code and name cells of each section, joining a name wrapped over several lines', () => {
    expect(sections.map(s => [s.mark, s.title, s.items.length])).toEqual([['イ', '所管', 2], ['ロ', '項－所管別に', 0], ['ハ', '主要経費別分類', 2], ['ト', '使途別分類', 2]]);
    expect(sections[2]!.items[0]).toEqual(['94', '新型コロナウイルス感染症及び原油価格・物価高騰対策予備費']);
  });
  it('stops a table where the cells are no longer code and name (the 読み方の例 after it is not a part of the table)', () => {
    expect(sections[3]!.items).toEqual([['1', '人件費'], ['9', 'その他']]);
  });
  it('returns null for a page that is not the code page, and stops on a code without a name or a repeated code', () => {
    expect(parseCodeNumberPage('<budget><l><![CDATA[別のページ]]></l></budget>')).toBeNull();
    expect(() => parseCodeNumberPage(`<budget>${line('コード番号について')}${line('(ハ)')}${line('主要経費別分類')}${cell('01')}${line('名前のセルでない')}</budget>`)).toThrow('名称のセルが無い');
    expect(() => parseCodeNumberPage(`<budget>${line('コード番号について')}${section('ハ', '主要経費別分類', [['01', 'a'], ['01', 'b']])}</budget>`)).toThrow('コードが重なる');
  });
});

describe('codeTableFileInfo', () => {
  it('reads the year and the form from the file name', () => {
    expect(codeTableFileInfo('202411001001135a.xml')).toEqual({ year: 2024, form: '11001' });
    expect(() => codeTableFileInfo('202411001menu.html')).toThrow('ファイル名でない');
  });
});

const page = (year: number, form: string, items: [string, string][]): CodeTablePage => ({ year, form, file: `${year}${form}000001a.xml`, sha256: '', sections: [{ mark: 'ハ', title: '主要経費別分類', items }] });
const pages = [
  page(2022, '11001', [['94', 'コロナ予備費'], ['96', '産業投資予備費'], ['26', '文官等恩給費']]),
  page(2023, '11001', [['94', 'コロナ予備費'], ['93', 'ウクライナ予備費']]),
  page(2023, '21001', [['94', '原油予備費']]),
  page(2024, '11001', [['94', '原油予備費'], ['93', 'ウクライナ予備費']]),
];
describe('codeName', () => {
  it('gives the name in the page of the year and the form, and null where the page or the code is missing', () => {
    expect(codeName(pages, 2023, '21001', '主要経費別分類', '94')).toBe('原油予備費');
    expect(codeName(pages, 2023, '11001', '主要経費別分類', '94')).toBe('コロナ予備費');
    expect(codeName(pages, 2023, '11001', '主要経費別分類', '96')).toBeNull();
    expect(codeName(pages, 2025, '11001', '主要経費別分類', '94')).toBeNull();
  });
});

describe('codeNameChanges', () => {
  it('lists the codes that changed, appeared or went away along the pages of one form', () => {
    const c = codeNameChanges(pages, '主要経費別分類', '11');
    expect(c.map(x => x.code)).toEqual(['26', '93', '94', '96']);
    expect(c.find(x => x.code === '94')!.history).toEqual([{ year: 2022, form: '11001', name: 'コロナ予備費' }, { year: 2024, form: '11001', name: '原油予備費' }]);
    expect(c.find(x => x.code === '96')!.history).toEqual([{ year: 2022, form: '11001', name: '産業投資予備費' }, { year: 2023, form: '11001', name: null }]);
  });
});
