import { describe, expect, it } from 'vitest';
import { excludedGroup, slugOf, sortedRecord, stringifyManifest, termsOf, termsSummary, type SourceRecord } from './dataset.ts';

describe('slugOf', () => {
  it('turns a PDF path under data/download into the file name stem of its CSV and text', () => {
    expect(slugOf('data/download/cao.go.jp/yosan/soshiki/r08/pdf/03.pdf')).toBe('cao.go.jp__yosan__soshiki__r08__pdf__03');
    expect(slugOf('data/download/shugiin.go.jp/a/b.pdf/$File/c.PDF')).toBe('shugiin.go.jp__a__b.pdf__$File__c');
  });
});

describe('termsOf', () => {
  const terms = { domains: { 'a.go.jp': { authority: 'A', status: 'pdl1.0' as const, basis: 'page-read' as const, url: '' } } };
  it('stops on a domain that is not classified', () => {
    expect(termsOf(terms, 'a.go.jp').status).toBe('pdl1.0');
    expect(() => termsOf(terms, 'b.go.jp')).toThrow(/b\.go\.jp/);
  });
});

describe('excludedGroup', () => {
  it('drops the year and groups the sources folder', () => {
    expect(excludedGroup('toc/sources/x.csv')).toBe('toc/sources/*');
    expect(excludedGroup('toc/token-ledger.csv')).toBe('toc/token-ledger.csv');
  });
});

describe('termsSummary', () => {
  it('counts the sources by status and basis', () => {
    const s = (status: 'pdl1.0' | 'unconfirmed', basis: 'page-read' | 'none') => ({ terms: { status, basis } }) as SourceRecord;
    expect(termsSummary([s('pdl1.0', 'page-read'), s('pdl1.0', 'page-read'), s('unconfirmed', 'none')])).toEqual({
      'pdl1.0/page-read': 2,
      'unconfirmed/none': 1,
    });
  });
});

describe('stringifyManifest', () => {
  it('writes valid JSON with sorted files, one entry per line', () => {
    const text = stringifyManifest({
      schema: 'x',
      nested: { a: [1, 2] },
      files: { 'b.csv': { sha256: '2', bytes: 2 }, 'a.csv': { sha256: '1', bytes: 1 } },
      sources: [],
    });
    const parsed = JSON.parse(text) as { files: Record<string, unknown>; nested: unknown };
    expect(Object.keys(parsed.files)).toEqual(['a.csv', 'b.csv']);
    expect(parsed.nested).toEqual({ a: [1, 2] });
    expect(text).toContain('  "a.csv": {"sha256":"1","bytes":1},\n');
  });
});

describe('sortedRecord', () => {
  it('sorts the keys', () => {
    expect(Object.keys(sortedRecord({ b: 1, a: 2 }))).toEqual(['a', 'b']);
  });
});
