import { readFileSync } from 'node:fs';
import { parseCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/csv.ts';
const s = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t5-ai/s1.json', 'utf8'));
const ids = new Set(s.hits.filter((x: any) => x.cls === 'name').map((x: any) => x.id));
const rows = parseCsv(readFileSync('/Users/igomuni/orca/nihon-no-yosan/data/download/rs/2025/2-1_RS_2025_予算・執行_サマリ.csv', 'utf8').replace(/^﻿/, '')); const h = rows[0]!; const c = (n: string) => h.indexOf(n);
const cnt = new Map<string, string[][]>(); for (const r of rows.slice(1)) if (ids.has(r[c('予算事業ID')]) && r[c('予算年度')] === '2025' && r[c('会計区分')] === '') (cnt.get(r[c('予算事業ID')]) ?? cnt.set(r[c('予算事業ID')], []).get(r[c('予算事業ID')])!).push(r);
console.log('名前の事業', ids.size, '2025 合計行のある事業', cnt.size); for (const [id, rs] of cnt) if (rs.length > 1) console.log('重複', id, rs.map(r => [r[c('シート種別')], r[c('事業名')].slice(0, 30), r[c('当初予算(合計)')]].join(' ')));
