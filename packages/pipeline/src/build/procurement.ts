/**
 * 調達ポータルの落札実績（全件データの CSV）から、画面用の年度ごとのデータを作る。仕様: docs/guides/procurement.md
 *
 * 原本: `data/download/p-portal/successful-bid-record/successful_bid_record_info_all_{年度}.zip`（zip 1 つに CSV 1 つ。UTF-8 の BOM つき、ヘッダ行なし、全項目を引用符で囲む。列は仕様書 2.2）。
 * データセット（`p-portal-v0`。`data/dataset/p-portal-v0/`）: zip を展開した CSV（手を加えない）と `manifest.json`。`procurementDataset` が zip から作り、`buildProcurement` が画面用のデータにする。
 * 全行を検査し、合わない行があれば止まる（捨てない・直さない）:
 *   8 列 / 調達案件番号 19 桁の数字 / 案件名・落札者が空でない / 落札決定日が日付で、ファイルの年度（4 月〜翌 3 月）に入る /
 *   落札価格が数字（小数 2 桁まで）で、数に直して書き戻すと同じ文字になる / 府省コード・入札方式コードが仕様書の表にある / 法人番号が空か 13 桁の数字。
 */
import { createHash } from 'node:crypto';
import * as zlib from 'node:zlib';
import { parseCsv, type ProcurementMeta, type ProcurementRow, type ProcurementYearData } from '@nihon-no-yosan/core';
import type { ProcurementCodeTables } from './procurement-codes.ts';

/** zip（ファイルが 1 つだけのもの）から、中身を取り出す。圧縮方式は deflate（8）か無圧縮（0）。大きさと CRC-32 を照合する。zip64・暗号化・複数ファイルは止まる */
export function readSingleZip(zip: Buffer): { name: string; data: Buffer } {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip の末尾の記録が見つからない');
  const entries = zip.readUInt16LE(eocd + 10);
  if (entries !== 1) throw new Error(`zip のファイル数が 1 でない: ${entries}`);
  const cd = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip の目録の形が合わない');
  const flags = zip.readUInt16LE(cd + 8);
  const method = zip.readUInt16LE(cd + 10);
  const crc = zip.readUInt32LE(cd + 16);
  const csize = zip.readUInt32LE(cd + 20);
  const usize = zip.readUInt32LE(cd + 24);
  const nameLen = zip.readUInt16LE(cd + 28);
  const local = zip.readUInt32LE(cd + 42);
  if (flags & 1) throw new Error('暗号化された zip は読まない');
  if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw new Error('zip64 は読まない');
  const name = zip.subarray(cd + 46, cd + 46 + nameLen).toString('utf8');
  if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error('zip の先頭の記録の形が合わない');
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const body = zip.subarray(start, start + csize);
  if (method !== 0 && method !== 8) throw new Error(`zip の圧縮方式が読めない: ${method}`);
  const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
  if (data.length !== usize) throw new Error(`zip の中身の大きさが合わない: ${data.length} / ${usize}`);
  if (zlib.crc32(data) !== crc) throw new Error('zip の中身の CRC-32 が合わない');
  return { name, data };
}

/** 年度のファイルの CSV から、年度のデータを作る。`year` は原本のファイルの年度 */
export function buildProcurementYear(year: number, csvText: string, codes: Pick<ProcurementCodeTables, 'ministries' | 'methods'>): ProcurementYearData {
  const ministries = new Set(codes.ministries.map(([c]) => c));
  const methods = new Set(codes.methods.map(([c]) => c));
  const lines = parseCsv(csvText.replace(/^\uFEFF/, ''));
  const from = `${year}-04-01`, to = `${year + 1}-03-31`;
  const vendorIdx = new Map<string, number>();
  const vendors: [string, string][] = [];
  const rows: ProcurementRow[] = [];
  lines.forEach((r, n) => {
    const where = `${year} 年度 ${n + 1} 行目`;
    if (r.length === 1 && r[0] === '') return; // 末尾の空行
    if (r.length !== 8) throw new Error(`${where}: 列が 8 でない: ${r.length}`);
    const [caseNo, name, date, price, ministry, method, vendorName, corp] = r as [string, string, string, string, string, string, string, string];
    if (!/^\d{19}$/.test(caseNo)) throw new Error(`${where}: 調達案件番号が 19 桁の数字でない: 「${caseNo}」`);
    if (name === '') throw new Error(`${where}: 調達案件名称が空`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`${where}: 落札決定日が日付でない: 「${date}」`);
    if (date < from || date > to) throw new Error(`${where}: 落札決定日がファイルの年度（${from}〜${to}）に入らない: ${date}`);
    if (!/^\d{1,17}(\.\d{1,2})?$/.test(price)) throw new Error(`${where}: 落札価格の形が合わない: 「${price}」`);
    const yen = Number(price);
    const [int = '', frac = ''] = price.split('.');
    if (yen.toFixed(2) !== `${int.replace(/^0+(?=\d)/, '')}.${frac.padEnd(2, '0')}`) throw new Error(`${where}: 落札価格が、数に直すと同じ値にならない: 「${price}」`);
    if (!ministries.has(ministry)) throw new Error(`${where}: 府省コードが仕様書の表に無い: 「${ministry}」`);
    if (!methods.has(method)) throw new Error(`${where}: 入札方式コードが仕様書の表に無い: 「${method}」`);
    if (vendorName === '') throw new Error(`${where}: 商号又は名称が空`);
    if (corp !== '' && !/^\d{13}$/.test(corp)) throw new Error(`${where}: 法人番号が 13 桁の数字でも空でもない: 「${corp}」`);
    const key = `${vendorName}\t${corp}`;
    let v = vendorIdx.get(key);
    if (v === undefined) { v = vendors.length; vendors.push([vendorName, corp]); vendorIdx.set(key, v); }
    rows.push([caseNo, name, date, yen, ministry, method, v]);
  });
  return { year, vendors, rows };
}

/** 取り込みの記録（`data/download/p-portal/manifest.json` のうち、ここで使う部分） */
export interface ProcurementDownloadManifest {
  retrievedAt: string;
  spec: { edition: string; file?: string; url?: string; bytes?: number; sha256?: string };
  files: { file: string; url: string; sha256: string; bytes: number; csv: string; csvSha256: string; csvBytes: number; rows: number }[];
}

/** データセットの CSV の名前 */
export const procurementCsvName = (year: number): string => `successful_bid_record_info_all_${year}.csv`;

/** データセットの manifest（`datasets/p-portal-v0/manifest.json`）。`verify.ts` が読む `files` の `sha256`・`bytes` のほかに、年度・行数・元の zip の記録を持つ */
export interface ProcurementManifest {
  schema: 'nihon-no-yosan/p-portal-manifest/v0';
  note: string;
  source: { page: string; terms: string };
  retrievedAt: string;
  spec: { edition: string; file?: string; url?: string; bytes?: number; sha256?: string };
  files: Record<string, { sha256: string; bytes: number; year: number; rows: number; zip: { file: string; url: string; sha256: string; bytes: number } }>;
}

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

/** CSV の行数（引用符の中の改行を数えない。末尾の空行は数えない） */
const csvRows = (csv: Buffer): number => parseCsv(csv.toString('utf8').replace(/^\uFEFF/, '')).filter(r => !(r.length === 1 && r[0] === '')).length;

/**
 * 取り込んだ zip（年度 → zip）から、データセット（CSV と manifest）を作る。CSV は zip の中身そのまま。
 * zip・CSV の SHA-256 と行数を、取り込みの記録（`manifest.json`）と照合し、合わなければ止まる。年度が記録と食い違っても止まる。
 */
export function procurementDataset(zips: ReadonlyMap<number, Buffer>, dl: ProcurementDownloadManifest): { csvs: Map<string, Buffer>; manifest: ProcurementManifest } {
  const byYear = new Map(dl.files.map(f => [Number(/_all_(\d{4})\.zip$/.exec(f.file)?.[1]), f] as const));
  for (const y of zips.keys()) if (!byYear.has(y)) throw new Error(`取り込みの記録に無い年度の zip: ${y}`);
  for (const y of byYear.keys()) if (!zips.has(y)) throw new Error(`取り込みの記録にある年度の zip が無い: ${y}`);
  const csvs = new Map<string, Buffer>();
  const files: ProcurementManifest['files'] = {};
  for (const year of [...zips.keys()].sort((a, b) => a - b)) {
    const zip = zips.get(year)!;
    const rec = byYear.get(year)!;
    if (sha256(zip) !== rec.sha256) throw new Error(`${year} 年度の zip の SHA-256 が、取り込みの記録と合わない（取り込んだ後に変わった）`);
    const { data } = readSingleZip(zip);
    if (sha256(data) !== rec.csvSha256) throw new Error(`${year} 年度の CSV の SHA-256 が、取り込みの記録と合わない`);
    const rows = csvRows(data);
    if (rows !== rec.rows) throw new Error(`${year} 年度の行数が、取り込みの記録と合わない: ${rows} / ${rec.rows}`);
    const name = procurementCsvName(year);
    csvs.set(name, data);
    files[name] = { sha256: sha256(data), bytes: data.length, year, rows, zip: { file: rec.file, url: rec.url, sha256: rec.sha256, bytes: rec.bytes } };
  }
  return {
    csvs,
    manifest: {
      schema: 'nihon-no-yosan/p-portal-manifest/v0',
      note: '調達ポータル（デジタル庁）の「落札実績オープンデータ」の全件データ（CSV）。サイトの配布物の zip を展開した CSV を、手を加えずに入れた（zip の SHA-256 は files の zip に記録）。ヘッダ行はない（列は仕様書 2.2）。出典: 調達ポータル（https://www.p-portal.go.jp/）。利用条件: 調達ポータルの「ご利用にあたって」（政府標準利用規約 第 2.0 版に準拠。CC BY 4.0 と互換）。',
      source: { page: 'https://www.p-portal.go.jp/pps-web-biz/UAB02/OAB0201', terms: 'https://www.p-portal.go.jp/pps-web-biz/resources/app/html/sitepolicy.html' },
      retrievedAt: dl.retrievedAt,
      spec: dl.spec,
      files,
    },
  };
}

export interface ProcurementBuild {
  meta: ProcurementMeta;
  years: ProcurementYearData[];
}

/**
 * データセット（CSV と manifest）から、全年度の画面用のデータを作る。CSV の SHA-256・バイト数・行数を manifest と照合し、合わなければ止まる。
 * manifest にあるのに CSV が無い年度、manifest に無い CSV があっても止まる。
 */
export function buildProcurement(csvs: ReadonlyMap<string, Buffer>, manifest: ProcurementManifest, codes: ProcurementCodeTables): ProcurementBuild {
  for (const name of csvs.keys()) if (!manifest.files[name]) throw new Error(`manifest に無い CSV: ${name}`);
  for (const name of Object.keys(manifest.files)) if (!csvs.has(name)) throw new Error(`manifest にある CSV が無い: ${name}`);
  const years: ProcurementYearData[] = [];
  for (const [name, rec] of Object.entries(manifest.files).sort((a, b) => a[1].year - b[1].year)) {
    const csv = csvs.get(name)!;
    if (name !== procurementCsvName(rec.year)) throw new Error(`CSV の名前と年度が合わない: ${name} / ${rec.year}`);
    if (csv.length !== rec.bytes || sha256(csv) !== rec.sha256) throw new Error(`${rec.year} 年度の CSV が、manifest と合わない（SHA-256・バイト数）`);
    const built = buildProcurementYear(rec.year, csv.toString('utf8'), codes);
    if (built.rows.length !== rec.rows) throw new Error(`${rec.year} 年度の行数が、manifest と合わない: ${built.rows.length} / ${rec.rows}`);
    years.push(built);
  }
  return {
    meta: {
      years: years.map(d => ({ year: d.year, rows: d.rows.length, dateMin: d.rows.reduce((m, r) => (r[2] < m ? r[2] : m), d.rows[0]?.[2] ?? ''), dateMax: d.rows.reduce((m, r) => (r[2] > m ? r[2] : m), '') })),
      ministries: codes.ministries,
      methods: codes.methods,
      retrievedAt: manifest.retrievedAt,
      specEdition: codes.edition,
    },
    years,
  };
}
