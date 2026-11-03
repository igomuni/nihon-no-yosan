// テーマ 5: RS の「AI」「人工知能」事業の抽出と、予算書の項・目へのつなぎ
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/csv.ts';
const RS = '/Users/igomuni/orca/nihon-no-yosan/data/download/rs/2025/';
const PUB = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/';
const OUT = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t5-ai/';
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(PUB + f)).toString());
function csv(name: string): Record<string, string>[] {
  const rows = parseCsv(readFileSync(RS + name, 'utf8').replace(/^﻿/, ''));
  const h = rows[0]!;
  return rows.slice(1).filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
// 前後がラテン文字でない「AI」「ＡＩ」（MAIL・TRAINING などを除く）
const AI = /(?<![A-Za-zＡ-Ｚａ-ｚ])(AI|ＡＩ)(?![A-Za-zＡ-Ｚａ-ｚ])/;
const JINKO = /人工知能/;
const hit = (s: string) => ({ ai: AI.test(s), jinko: JINKO.test(s) });

const s12 = csv('1-2_RS_2025_基本情報_事業概要等.csv');
console.log('1-2 行', s12.length, '事業ID', new Set(s12.map(r => r['予算事業ID'])).size);
type J = { id: string; name: string; min: string; nameAI: boolean; nameJinko: boolean; textAI: boolean; textJinko: boolean; aiWords: string[] };
const byId = new Map<string, J>();
for (const r of s12) {
  const id = r['予算事業ID']!; const name = r['事業名']!;
  const text = [r['事業の目的'], r['現状・課題'], r['事業の概要']].join('\n');
  const n = hit(name), t = hit(text);
  const j = byId.get(id) ?? { id, name, min: r['府省庁']!, nameAI: false, nameJinko: false, textAI: false, textJinko: false, aiWords: [] };
  j.nameAI ||= n.ai; j.nameJinko ||= n.jinko; j.textAI ||= t.ai; j.textJinko ||= t.jinko;
  for (const m of name.matchAll(/[^\s、。（）()「」・]{0,6}(?<![A-Za-z])(?:AI|ＡＩ)(?![A-Za-z])[^\s、。（）()「」・]{0,6}/g)) j.aiWords.push(m[0]);
  byId.set(id, j);
}
const all = [...byId.values()];
const cls = (j: J) => (j.nameAI || j.nameJinko ? 'name' : j.textAI || j.textJinko ? 'text' : null);
const hits = all.filter(j => cls(j));
console.log('事業（1-2 の予算事業 ID）', all.length);
console.log('名前に AI', all.filter(j => j.nameAI).length, '名前に 人工知能', all.filter(j => j.nameJinko).length, '名前に両方', all.filter(j => j.nameAI && j.nameJinko).length);
console.log('名前には無く、目的・現状・概要に AI', all.filter(j => !j.nameAI && !j.nameJinko && j.textAI).length, '同 人工知能', all.filter(j => !j.nameAI && !j.nameJinko && j.textJinko).length, '同 どちらか', all.filter(j => cls(j) === 'text').length);
console.log('名前の AI の例', all.filter(j => j.nameAI).slice(0, 12).map(j => j.name).join(' / '));
console.log('名前の 人工知能', all.filter(j => j.nameJinko).map(j => j.name).join(' / '));

// RS の額（2-1 の合計の行。jigyo.json）とつなぎ（2-2 の linked 行）
const rs = gz('rs/jigyo.json.gz');
const idx = new Map<string, number>(rs.jigyo.map((j: any, i: number) => [j[0], i]));
const amt = new Map<string, any>(); for (const a of rs.amounts) amt.set(`${a[0]}|${a[1]}`, a);
const links = new Map<string, any[]>(); for (const l of rs.links) { const k = `${l[0]}|${l[1]}`; (links.get(k) ?? links.set(k, []).get(k)!).push(l); }
const lc = gz('lifecycle/data.json.gz'), mk = gz('lifecycle/moku.json.gz'), jk = gz('lifecycle/jikou.json.gz');
const kouById = new Map<string, any>(lc.kous.map((k: any) => [k.id, k]));

// 2-2 の生の行（AI・人工知能の事業だけ）: 項の空欄・つなぎ
const s22 = csv('2-2_RS_2025_予算・執行_予算種別・歳出予算項目.csv');
const hitIds = new Set(hits.map(j => j.id));
const raw22 = s22.filter(r => hitIds.has(r['予算事業ID']!));

const summary: any = { years: {} };
for (const y of [2021, 2022, 2023, 2024, 2025]) {
  for (const group of ['name', 'text'] as const) {
    const js = hits.filter(j => cls(j) === group);
    let n = 0, withAmt = 0, initial = 0, current = 0, linked = 0, rows22 = 0, rowsBlank = 0, rowsLinked = 0;
    for (const j of js) {
      const i = idx.get(j.id); if (i === undefined) continue;
      const a = amt.get(`${i}|${y}`); if (!a) continue; n++;
      if (a[2] !== null) { withAmt++; initial += a[2]; } if (a[6] !== null) current += a[6];
      if ((links.get(`${i}|${y}`) ?? []).length > 0) linked++;
    }
    for (const r of raw22) { if (+r['予算年度']! !== y || cls(byId.get(r['予算事業ID']!)!) !== group) continue; rows22++; if (!r['項']) rowsBlank++; }
    for (const j of js) { const i = idx.get(j.id); if (i === undefined) continue; rowsLinked += (links.get(`${i}|${y}`) ?? []).length; }
    (summary.years[y] ??= {})[group] = { n, withAmt, initial, current, linked, rows22, rowsBlank, rowsLinked };
  }
}
console.log(JSON.stringify(summary.years, null, 0));

// 2025 年度: 名前に AI/人工知能 の事業 → 結べた項・目
const detail: any[] = [];
for (const j of hits) {
  const i = idx.get(j.id); if (i === undefined) continue;
  for (const y of [2024, 2025]) {
    const a = amt.get(`${i}|${y}`); const ls = links.get(`${i}|${y}`) ?? [];
    const kous = [...new Set(ls.map((l: any) => rs.kous[l[2]]))].map(id => kouById.get(id)).filter(Boolean);
    detail.push({ id: j.id, name: j.name, min: j.min, cls: cls(j), nameAI: j.nameAI, nameJinko: j.nameJinko, year: y, initial: a?.[2] ?? null, current: a?.[6] ?? null,
      kous: kous.map((k: any) => ({ id: k.id, name: k.name, ministry: k.ministry, jinko: JINKO.test(k.name) })),
      mokus: [...new Set(ls.map((l: any) => l[3]).filter(Boolean))], mokuJinko: ls.some((l: any) => JINKO.test(l[3])) });
  }
}
// 予算書の側: 人工知能を名前に含む 項・事項・目（FY2017〜FY2027）
const kouJ = lc.kous.filter((k: any) => JINKO.test(k.name)).map((k: any) => ({ id: k.id, year: k.year, name: k.name, ministry: k.ministry, account: k.account }));
const mokuJ = mk.nodes.filter((n: any) => JINKO.test(n[2])).map((n: any) => ({ kou: mk.kous[n[0]], year: n[1], name: n[2], budget: n[5], request: n[12] }));
const jikouJ = jk.data ? [] : jk.nodes.filter((n: any) => JINKO.test(n[2])).map((n: any) => ({ kou: jk.kous[n[0]], year: n[1], name: n[2], budget: n[3], request: n[7] }));
console.log('予算書 人工知能: 項', kouJ.length, '目', mokuJ.length, '事項', jikouJ.length);
// RS: 人工知能の項に結べた事業（2024・2025）
const kouIdxJ = new Set(rs.kous.map((id: string, i: number) => [id, i]).filter(([id]: any) => JINKO.test(kouById.get(id)?.name ?? '')).map(([, i]: any) => i));
const rsOnJ = new Map<string, any>();
for (const l of rs.links) { if (!kouIdxJ.has(l[2])) continue; const j = rs.jigyo[l[0]]; const key = `${j[0]}|${l[1]}`; const e = rsOnJ.get(key) ?? rsOnJ.set(key, { id: j[0], name: j[1], min: j[2], year: l[1], kou: kouById.get(rs.kous[l[2]])?.name, yen: 0, mokus: new Set() }).get(key)!; e.yen += l[5] ?? 0; e.mokus.add(l[3]); }
const rsOnJList = [...rsOnJ.values()].map(e => ({ ...e, mokus: [...e.mokus], nameAI: AI.test(e.name) || JINKO.test(e.name) }));
console.log('人工知能の項に結べた RS 事業（年度×事業）', rsOnJList.length, rsOnJList.map(e => `${e.year} ${e.name} [${e.kou}] ${(e.yen / 1e8).toFixed(1)}億`).join('\n  '));
writeFileSync(OUT + 's1.json', JSON.stringify({ summary, detail, kouJ, mokuJ, jikouJ, rsOnJList, hits: hits.map(j => ({ ...j, cls: cls(j) })) }, null, 0));
