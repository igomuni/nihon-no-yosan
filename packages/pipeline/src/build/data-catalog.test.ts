import { describe, expect, it } from 'vitest';
import * as zlib from 'node:zlib';
import { DATA_FILE_SPECS, buildDataCatalog } from './data-catalog.ts';

const gz = (v: unknown): Buffer => zlib.gzipSync(JSON.stringify(v));
const releases = [{ name: '基準データ', tag: 'dataset-x', asset: 'x.tar.gz', bytes: 10, sha256: 'ab' }];

describe('buildDataCatalog', () => {
  const files = new Map<string, Buffer>([
    ['lifecycle/codes.json.gz', gz({ pages: [{ year: 2024, form: '11001', major: [], use: [] }] })],
    ['about.json', Buffer.from(JSON.stringify({ dataset: { version: 'v0' }, authorities: [], budgetBook: {} }))],
  ]);

  it('lists each file with its size, hash, description, docs and the shape of the top-level keys', () => {
    const c = buildDataCatalog({ files, releases });
    expect(c.files.map(f => f.path)).toEqual(['about.json', 'lifecycle/codes.json.gz']); // 並びは、パスの順
    const codes = c.files[1]!;
    expect(codes).toMatchObject({ encoding: 'gzip-json', bytes: files.get('lifecycle/codes.json.gz')!.length });
    expect(codes.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(codes.keys['pages']).toMatchObject({ type: 'array', length: 1, item: 'object' });
    expect(codes.keys['pages']!.description).not.toBe('');
    expect(codes.docs[0]).toContain('/docs/guides/');
    expect(c.files[0]!.encoding).toBe('json');
  });

  it('puts the conventions first, the releases (with the URL of the tag) and the guides', () => {
    const c = buildDataCatalog({ files, releases });
    expect(c.conventions.some(x => x.includes('null'))).toBe(true);
    expect(c.releases[0]!.url).toBe('https://github.com/igomuni/nihon-no-yosan/releases/tag/dataset-x');
    expect(c.guides.url).toContain('docs/guides');
  });

  it('stops on a file without a description (so that no file is left out of the catalog), and on a documented key that the data does not have', () => {
    expect(() => buildDataCatalog({ files: new Map([['new/file.json.gz', gz({ a: 1 })]]), releases })).toThrow('説明が無いファイル');
    expect(() => buildDataCatalog({ files: new Map([['lifecycle/codes.json.gz', gz({ other: [] })]]), releases })).toThrow('データに無い');
  });

  it('describes every file that the build writes (the spec has an entry for each output file)', () => {
    expect(Object.keys(DATA_FILE_SPECS).sort()).toEqual(['about.json', 'lifecycle/codes.json.gz', 'lifecycle/data.json.gz', 'lifecycle/jikou.json.gz', 'lifecycle/moku.json.gz', 'mof/detail.json.gz', 'mof/kou.json.gz', 'rs/jigyo.json.gz', 'trend/detail.json.gz', 'trend/jikou.json.gz', 'trend/kou.json.gz']);
  });
});
