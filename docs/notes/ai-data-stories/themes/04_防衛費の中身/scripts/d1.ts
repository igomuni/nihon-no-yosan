// 防衛関係費（主要経費別 35）を、使途別・項・目・所管で分ける。一般会計の当初（政府案）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codesOfMoku, codeNameOf, mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), m = rd('moku.json.gz'), codes = rd('codes.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any) => [k.id, k]));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const t = (x?: number) => (x === undefined ? '  -  ' : (x / 1e9).toFixed(3)); // 千円 → 兆円
const add = (mp: Map<string, Record<number, number>>, key: string, y: number, v: number) => { const r = mp.get(key) ?? mp.set(key, {}).get(key)!; r[y] = (r[y] ?? 0) + v; };
const byUse = new Map(), byKou = new Map(), byMin = new Map(), byMoku = new Map(), tot: Record<number, number> = {};
const names = new Set<string>();
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:') || !Y.includes(n[1])) continue;
  const c = codesOfMoku(n[3], 'general'); if (c.major !== '35') continue;
  const v = mokuValue(n, 'budget'); if (v === null) continue;
  const k = kouById.get(id);
  tot[n[1]] = (tot[n[1]] ?? 0) + v;
  add(byUse, `${c.use}:${codeNameOf(codes, 'use', c.use, n[1], 'general')?.name ?? '?'}`, n[1], v);
  add(byKou, `${k?.ministry}|${k?.name}`, n[1], v);
  add(byMin, k?.ministry ?? '?', n[1], v);
  add(byMoku, n[2], n[1], v);
  names.add(codeNameOf(codes, 'major', '35', n[1], 'general')?.name ?? '?');
}
console.log('35 の名前', [...names]);
console.log('防衛関係費 合計', Y.map(y => `${y}:${t(tot[y])}`).join(' '));
const show = (lab: string, mp: Map<string, Record<number, number>>, n = 99) => { console.log('\n==', lab); [...mp].sort((a, b) => ((b[1][2026] ?? 0) - (b[1][2017] ?? 0)) - ((a[1][2026] ?? 0) - (a[1][2017] ?? 0))).slice(0, n).forEach(([k, r]) => console.log(k.slice(0, 40).padEnd(30), Y.map(y => t(r[y])).join(' '), ' Δ', t((r[2026] ?? 0) - (r[2017] ?? 0)))); };
show('使途別', byUse); show('所管', byMin); show('項（増）', byKou, 15);
console.log('\n== 項（減）'); [...byKou].sort((a, b) => ((a[1][2026] ?? 0) - (a[1][2017] ?? 0)) - ((b[1][2026] ?? 0) - (b[1][2017] ?? 0))).slice(0, 8).forEach(([k, r]) => console.log(k.padEnd(30), Y.map(y => t(r[y])).join(' ')));
show('目（増）', byMoku, 20);
console.log('\n== 目（減）'); [...byMoku].sort((a, b) => ((a[1][2026] ?? 0) - (a[1][2017] ?? 0)) - ((b[1][2026] ?? 0) - (b[1][2017] ?? 0))).slice(0, 10).forEach(([k, r]) => console.log(k.padEnd(30), Y.map(y => t(r[y])).join(' ')));
writeFileSync(process.argv[2] ?? '/dev/null', JSON.stringify({ Y, tot, byUse: [...byUse], byKou: [...byKou], byMin: [...byMin], byMoku: [...byMoku] }));
