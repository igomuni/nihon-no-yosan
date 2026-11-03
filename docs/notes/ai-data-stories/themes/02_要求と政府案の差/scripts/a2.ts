// 検算: 総表（total-table）の「所管計」と、項の要求額の合計（要求所管別）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { readCsv, publisherOf } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const OUT = '/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t2-request/';
const BR = '/Users/igomuni/orca/nihon-no-yosan/data/dataset/reference-v0/budget-request/';
const a1 = JSON.parse(readFileSync(OUT + 'a1.json', 'utf8'));
const num = (s: string) => { const t = (s ?? '').replace(/[,\s]/g, '').replace(/^△/, '-'); return t === '' || !/^-?\d+$/.test(t) ? null : Number(t); };
const res: any = {};
for (const y of [2023, 2024, 2025, 2026, 2027]) {
  const dir = BR + y + '/total-table/sources/';
  const per = new Map<string, { files: number; total: number; rows: number }>();
  for (const f of readdirSync(dir)) {
    const recs = readCsv(readFileSync(dir + f, "utf8"));
    const col = Object.keys(recs[0] ?? {}).find(k => /概算要求額_計$/.test(k));
    if (!col) continue;
    const pub = publisherOf('https://' + f.split('__')[0]);
    const tot = recs.filter(r => (r['区分'] ?? '').replace(/\s/g, '') === '所管計');
    const p = per.get(pub) ?? per.set(pub, { files: 0, total: 0, rows: 0 }).get(pub)!;
    p.files++; for (const r of tot) { const v = num(r[col]!); if (v !== null) { p.total += v; p.rows++; } }
  }
  // 項の要求額（一般会計・特別会計）を要求所管別に（千円）
  const kou = new Map<string, number>();
  for (const r of a1.rows) if (r.year === y && r.req !== undefined) { const p = r.pubs.length === 1 ? r.pubs[0] : r.pubs.join('|') || '(なし)'; kou.set(p + '|' + r.account, (kou.get(p + '|' + r.account) ?? 0) + r.req / 1000); }
  res[y] = { per: [...per], kou: [...kou] };
  console.log(`\n== ${y}`);
  for (const [p, v] of [...per].sort((a, b) => b[1].total - a[1].total).slice(0, 12)) {
    const g = kou.get(p + '|general') ?? 0, s = kou.get(p + '|special') ?? 0;
    console.log(p.padEnd(10), '総表 所管計', (v.total / 1e9).toFixed(3), `(${v.rows}行/${v.files}ファイル)`, ' 項の要求 一般', (g / 1e9).toFixed(3), '特別', (s / 1e9).toFixed(3));
  }
}
writeFileSync(OUT + 'a2.json', JSON.stringify(res));
