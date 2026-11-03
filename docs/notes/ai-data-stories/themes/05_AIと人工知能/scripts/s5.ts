// 目名に「人工知能」を含む予算書の目に、RS の事業がどう結ばれているか（逆向き）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
const rs = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/rs/jigyo.json.gz')).toString());
const mk = JSON.parse(gunzipSync(readFileSync('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/moku.json.gz')).toString());
const AI = /(?<![A-Za-zＡ-Ｚａ-ｚ])(AI|ＡＩ)(?![A-Za-zＡ-Ｚａ-ｚ])/, J = /人工知能/;
const out: any[] = [];
for (const y of [2024, 2025]) {
  const m = new Map<string, any>();
  for (const l of rs.links) {
    if (l[1] !== y || !J.test(l[3])) continue;
    const j = rs.jigyo[l[0]]; const kou = rs.kous[l[2]]; const key = `${kou}|${l[3]}`;
    const e = m.get(key) ?? m.set(key, { year: y, kou, moku: l[3], rows: [] as any[] }).get(key)!;
    e.rows.push({ id: j[0], name: j[1], ai: AI.test(j[1]) || J.test(j[1]), kind: l[4], yen: l[5] });
  }
  for (const e of m.values()) {
    const node = mk.nodes.find((n: any) => mk.kous[n[0]] === e.kou && n[2] === e.moku);
    const initRS = e.rows.filter((r: any) => r.kind === '当初予算').reduce((a: number, r: any) => a + (r.yen ?? 0), 0);
    out.push({ ...e, budgetSen: node ? node[5] : null, initRS });
    console.log(y, e.kou.split('|').pop(), '/', e.moku, '| 予算書 政府案', node ? (node[5] / 1e5).toFixed(2) + '億' : '—', '| RS 当初の行の計', (initRS / 1e8).toFixed(2) + '億');
    for (const r of e.rows) console.log('   ', r.kind || '(空)', (r.yen === null ? '—' : (r.yen / 1e8).toFixed(2) + '億'), r.ai ? '★' : ' ', r.name.slice(0, 50));
  }
}
writeFileSync('/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/t5-ai/s5.json', JSON.stringify(out));
