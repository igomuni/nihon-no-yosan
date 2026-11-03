// ポスト5G 事業の 2-1・2-2 の生の行（2024・2025）
import { readFileSync } from 'node:fs';
import { parseCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/csv.ts';
const RS = '/Users/igomuni/orca/nihon-no-yosan/data/download/rs/2025/';
function csv(name: string) { const rows = parseCsv(readFileSync(RS + name, 'utf8').replace(/^﻿/, '')); const h = rows[0]!; return rows.slice(1).filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? '']))); }
const want = process.argv[2] ?? 'ポスト5G情報通信システム基盤強化研究開発事業';
const s22 = csv('2-2_RS_2025_予算・執行_予算種別・歳出予算項目.csv').filter(r => r['事業名']!.startsWith(want));
const ids = [...new Set(s22.map(r => r['予算事業ID']))]; console.log('ID', ids);
for (const r of s22.filter(r => +r['予算年度']! >= 2024)) console.log(r['予算年度'], r['会計区分'], r['会計'], r['勘定'], '|', r['予算種別'], '|', r['所管'], r['組織・勘定'], '|', r['項'], '|', r['目'], '|', (Number(r['予算額(歳出予算項目ごと)']) / 1e8).toFixed(1) + '億', '要求', (Number(r['翌年度要求額(歳出予算項目ごと)']) / 1e8).toFixed(1));
const s21 = csv('2-1_RS_2025_予算・執行_サマリ.csv').filter(r => ids.includes(r['予算事業ID']));
for (const r of s21.filter(r => +r['予算年度']! >= 2023)) console.log('2-1', r['予算年度'], r['会計区分'] || '(合計)', r['会計'], r['勘定'], '当初', r['当初予算(合計)'] || r['当初予算'], '補正', r['補正予算(合計)'] || r['第1次補正予算'], '繰越', r['前年度からの繰越し(合計)'] || r['前年度から繰越し'], '現額', r['計(歳出予算現額合計)'] || r['歳出予算現額'], '執行', r['執行額(合計)'] || r['執行額']);
