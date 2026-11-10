import { describe, expect, it } from 'vitest';
import { INITIAL_PROCUREMENT_FILTERS, filterProcurementRows, parseYenInput, procurementIndex, procurementSearchKey, procurementTotals, procurementTrend, sortProcurementRows, vendorKeyOf, yenText, type ProcurementYearData } from './procurement.ts';

const NONE = '__none__';
const meta = {
  ministries: [['W1', 'デジタル庁'], ['N1', '財務省']] as [string, string][],
  methods: [['8002010', '一般競争入札・最低価格'], ['8004030', '随意契約方式・公募型プロポーザル方式']] as [string, string][],
};
const data: ProcurementYearData = {
  year: 2026,
  vendors: [['Ａ社', '1111111111111'], ['Ｂ社', ''], ['Ａ社（旧称）', '1111111111111']],
  rows: [
    ['0000000000000000001', 'システム開発', '2026-04-01', 31389000, 'W1', '8004030', 0],
    ['0000000000000000001', 'システム開発（追加）', '2026-04-02', 100.5, 'W1', '8004030', 2],
    ['0000000000000000002', '庁舎清掃', '2026-05-10', 2000, 'N1', '8002010', 1],
    ['0000000000000000003', '封入作業の単価', '2026-05-11', 29.8, 'N1', '8002010', 1],
  ],
};
const index = procurementIndex(data, meta);

describe('procurementIndex', () => {
  it('names the codes, and keys 落札者 by 法人番号 when there is one, otherwise by 名称', () => {
    expect(index.rows[0]).toMatchObject({ ministryName: 'デジタル庁', methodName: '随意契約方式・公募型プロポーザル方式', vendorName: 'Ａ社', corp: '1111111111111', vendorKey: 'c:1111111111111' });
    expect(index.rows[2]!.vendorKey).toBe('n:Ｂ社');
    // 名称が違っても、同じ法人番号なら同じ落札者
    expect(index.byVendor.get(vendorKeyOf('', '1111111111111'))).toEqual([0, 1]);
  });
  it('lists every row of a 調達案件番号 (one case can have several rows)', () => {
    expect(index.byCase.get('0000000000000000001')).toEqual([0, 1]);
    expect(index.byCase.get('0000000000000000002')).toEqual([2]);
  });
  it('stops on a code that is not in the table instead of inventing a name', () => {
    expect(() => procurementIndex({ ...data, rows: [['1', 'x', '2026-04-01', 1, 'ZZ', '8002010', 0]] }, meta)).toThrow('府省コードが表に無い');
    expect(() => procurementIndex({ ...data, rows: [['1', 'x', '2026-04-01', 1, 'W1', '9999999', 0]] }, meta)).toThrow('入札方式コードが表に無い');
    expect(() => procurementIndex({ ...data, rows: [['1', 'x', '2026-04-01', 1, 'W1', '8002010', 9]] }, meta)).toThrow('落札者の添字が表に無い');
  });
});

describe('filterProcurementRows', () => {
  const f = (patch: Partial<typeof INITIAL_PROCUREMENT_FILTERS>) => filterProcurementRows(index.rows, { ...INITIAL_PROCUREMENT_FILTERS, ...patch }, NONE).map(r => r.i);
  it('passes everything with the initial filters', () => expect(f({})).toEqual([0, 1, 2, 3]));
  it('filters by 府省 and 入札方式 (empty = all, NONE = nothing)', () => {
    expect(f({ ministries: ['N1'] })).toEqual([2, 3]);
    expect(f({ methods: ['8004030'] })).toEqual([0, 1]);
    expect(f({ ministries: [NONE] })).toEqual([]);
    expect(f({ methods: [NONE] })).toEqual([]);
  });
  it('filters by 案件名 and 落札者 as a substring or a regex', () => {
    expect(f({ name: '清掃' })).toEqual([2]);
    expect(f({ name: '^システム.*追加', nameRegex: true })).toEqual([1]);
    expect(f({ vendor: 'Ａ社' })).toEqual([0, 1]);
    expect(f({ vendor: '(', vendorRegex: true })).toEqual([]);
  });
  it('ignores full-width / half-width and case when searching (the displayed text stays as in the original)', () => {
    const w = procurementIndex({
      year: 2026,
      vendors: [['ＮＴＴデータ', ''], ['ｱｸｾﾝﾁｭｱ株式会社', '']],
      rows: [
        ['0000000000000000001', '令和７年度ＡＩ基盤（第２期）', '2026-04-01', 1, 'W1', '8004030', 0],
        ['0000000000000000002', 'ai tool', '2026-04-02', 1, 'W1', '8004030', 1],
      ],
    }, meta);
    const g = (patch: Partial<typeof INITIAL_PROCUREMENT_FILTERS>) => filterProcurementRows(w.rows, { ...INITIAL_PROCUREMENT_FILTERS, ...patch }, NONE).map(r => r.i);
    expect(g({ vendor: 'NTT' })).toEqual([0]);
    expect(g({ vendor: 'ntt' })).toEqual([0]);
    expect(g({ vendor: 'アクセンチュア' })).toEqual([1]); // 半角カナの原本に、全角カナで
    expect(g({ vendor: 'ｱｸｾﾝﾁｭｱ' })).toEqual([1]);
    expect(g({ name: '令和7年度AI' })).toEqual([0]); // 全角数字・全角英字の原本に、半角で
    expect(g({ name: '（第2期）' })).toEqual([0]); // 全角括弧の入力でも
    expect(g({ name: 'AI' })).toEqual([0, 1]);
    expect(g({ name: '^令和.年度ai', nameRegex: true })).toEqual([0]);
    expect(w.rows[0]!.name).toBe('令和７年度ＡＩ基盤（第２期）'); // 表示用の値は変えない
  });
  it('filters by whether the 法人番号 is empty in the original', () => {
    expect(f({ corp: 'with' })).toEqual([0, 1]);
    expect(f({ corp: 'without' })).toEqual([2, 3]);
  });
  it('filters by price range, and a non-numeric input matches nothing', () => {
    expect(f({ minYen: '1,000' })).toEqual([0, 2]);
    expect(f({ maxYen: '100' })).toEqual([3]);
    expect(f({ minYen: '100', maxYen: '2000' })).toEqual([1, 2]);
    expect(f({ minYen: 'abc' })).toEqual([]);
  });
});

describe('parseYenInput', () => {
  it('reads digits with commas and spaces', () => {
    expect(parseYenInput('')).toBeNull();
    expect(parseYenInput(' 1,234 ')).toBe(1234);
    expect(parseYenInput('1.5')).toBeNaN();
  });
});

describe('sortProcurementRows', () => {
  it('sorts by price in both directions, ties in file order', () => {
    expect(sortProcurementRows(index.rows, 'yen', -1).map(r => r.i)).toEqual([0, 2, 1, 3]);
    expect(sortProcurementRows(index.rows, 'yen', 1).map(r => r.i)).toEqual([3, 1, 2, 0]);
  });
  it('sorts by date and by name', () => {
    expect(sortProcurementRows(index.rows, 'date', -1).map(r => r.i)).toEqual([3, 2, 1, 0]);
    expect(sortProcurementRows(index.rows, 'ministry', 1).map(r => r.ministryName)).toEqual(['デジタル庁', 'デジタル庁', '財務省', '財務省']);
  });
});

describe('procurementTotals / yenText', () => {
  it('sums in 銭 so that the fractions do not drift', () => {
    const t = procurementTotals(index.rows);
    expect(t).toEqual({ rows: 4, yen: 31391130.3, vendors: 2, cases: 3, ministries: 2 });
    expect(procurementTotals([])).toEqual({ rows: 0, yen: 0, vendors: 0, cases: 0, ministries: 0 });
  });
  it('shows up to 2 decimals', () => {
    expect(yenText(31389000)).toBe('31,389,000 円');
    expect(yenText(29.8)).toBe('29.8 円');
    expect(yenText(100.5)).toBe('100.5 円');
  });
});

describe('procurementTrend', () => {
  const other = procurementIndex({ year: 2025, vendors: [['Ｃ社', '2222222222222']], rows: [['0000000000000000009', '清掃', '2025-06-01', 500, 'N1', '8002010', 0]] }, meta);
  const rowsOf = (y: number) => (y === 2026 ? index.rows : y === 2025 ? other.rows : undefined);
  it('applies the same filters to each year, in the order given, and marks a year that is not loaded', () => {
    const t = procurementTrend([2025, 2026, 2024], rowsOf, { ...INITIAL_PROCUREMENT_FILTERS, ministries: ['N1'] }, NONE);
    expect(t.map(x => x.year)).toEqual([2025, 2026, 2024]);
    expect(t[0]!.totals).toEqual({ rows: 1, yen: 500, vendors: 1, cases: 1, ministries: 1 });
    expect(t[1]!.totals).toEqual({ rows: 2, yen: 2029.8, vendors: 1, cases: 2, ministries: 1 });
    expect(t[2]!.totals).toBeNull();
  });
  it('gives the same totals as the list footer for a year (so that the selected year agrees with the list)', () => {
    const f = { ...INITIAL_PROCUREMENT_FILTERS, name: 'システム' };
    expect(procurementTrend([2026], rowsOf, f, NONE)[0]!.totals).toEqual(procurementTotals(filterProcurementRows(index.rows, f, NONE)));
  });
  it('gives 0 rows (not null) for a loaded year where nothing matches', () => {
    expect(procurementTrend([2025], rowsOf, { ...INITIAL_PROCUREMENT_FILTERS, name: '該当なし' }, NONE)[0]!.totals).toEqual({ rows: 0, yen: 0, vendors: 0, cases: 0, ministries: 0 });
  });
});

describe('procurementSearchKey', () => {
  it('folds width and case, and leaves other compatibility characters alone', () => {
    expect(procurementSearchKey('ＮＴＴ　Ｄａｔａ')).toBe('ntt\u3000data'); // 全角空白は変えない（fold は ASCII の範囲だけ）
    expect(procurementSearchKey('ｼｽﾃﾑ')).toBe('システム');
    expect(procurementSearchKey('㈱')).toBe('㈱');
  });
});
