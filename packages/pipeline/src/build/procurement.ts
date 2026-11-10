/**
 * 調達ポータルの落札実績（全件データの CSV）から、画面用の年度ごとのデータを作る。仕様: docs/guides/procurement.md
 *
 * 原本: `data/download/p-portal/successful-bid-record/successful_bid_record_info_all_{年度}.zip`（zip 1 つに CSV 1 つ。UTF-8 の BOM つき、ヘッダ行なし、全項目を引用符で囲む。列は仕様書 2.2）。
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
  spec: { edition: string };
  files: { file: string; sha256: string; bytes: number; csvSha256: string; rows: number }[];
}

export interface ProcurementBuild {
  meta: ProcurementMeta;
  years: ProcurementYearData[];
}

/**
 * 全年度を作る。`zips` は、年度 → zip のバイト列。manifest の SHA-256・行数と照合し、合わなければ止まる（取り込んだ後に原本が変わっていないことの確認）。
 * 年度のファイルが manifest に無い、または manifest にあるのに渡されていなければ止まる。
 */
export function buildProcurement(zips: ReadonlyMap<number, Buffer>, manifest: ProcurementDownloadManifest, codes: ProcurementCodeTables): ProcurementBuild {
  const years: ProcurementYearData[] = [];
  const byYear = new Map(manifest.files.map(f => [Number(/_all_(\d{4})\.zip$/.exec(f.file)?.[1]), f] as const));
  for (const y of zips.keys()) if (!byYear.has(y)) throw new Error(`manifest に無い年度の zip: ${y}`);
  for (const y of byYear.keys()) if (!zips.has(y)) throw new Error(`manifest にある年度の zip が無い: ${y}`);
  for (const year of [...zips.keys()].sort((a, b) => a - b)) {
    const zip = zips.get(year)!;
    const rec = byYear.get(year)!;
    const sha = createHash('sha256').update(zip).digest('hex');
    if (sha !== rec.sha256) throw new Error(`${year} 年度の zip の SHA-256 が、manifest と合わない（取り込んだ後に変わった）: ${sha}`);
    const { data } = readSingleZip(zip);
    const csvSha = createHash('sha256').update(data).digest('hex');
    if (csvSha !== rec.csvSha256) throw new Error(`${year} 年度の CSV の SHA-256 が、manifest と合わない: ${csvSha}`);
    const built = buildProcurementYear(year, data.toString('utf8'), codes);
    if (built.rows.length !== rec.rows) throw new Error(`${year} 年度の行数が、manifest と合わない: ${built.rows.length} / ${rec.rows}`);
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
