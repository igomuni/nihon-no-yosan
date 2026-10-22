import { describe, expect, it } from 'vitest';
import { buildPositionTree, buildPositionTreeFromDetail, buildTocTree, kouKey, supplementTocTree, totalTableKouHeads } from './request-tree.ts';

// 総表の行（必要な列だけ）
const tot = (row_type: string, 区分: string, req = '', 要求番号 = '') => ({ row_type, 区分, '８年度概算要求額_計': req, 要求番号, source_page: '1' });
// 目次の行
const toc = (区分: string, 要求番号 = '') => ({ 区分, 要求番号, ページ: '1' });

// 総表: 017 の項（事項 2 つ。間に事項の下の見出し 006）→ 目次に無い 019（繰入）→ 020
const total = [
  tot('CODE3', '017 地球温暖化対策推進費', '100'),
  tot('DETAIL', '01‑95 地球温暖化対策の推進に必要な経費', '60', '4'),
  tot('CODE3', '006 二国間クレジット制度の構築等事業', '40'),
  tot('DETAIL', '11‑13 気候変動の影響への適応策に関する調査研究に必要な経費', '40', '5'),
  tot('CODE3', '019 石油石炭税財源エネルギー対策特別会計へ繰入', '1648'),
  tot('DETAIL', '01‑63 石油石炭税財源のエネルギー需給勘定へ繰入れに必要な経費', '1648', '6'),
  tot('CODE3', '020 脱炭素成長型経済構造移行推進エネルギー対策特別会計へ繰入', '0'),
  tot('DETAIL', '01‑63 脱炭素成長型経済構造移行費用の繰入れに必要な経費', '0', '7'),
  tot('TOTAL', '組織計', '1748'),
];

describe('kouKey', () => {
  it('joins the code and the aligned name', () => {
    expect(kouKey('017', '地球温暖化 対策推進費')).toBe('017|地球温暖化対策推進費');
  });
});

describe('buildTocTree', () => {
  it('puts each 事項 under the heading right before it and keeps the scope of the headings', () => {
    const t = buildTocTree('env', [
      toc('（所管） 31 環境省'),
      toc('（組織） 010 環境本省'),
      toc('（項） 017 地球温暖化対策推進費'),
      toc('01-95 地球温暖化対策の推進に必要な経費', '4'),
      toc('見出しでも事項でもない行'),
    ]);
    expect(t.labels.map(l => [l.kind, l.code, l.name])).toEqual([
      ['所管', '31', '環境省'],
      ['組織', '010', '環境本省'],
      ['項', '017', '地球温暖化対策推進費'],
    ]);
    expect(t.kous.map(k => [k.idx, k.code, k.ministry, k.org, k.account, k.sub])).toEqual([[0, '017', '環境省', '環境本省', null, null]]);
    expect(t.jikous.map(j => [j.reqNo, j.first, j.class2, j.name, j.kouIdx])).toEqual([['4', '01', '95', '地球温暖化対策の推進に必要な経費', 0]]);
    expect(t.unclassified).toBe(1);
  });
  it('stops on an unreadable or unexpected heading', () => {
    expect(() => buildTocTree('x', [toc('（項）')])).toThrow(/読めない/);
    expect(() => buildTocTree('x', [toc('（款） 01 租税')])).toThrow(/想定外/);
  });
});

describe('totalTableKouHeads', () => {
  it('takes an unlisted heading as a 項 only when the previous 項 closes exactly there (sub-headings inside a 項 do not)', () => {
    const heads = totalTableKouHeads(total, ['017|地球温暖化対策推進費', '020|脱炭素成長型経済構造移行推進エネルギー対策特別会計へ繰入']);
    expect(heads.map(h => [h.code, h.listed, h.isKou])).toEqual([
      ['017', true, true],
      ['006', false, false],
      ['019', false, true],
      ['020', true, true],
    ]);
  });
  it('without a list (no TOC), keeps the first heading and then only headings where the previous 項 closes', () => {
    const heads = totalTableKouHeads(total, null);
    expect(heads.filter(h => h.isKou).map(h => h.code)).toEqual(['017', '019', '020']);
  });
  it('does not take a heading as a 項 when an amount in the range is blank', () => {
    const rows = [tot('CODE3', '017 A', '100'), tot('DETAIL', '01‑95 a', '', '1'), tot('CODE3', '019 B', '5'), tot('DETAIL', '01‑63 b', '5', '2')];
    expect(totalTableKouHeads(rows, ['017|A']).map(h => [h.code, h.isKou])).toEqual([
      ['017', true],
      ['019', false],
    ]);
  });
});

describe('supplementTocTree', () => {
  it('inserts the omitted 項 after the previous 項 and moves its 事項 that the TOC put under the previous 項', () => {
    const t = buildTocTree('env', [
      toc('（所管） 31 環境省'),
      toc('（組織） 010 環境本省'),
      toc('（項） 017 地球温暖化対策推進費'),
      toc('01-95 地球温暖化対策の推進に必要な経費', '4'),
      toc('11-13 気候変動の影響への適応策に関する調査研究に必要な経費', '5'),
      toc('01-63 石油石炭税財源のエネルギー需給勘定へ繰入れに必要な経費', '6'),
      toc('（項） 020 脱炭素成長型経済構造移行推進エネルギー対策特別会計へ繰入'),
      toc('01-63 脱炭素成長型経済構造移行費用の繰入れに必要な経費', '7'),
    ]);
    const added = supplementTocTree(t, total);
    expect(added.map(k => [k.code, k.org, k.fromTotal])).toEqual([['019', '環境本省', true]]);
    expect(t.kous.map(k => [k.idx, k.code])).toEqual([
      [0, '017'],
      [1, '019'],
      [2, '020'],
    ]);
    expect(t.jikous.map(j => [j.reqNo, j.kouIdx])).toEqual([
      ['4', 0],
      ['5', 0],
      ['6', 1],
      ['7', 2],
    ]);
  });
});

describe('buildPositionTree', () => {
  it('does not make sub-headings into 項 when there is no TOC', () => {
    const t = buildPositionTree('env', total, () => false);
    expect(t.kous.map(k => k.code)).toEqual(['017', '019', '020']);
    expect(t.jikous.map(j => [j.reqNo, j.kouIdx])).toEqual([
      ['4', 0],
      ['5', 0],
      ['6', 1],
      ['7', 2],
    ]);
  });
  it('reads 勘定 from a 1-digit HIER and 会計 from a 2-digit HIER only when it is a special account name', () => {
    const t = buildPositionTree(
      'energy',
      [
        tot('HIER', '13 エネルギー対策特別会計'),
        tot('HIER', '2 エネルギー需給勘定'),
        tot('HIER', '10 経済産業省'),
        tot('CODE3', '010 燃料安定供給対策費', '5'),
        tot('DETAIL', '01‑63 燃料安定供給対策に必要な経費', '5', '1'),
      ],
      n => n === 'エネルギー対策特別会計',
    );
    expect(t.kous.map(k => [k.code, k.account, k.sub])).toEqual([['010', 'エネルギー対策特別会計', 'エネルギー需給勘定']]);
  });
});

describe('buildPositionTreeFromDetail', () => {
  const det = (row_type: string, 事項: string, 要求番号 = '') => ({ row_type, 事項, 要求番号, source_page: '3' });
  it('reads 勘定 from CODE1, 会計 from CODE2 and takes every CODE3 followed by DETAIL as a 項', () => {
    const t = buildPositionTreeFromDetail(
      'energy',
      [
        det('CODE2', '13 エネルギー対策特別会計'),
        det('CODE1', '2 エネルギー需給勘定'),
        det('CODE3', '010 燃料安定供給対策費'),
        det('DETAIL', '01‑63 燃料安定供給対策に必要な経費', '1'),
        det('DETAIL', '事項でない行'),
      ],
      n => n === 'エネルギー対策特別会計',
    );
    expect(t.hierarchy).toBe('position_detail');
    expect(t.kous.map(k => [k.code, k.page, k.account, k.sub])).toEqual([['010', '3', 'エネルギー対策特別会計', 'エネルギー需給勘定']]);
    expect(t.jikous.map(j => [j.reqNo, j.kouIdx])).toEqual([['1', 0]]);
    expect(t.unclassified).toBe(1);
  });
});
