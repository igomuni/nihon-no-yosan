// 集計の続きと検算
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/csv.ts';
const DIR = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t5-ai/';
const RS = '/Users/igomuni/orca/nihon-no-yosan/data/download/rs/2025/';
const s = JSON.parse(readFileSync(DIR + 's1.json', 'utf8'));
const rs = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/rs/jigyo.json.gz')).toString());
const AI = /(?<![A-Za-zＡ-Ｚａ-ｚ])(AI|ＡＩ)(?![A-Za-zＡ-Ｚａ-ｚ])/, J = /人工知能/;
const oku = (y: number | null) => y === null ? null : Math.round(y / 1e6) / 100; // 円→億円（小数 2 桁）
// 検算 1: jigyo.json の事業名（2-1 由来）で数え直す
const nameAI = rs.jigyo.filter((j: any) => AI.test(j[1])).length, nameJ = rs.jigyo.filter((j: any) => J.test(j[1])).length;
console.log('検算1 jigyo.json の事業名: AI', nameAI, '人工知能', nameJ, '（1-2 では 36 / 3）');
// 検算 2: 2025 年度の当初予算の合計を、2-1 の生の合計行から
const rows = parseCsv(readFileSync(RS + '2-1_RS_2025_予算・執行_サマリ.csv', 'utf8').replace(/^﻿/, '')); const h = rows[0]!;
const col = (n: string) => h.indexOf(n);
const nameIds = new Set(s.hits.filter((x: any) => x.cls === 'name').map((x: any) => x.id));
let init = 0, cur = 0, n = 0;
for (const r of rows.slice(1)) { if (r.length < 2 || !nameIds.has(r[col('予算事業ID')]) || r[col('予算年度')] !== '2025' || r[col('会計区分')] !== '') continue; n++; init += Number(r[col('当初予算(合計)')] || 0); cur += Number(r[col('計(歳出予算現額合計)')] || 0); }
console.log('検算2 2-1 の合計行 2025: 事業', n, '当初', oku(init), '億 現額', oku(cur), '億（s1:', oku(s.summary.years[2025].name.initial), oku(s.summary.years[2025].name.current), ')');
// 2025 の名前の事業: 府省・当初 0・つなぎ
const d25 = s.detail.filter((x: any) => x.cls === 'name' && x.year === 2025);
const byMin: Record<string, any> = {};
for (const x of d25) { const m = (byMin[x.min] ??= { n: 0, init: 0, cur: 0, zeroInit: 0, linked: 0 }); m.n++; m.init += x.initial ?? 0; m.cur += x.current ?? 0; if ((x.initial ?? 0) === 0) m.zeroInit++; if (x.kous.length) m.linked++; }
console.log('府省別（2025、名前）', JSON.stringify(Object.entries(byMin).sort((a: any, b: any) => b[1].n - a[1].n).map(([k, v]: any) => [k, v.n, oku(v.init), oku(v.cur), v.zeroInit, v.linked])));
console.log('2025 名前の事業: 当初 0', d25.filter((x: any) => (x.initial ?? 0) === 0).length, 'うち現額 > 0', d25.filter((x: any) => (x.initial ?? 0) === 0 && (x.current ?? 0) > 0).length, '/ 項に結べた', d25.filter((x: any) => x.kous.length).length, '/ 人工知能の項', d25.filter((x: any) => x.kous.some((k: any) => k.jinko)).length, '/ 人工知能の目', d25.filter((x: any) => x.mokuJinko).length);
const post5g = d25.find((x: any) => x.name.startsWith('ポスト5G'));
console.log('ポスト5G 2025 当初', oku(post5g.initial), '全体に占める', (post5g.initial / s.summary.years[2025].name.initial * 100).toFixed(1) + '%');
// 結べた項の名前（2025、名前の事業）: どんな項に入っているか
const kc: Record<string, number> = {}; for (const x of d25) for (const k of x.kous) kc[k.name] = (kc[k.name] ?? 0) + 1;
console.log('結べた項', JSON.stringify(Object.entries(kc).sort((a, b) => b[1] - a[1])));
// 概要だけに AI がある事業（2025）上位
const t25 = s.detail.filter((x: any) => x.cls === 'text' && x.year === 2025).sort((a: any, b: any) => (b.initial ?? 0) - (a.initial ?? 0));
console.log('概要だけ 2025 上位', t25.slice(0, 8).map((x: any) => `${x.min} ${x.name.slice(0, 30)} ${oku(x.initial)}`).join(' / '));
console.log('概要だけ 2025 府省', JSON.stringify(Object.entries(t25.reduce((m: any, x: any) => (m[x.min] = (m[x.min] ?? 0) + 1, m), {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8)));
// 年度別（名前）
console.log('年度別 名前の事業数', [2021, 2022, 2023, 2024, 2025].map(y => `${y}:${s.summary.years[y].name.n} 当初${oku(s.summary.years[y].name.initial)} 現額${oku(s.summary.years[y].name.current)} 2-2行${s.summary.years[y].name.rows22} 項空欄${s.summary.years[y].name.rowsBlank}`).join(' | '));
writeFileSync(DIR + 's3.json', JSON.stringify({ byMin, d25, t25: t25.slice(0, 15), kc }));
