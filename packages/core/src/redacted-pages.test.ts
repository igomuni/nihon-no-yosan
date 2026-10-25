import { describe, expect, it } from 'vitest';
import { kouOfPage, solidDark, type KouPageRow } from './redacted-pages.ts';

const image = (w: number, h: number, paint: (x: number, y: number) => number): Uint8Array => {
  const a = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = paint(x, y);
  return a;
};

describe('solidDark', () => {
  it('counts a filled black rectangle and gives its bounding box', () => {
    const g = image(100, 60, (x, y) => (x >= 20 && x < 60 && y >= 10 && y < 20 ? 0 : 255));
    const r = solidDark(g, 100, 60);
    expect(r.count).toBe((40 - 9 + 1) * (10 - 3 + 1)); // 窓が収まる位置の数
    expect(r.bbox).toEqual([20, 10, 60, 20]);
  });
  it('does not count thin lines or text-like strokes', () => {
    const lines = image(100, 60, (x, y) => (y === 30 || x === 50 || (y % 4 === 0 && x > 10 && x < 90) ? 0 : 255));
    expect(solidDark(lines, 100, 60)).toEqual({ count: 0, bbox: null });
  });
  it('does not count grey shading', () => {
    expect(solidDark(image(100, 60, () => 128), 100, 60).count).toBe(0);
  });
});

const row = (name: string, startPage: number, basis = '項', imagePage = false): KouPageRow => ({ organization: 'o', itemName: name, itemCode: '001', startPage, basis, imagePage });

describe('kouOfPage', () => {
  const rows = [row('A', 1), row('B', 10), row('C', 20, '推定')];
  it('picks the 項 with the largest start page not after the page, and says where the next one starts', () => {
    expect(kouOfPage(rows, 12)).toMatchObject({ kind: 'range', nextStart: 20, rows: [{ itemName: 'B' }] });
    expect(kouOfPage(rows, 10)).toMatchObject({ kind: 'range', rows: [{ itemName: 'B' }] });
  });
  it('calls it estimated when the start page was estimated or has no text layer', () => {
    expect(kouOfPage(rows, 25)).toMatchObject({ kind: 'estimated', nextStart: null, rows: [{ itemName: 'C' }] });
    expect(kouOfPage([row('D', 5, '項', true)], 6).kind).toBe('estimated');
  });
  it('returns none before the first 項 or when the book has no 項', () => {
    expect(kouOfPage(rows, 0)).toMatchObject({ kind: 'none', nextStart: 1 });
    expect(kouOfPage([], 3)).toEqual({ kind: 'none', rows: [], nextStart: null });
  });
});
