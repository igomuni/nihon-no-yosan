/**
 * 概算要求の事項と予算書の事項の、名前でのつながりを測って JSON で出力する。仕様: docs/guides/request-jikou-pairing.md
 *
 * 使い方: node packages/pipeline/src/build/request-jikou-pairing-cli.ts <build:data の出力ディレクトリ> <出力 JSON>
 * 入力: `mof/detail.json.gz`（概算要求と当初予算の差の事項・目）、`trend/jikou.json.gz`（事項要求の記載）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { requestJikouPairing, type BudgetRequestJikouData, type BudgetRequestMofDetailData } from '@nihon-no-yosan/core';

const [dataDir, outFile] = process.argv.slice(2);
if (!dataDir || !outFile) throw new Error('usage: request-jikou-pairing-cli.ts <dataDir> <out.json>');

const readGz = <T>(name: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dataDir, name))).toString('utf8')) as T;
const detail = readGz<BudgetRequestMofDetailData>('mof/detail.json.gz');
const jikou = readGz<BudgetRequestJikouData>('trend/jikou.json.gz');
const years = requestJikouPairing(detail.rows, jikou);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ years }, null, 1) + '\n');
for (const y of years) console.log(`FY${y.year}: 要求側 ${y.request}、予算書側 ${y.budget}、両側 ${y.both}`);
