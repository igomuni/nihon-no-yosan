import { describe, expect, it } from 'vitest';
import {
  assertValidPage,
  compareObservation,
  COORDINATE_SYSTEM,
  pageMetaFrom,
  toSourceToken,
  toSourceTokens,
  type RawTextItem,
  type RawTextStyles,
} from './request-source-token.ts';

const styles: RawTextStyles = { f1: { ascent: 0.859, descent: -0.141 } };
const item = (str: string, e: number, f: number, width: number, over: Partial<RawTextItem> = {}): RawTextItem => ({
  str,
  transform: [6.944, 0, 0, 6.944, e, f],
  width,
  height: 6.944,
  fontName: 'f1',
  hasEOL: false,
  dir: 'ltr',
  ...over,
});
const meta = pageMetaFrom(9, 106, [0, 0, 842, 595], 0);

describe('座標変換（PDF user space 左下原点 → 左上原点・y下向き）', () => {
  it('METI p9 の 01-95: pdf.js (x=65.569, baseline=457.105) → bbox上端 131.930（人間確認値と同じ座標系）', () => {
    const t = toSourceToken(item('01-95', 65.569, 457.105, 17.359), 49, meta, styles);
    expect(t.bbox.xMin).toBe(65.569);
    expect(t.bbox.xMax).toBe(82.928);
    expect(t.bbox.yMin).toBe(131.93);
    expect(t.bbox.yMax).toBeCloseTo(595 - 457.105 + 0.141 * 6.944, 3); // 下端 = baseline + |descent|*fontSize
  });

  it('rawTextを補正しない（空文字・空白のみ・全角・順序反転した数字chunkもそのまま）', () => {
    const items = [item('', 1, 1, 0), item(' ', 2, 1, 13.7), item('（要求要旨）', 3, 1, 41.662), item('599,', 4, 1, 13.887)];
    expect(toSourceTokens(items, meta, styles).map(t => t.rawText)).toEqual(['', ' ', '（要求要旨）', '599,']);
  });

  it('transform・width・fontSize・hasEOL・index・pageを保持する', () => {
    const t = toSourceToken(item('x', 10, 20, 3, { hasEOL: true }), 7, meta, styles);
    expect(t).toMatchObject({ index: 7, page: 9, transform: [6.944, 0, 0, 6.944, 10, 20], width: 3, fontSize: 6.944, hasEOL: true, fontName: 'f1', dir: 'ltr' });
  });

  it('view原点が(0,0)でないページはオフセットを引く', () => {
    const m = pageMetaFrom(1, 1, [10, 20, 110, 220], 0); // 100 x 200
    expect(m).toMatchObject({ width: 100, height: 200 });
    const t = toSourceToken(item('a', 30, 70, 5), 0, m, styles);
    expect(t.bbox.xMin).toBe(20); // 30 - 10
    expect(t.bbox.yMin).toBeCloseTo(200 - (70 - 20) - 0.859 * 6.944, 3);
  });

  it('未知のfontName・回転ページは例外（黙って補完しない）', () => {
    expect(() => toSourceToken(item('a', 1, 1, 1, { fontName: 'zz' }), 0, meta, styles)).toThrow(/styleがありません/);
    expect(() => pageMetaFrom(1, 1, [0, 0, 100, 100], 90)).toThrow(/回転ページ/);
  });

  it('座標系のmetadataが明示されている', () => {
    expect(COORDINATE_SYSTEM).toMatchObject({ origin: 'top-left', xDirection: 'right', yDirection: 'down', unit: 'pt (1/72 inch)' });
  });
});

describe('page番号の検証', () => {
  it('1〜numPagesの整数のみ有効', () => {
    expect(() => assertValidPage(1, 3)).not.toThrow();
    expect(() => assertValidPage(3, 3)).not.toThrow();
    for (const bad of [0, 4, -1, 1.5, NaN]) expect(() => assertValidPage(bad, 3)).toThrow(/pageは1〜3/);
  });
});

describe('compareObservation（評価専用）', () => {
  const tokens = toSourceTokens([item('01-95', 65.569, 465, 17), item('01-95', 65.569, 165.468, 17), item('他', 1, 1, 1)], meta, styles);
  it('期待位置に最も近い（rawTextにtextを含む）tokenとの差を返す', () => {
    const c = compareObservation(tokens, { text: '01-95', x: 65.569, y: 595 - 165.468 - 0.859 * 6.944 });
    expect(c.token?.index).toBe(1);
    expect(c.dx).toBe(0);
    expect(c.dy).toBeCloseTo(0, 3);
  });
  it('該当tokenが無ければundefined（tokenを生成・補正しない）', () => {
    expect(compareObservation(tokens, { text: '存在しない', x: 0, y: 0 }).token).toBeUndefined();
  });
});
