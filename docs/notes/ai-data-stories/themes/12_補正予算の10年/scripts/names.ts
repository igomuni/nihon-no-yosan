// 主要経費別のコード名（年度ごと、当初予算のコード表。無い年度は近い年度: codeNameOf）と、府省の分け方（PUBLISHER_NAMES）を書き出す
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { codeNameOf, PUBLISHER_NAMES } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const codes = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/codes.json.gz')).toString());
const all = new Set<string>(); for (const p of codes.pages) for (const [c] of p.major) all.add(c);
const out: Record<number, Record<string, { name: string; approx: boolean }>> = {};
for (let y = 2017; y <= 2026; y++) { out[y] = {}; for (const c of all) { const n = codeNameOf(codes, 'major', c, y, 'general'); if (n) out[y][c] = n; } }
writeFileSync('names.json', JSON.stringify({ major: out, publishers: [...PUBLISHER_NAMES] }));
console.log(Object.keys(out[2020]).length, [...PUBLISHER_NAMES].length);
