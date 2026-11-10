import { createHash } from 'node:crypto';
import * as zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildProcurement, buildProcurementYear, procurementDataset, readSingleZip, type ProcurementDownloadManifest, type ProcurementManifest } from './procurement.ts';

const codes = { edition: '令和 8 年 10 月版', ministries: [['W1', 'デジタル庁'], ['N1', '財務省']] as [string, string][], methods: [['8002010', '一般競争入札・最低価格'], ['8004030', '随意契約方式・公募型プロポーザル方式']] as [string, string][] };

/** 1 ファイルだけの zip を作る（テスト用。deflate か無圧縮） */
function makeZip(name: string, data: Buffer, method: 0 | 8 = 8, crc = zlib.crc32(data)): Buffer {
  const body = method === 8 ? zlib.deflateRawSync(data) : data;
  const nm = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(method, 10); cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(body.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(0, 42);
  const head = Buffer.concat([local, nm, body]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + nm.length, 12); eocd.writeUInt32LE(head.length, 16);
  return Buffer.concat([head, cd, nm, eocd]);
}

const q = (...cells: string[]): string => cells.map(c => `"${c}"`).join(',');
const row = (patch: Partial<Record<number, string>> = {}): string => q(...['0000000000000000001', 'システム開発', '2026-04-01', '31389000.00', 'W1', '8004030', 'Ａ社', '1111111111111'].map((v, i) => patch[i] ?? v));
const csv = (...rows: string[]): string => `\uFEFF${rows.join('\r\n')}\r\n`;

describe('readSingleZip', () => {
  const data = Buffer.from('あいう,えお\n'.repeat(50));
  it('reads a deflated and a stored entry', () => {
    expect(readSingleZip(makeZip('a.csv', data))).toEqual({ name: 'a.csv', data });
    expect(readSingleZip(makeZip('a.csv', data, 0)).data.equals(data)).toBe(true);
  });
  it('stops on a wrong CRC-32 and on something that is not a zip', () => {
    expect(() => readSingleZip(makeZip('a.csv', data, 8, 123))).toThrow('CRC-32');
    expect(() => readSingleZip(Buffer.from('not a zip at all, just text of some length'))).toThrow('zip');
  });
});

describe('buildProcurementYear', () => {
  it('reads rows (BOM, CRLF, no header) and keeps fractions', () => {
    const d = buildProcurementYear(2026, csv(row(), row({ 3: '29.80', 6: 'Ｂ社', 7: '' }), row({ 6: 'Ａ社' })), codes);
    expect(d.rows.map(r => r[3])).toEqual([31389000, 29.8, 31389000]);
    // 同じ（名称・法人番号）の落札者は、表の同じ添字
    expect(d.vendors).toEqual([['Ａ社', '1111111111111'], ['Ｂ社', '']]);
    expect(d.rows.map(r => r[6])).toEqual([0, 1, 0]);
  });
  it('keeps names with commas and quotes inside quotation marks', () => {
    const d = buildProcurementYear(2026, csv(q('0000000000000000001', '調達,""引用""', '2026-04-01', '1.00', 'W1', '8004030', 'Ａ社', '')), codes);
    expect(d.rows[0]![1]).toBe('調達,"引用"');
  });
  it.each([
    ['列が 8 でない', csv('"1","x"')],
    ['調達案件番号が 19 桁', csv(row({ 0: '123' }))],
    ['調達案件名称が空', csv(row({ 1: '' }))],
    ['落札決定日が日付でない', csv(row({ 2: '2026-02-30' }))],
    ['ファイルの年度', csv(row({ 2: '2027-04-01' }))],
    ['落札価格の形', csv(row({ 3: '1,000' }))],
    ['府省コードが仕様書の表に無い', csv(row({ 4: 'ZZ' }))],
    ['入札方式コードが仕様書の表に無い', csv(row({ 5: '9999999' }))],
    ['商号又は名称が空', csv(row({ 6: '' }))],
    ['法人番号が 13 桁', csv(row({ 7: '123' }))],
  ])('stops on a row that breaks the rule: %s', (msg, text) => {
    expect(() => buildProcurementYear(2026, text, codes)).toThrow(msg);
  });
  it('accepts the first and last day of the 年度', () => {
    expect(buildProcurementYear(2026, csv(row({ 2: '2026-04-01' }), row({ 2: '2027-03-31' })), codes).rows).toHaveLength(2);
  });
});

describe('procurementDataset / buildProcurement', () => {
  const text = csv(row(), row({ 0: '0000000000000000002' }));
  const csvBuf = Buffer.from(text);
  const zip = makeZip('successful_bid_record_info_all_2026.csv', csvBuf);
  const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
  const dl = (over: Partial<ProcurementDownloadManifest['files'][number]> = {}): ProcurementDownloadManifest => ({
    retrievedAt: '2026-11-10T21:23:44+09:00',
    spec: { edition: '令和 8 年 10 月版' },
    files: [{ file: 'successful-bid-record/successful_bid_record_info_all_2026.zip', url: 'https://example.invalid/x', sha256: sha(zip), bytes: zip.length, csv: 'successful_bid_record_info_all_2026.csv', csvSha256: sha(csvBuf), csvBytes: csvBuf.length, rows: 2, ...over }],
  });

  describe('procurementDataset', () => {
    it('extracts the CSV unchanged and records the year, rows, and the source zip', () => {
      const { csvs, manifest } = procurementDataset(new Map([[2026, zip]]), dl());
      expect(csvs.get('successful_bid_record_info_all_2026.csv')!.equals(csvBuf)).toBe(true);
      expect(manifest.files['successful_bid_record_info_all_2026.csv']).toMatchObject({ sha256: sha(csvBuf), bytes: csvBuf.length, year: 2026, rows: 2, zip: { sha256: sha(zip), url: 'https://example.invalid/x' } });
      expect(manifest).toMatchObject({ schema: 'nihon-no-yosan/p-portal-manifest/v0', retrievedAt: '2026-11-10T21:23:44+09:00', spec: { edition: '令和 8 年 10 月版' } });
    });
    it('stops when a file differs from the download record, or a year is missing on either side', () => {
      expect(() => procurementDataset(new Map([[2026, zip]]), dl({ sha256: '0'.repeat(64) }))).toThrow('zip の SHA-256');
      expect(() => procurementDataset(new Map([[2026, zip]]), dl({ csvSha256: '0'.repeat(64) }))).toThrow('CSV の SHA-256');
      expect(() => procurementDataset(new Map([[2026, zip]]), dl({ rows: 3 }))).toThrow('行数');
      expect(() => procurementDataset(new Map([[2025, zip]]), dl())).toThrow('記録に無い年度');
      expect(() => procurementDataset(new Map(), dl())).toThrow('zip が無い');
    });
  });

  describe('buildProcurement', () => {
    const { csvs, manifest } = procurementDataset(new Map([[2026, zip]]), dl());
    const name = 'successful_bid_record_info_all_2026.csv';
    it('builds the years and the meta from the CSV, checking the manifest', () => {
      const b = buildProcurement(csvs, manifest, codes);
      expect(b.years).toHaveLength(1);
      expect(b.meta).toMatchObject({ years: [{ year: 2026, rows: 2, dateMin: '2026-04-01', dateMax: '2026-04-01' }], retrievedAt: '2026-11-10T21:23:44+09:00', specEdition: '令和 8 年 10 月版' });
    });
    it('stops when a CSV differs from the manifest, or a CSV is missing or extra', () => {
      const m = (patch: Partial<ProcurementManifest['files'][string]>): ProcurementManifest => ({ ...manifest, files: { [name]: { ...manifest.files[name]!, ...patch } } });
      expect(() => buildProcurement(new Map([[name, Buffer.from(`${text}x`)]]), manifest, codes)).toThrow('manifest と合わない');
      expect(() => buildProcurement(csvs, m({ rows: 3 }), codes)).toThrow('行数');
      expect(() => buildProcurement(csvs, m({ year: 2025 }), codes)).toThrow('名前と年度');
      expect(() => buildProcurement(new Map(), manifest, codes)).toThrow('CSV が無い');
      expect(() => buildProcurement(new Map([...csvs, ['other.csv', csvBuf]]), manifest, codes)).toThrow('manifest に無い CSV');
    });
  });
});
