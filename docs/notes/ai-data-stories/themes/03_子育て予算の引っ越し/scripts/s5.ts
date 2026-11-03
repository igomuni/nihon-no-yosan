// 引き継ぎの根拠: 2024→2025 特会勘定の項の対応（links）と、前年度予算額の合計。2022→2023 の 0 円の項の事項の前年度予算額
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { lifecycleGroupsOf, lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const L = '/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), j = rd('jikou.json.gz');
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const vals = (i: number) => lifecycleValues((ev.get(i) ?? []).filter((e: any) => e[1] !== 'derived')) as any;
const sel = (y: number, acc: string, sub: string) => d.kous.map((k: any, i: number) => [k, i]).filter(([k]: any) => k.year === y && k.specialAccount === acc && k.subAccount === sub);
const k24 = sel(2024, '年金', '子ども・子育て支援勘定'), k25 = sel(2025, '子ども・子育て支援', '子ども・子育て支援勘定');
const s = (rows: any[], f: string) => rows.reduce((a: number, [, i]: any) => a + (vals(i)[f] ?? 0), 0);
console.log('2024 年金特会 子ども勘定: 政府案', s(k24, 'budget_amount') / 1e12, '補正後', s(k24, 'revised_amount') / 1e12);
console.log('2025 子ども特会 子ども勘定: 政府案', s(k25, 'budget_amount') / 1e12, '前年度予算額', s(k25, 'prev_amount') / 1e12, 'keys', Object.keys(vals(k25[0][1])).join(','));
const set25 = new Set(k25.map(([, i]: any) => i));
const ls = d.links.filter((l: any) => set25.has(l.to));
console.log('2025 の勘定の項へ入る links', ls.length, ls.map((l: any) => `${d.kous[l.from]?.name}→${d.kous[l.to].name} ${l.status} ${l.evidence.join('+')}`).join('\n  '));
// 2023 の 0 円の項（内閣府・厚労の移った項）
console.log('\n2023 一般会計で政府案 0 の、子ども関連の項と事項の前年度予算額');
d.kous.forEach((k: any, i: number) => { if (k.year !== 2023 || k.account !== 'general') return; const v = vals(i); if (v.budget_amount !== 0) return; if (!/子ども|大学等修学|母子|児童|保育/.test(k.name)) return;
  const ki = j.kous.indexOf(k.id); const ns = j.nodes.filter((n: any) => n[0] === ki);
  console.log(lifecycleGroupsOf(k)[0], k.name, '項 prev', (v.prev_amount ?? null), '事項', ns.map((n: any) => `${n[2]} 政府案${n[3]} 前年度${n[4]}`).join(' / ')); });
