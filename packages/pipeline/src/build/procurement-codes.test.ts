import { describe, expect, it } from 'vitest';
import { parseProcurementCodeTables } from './procurement-codes.ts';

const text = `
                    落札実績オープンデータ
   令和 8 年 10 月版

3. コード一覧
3.1    府省コード

項番     コード   名称


1      A1    衆議院
2      B1    参議院
3      JA    こども家庭庁



                          7
                           落札実績オープンデータファイル仕様

項番   コード   名称

4   X1    防災庁


                      8
3.2   入札方式コード

項番    コード   名称

1      8002010 一般競争入札・最低価格
2      8004030 随意契約方式・公募型プロポーザル方式

                        9
`;

describe('parseProcurementCodeTables', () => {
  it('reads both tables across pages, skipping headings and page numbers', () => {
    const t = parseProcurementCodeTables(text);
    expect(t.edition).toBe('令和 8 年 10 月版');
    expect(t.ministries).toEqual([['A1', '衆議院'], ['B1', '参議院'], ['JA', 'こども家庭庁'], ['X1', '防災庁']]);
    expect(t.methods).toEqual([['8002010', '一般競争入札・最低価格'], ['8004030', '随意契約方式・公募型プロポーザル方式']]);
  });
  it('uses the headings in the body, not the ones in the table of contents', () => {
    const withToc = `   令和 8 年 10 月版\n目次\n3. コード一覧 ......... 7\n  3.1 府省コード ......... 7\n  3.2 入札方式コード ......... 9\n${text.replace('   令和 8 年 10 月版\n', '')}`;
    expect(parseProcurementCodeTables(withToc).ministries).toHaveLength(4);
  });
  it('stops when 項番 skips a number', () => {
    expect(() => parseProcurementCodeTables(text.replace('2      B1    参議院\n', ''))).toThrow('項番が続かない');
  });
  it('stops on a duplicated code', () => {
    expect(() => parseProcurementCodeTables(text.replace('JA    こども家庭庁', 'B1    こども家庭庁'))).toThrow('コードが重なっている');
  });
  it('stops on a row whose code has the wrong shape', () => {
    expect(() => parseProcurementCodeTables(text.replace('8004030', '80040'))).toThrow('コードの形が合わない');
  });
  it('stops when the edition or a heading is missing', () => {
    expect(() => parseProcurementCodeTables(text.replace('令和 8 年 10 月版', ''))).toThrow('版');
    expect(() => parseProcurementCodeTables(text.replace('3.2   入札方式コード', ''))).toThrow('見出し');
  });
});
