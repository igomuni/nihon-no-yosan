// 別の方法の検算: 画面用の目のデータ（moku.json.gz、pipeline が作ったもの）で、同じ目の支出済・不用・政府案を足す
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { mokuValue } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const m = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/moku.json.gz')).toString());
const NAMES = ['株式会社日本政策金融公庫出資金', '危機対応円滑化業務出資金', '株式会社商工組合中央金庫出資金', '経営安定関連保証等基金補助金', '中小企業再生支援利子補給補助金', '新型コロナウイルス感染症対策中小企業等持続化給付金', '新型コロナウイルス感染症対策中小企業等家賃支援給付金', '中小企業等事業再構築促進補助金'];
const out: Record<string, Record<string, number>> = {};
for (const n of m.nodes) {
  const id = m.kous[n[0]] as string; if (!id.includes(':general:') || n[1] < 2020 || n[1] > 2022 || !NAMES.includes(n[2])) continue;
  const o = (out[n[2]] ??= { spent: 0, unused: 0, budget: 0, revisedDelta: 0 });
  for (const k of ['spent', 'unused', 'budget'] as const) { const v = mokuValue(n, k); if (v !== null) o[k] += v * 1000; }
}
for (const [k, v] of Object.entries(out)) console.log(k.slice(0, 24), 'spent', (v.spent / 1e12).toFixed(3), 'unused', (v.unused / 1e12).toFixed(3), 'budget', (v.budget / 1e12).toFixed(3));
writeFileSync('v1.json', JSON.stringify(out));
