// LP に埋め込む値を作る（s1.json・s3.json・s4.json から）。単位: 億円（千円 ÷ 1e5 を四捨五入）
import { readFileSync, writeFileSync } from 'node:fs';
const s1 = JSON.parse(readFileSync('s1.json', 'utf8')), s3 = JSON.parse(readFileSync('s3.json', 'utf8')), s4 = JSON.parse(readFileSync('s4.json', 'utf8'));
const Y: number[] = s1.Y;
const oku = (v: number | undefined) => (v === undefined ? null : Math.round(v / 1e5));
const sum8 = (o: any, y: number) => Object.values(o).reduce((s: number, r: any) => s + (r[y] ?? 0), 0);
const sp = (k: string, y: number) => s1.spByAcctKou[`交付税及び譲与税配付金 / ${k}`]?.[y] ?? 0;
const acc = (a: string, y: number) => s1.spByAcct[a]?.[y] ?? 0;
const rows = Y.map(y => {
  const kofuTax = sp('地方交付税交付金', y), jouyo = sp('地方譲与税譲与金', y), tokurei = sp('地方特例交付金', y), kotsu = sp('交通安全対策特別交付金', y);
  const nenkinGyomu = s1.spByAcctKou['年金 / 業務取扱費']?.[y] ?? 0; // 年金特会の業務取扱費（市町村の事務費）は子ども・子育てではないので、その他へ
  const kodomo = acc('年金', y) - nenkinGyomu + acc('子ども・子育て支援', y);
  const spAll = sum8(s1.loc.special, y), gen = sum8(s1.loc.general, y);
  return { y, kofuTax: oku(kofuTax), jouyo: oku(jouyo), tokurei: oku(tokurei + kotsu), gen: oku(gen), kodomo: oku(kodomo), otherSp: oku(spAll - kofuTax - jouyo - tokurei - kotsu - kodomo), total: oku(spAll + gen),
    social: oku(Object.values(s3[y] as Record<string, number>).reduce((a, b) => a + b, 0)),
    genKofu: oku(s4[y]['一般/地方交付税交付金']), spKofu: oku(s4[y]['特会/地方交付税交付金']), spDebt: oku(s4[y]['特会/国債整理基金特別会計へ繰入']),
    nenkinKodomo: oku(acc('年金', y) - (s1.spByAcctKou['年金 / 業務取扱費']?.[y] ?? 0)), kodomoSp: oku(acc('子ども・子育て支援', y)) };
});
// 府省（一般会計の対地方）。内閣府の外局は、こども家庭庁だけ分け、ほかは内閣府にまとめる
const minAgg: Record<string, Record<number, number>> = {};
for (const [k, r] of Object.entries(s1.genByMin) as [string, Record<number, number>][]) {
  const name = k === '内閣府/こども家庭庁' ? 'こども家庭庁' : k.startsWith('内閣府') ? '内閣府（外局を含む。こども家庭庁を除く）' : k;
  for (const [y, v] of Object.entries(r)) (minAgg[name] ??= {})[+y] = (minAgg[name][+y] ?? 0) + v;
}
const mins = Object.entries(minAgg).map(([n, r]) => ({ n, v: Y.map(y => oku(r[y])) })).sort((a, b) => (b.v[9] ?? 0) - (a.v[9] ?? 0)).filter(r => (r.v[9] ?? 0) >= 10 || (r.v[0] ?? 0) >= 10);
// 目名ごと（府省・項をまたいで足す。名前の変更 1 件をまとめる）
const RENAME: Record<string, string> = { '防災・安全社会資本整備交付金': '防災・安全交付金' };
const mk: Record<string, Record<number, number>> = {};
for (const [k, r] of Object.entries(s1.genByMoku) as [string, Record<number, number>][]) {
  const nm0 = k.split(' / ')[2]!; const nm = RENAME[nm0] ?? nm0;
  for (const [y, v] of Object.entries(r)) (mk[nm] ??= {})[+y] = (mk[nm][+y] ?? 0) + v;
}
const mokus = Object.entries(mk).map(([n, r]) => ({ n, v: Y.map(y => oku(r[y])), d: (r[2026] ?? 0) - (r[2017] ?? 0) }));
const up = [...mokus].sort((a, b) => b.d - a.d).slice(0, 8).map(({ n, v }) => ({ n, v }));
const down = [...mokus].sort((a, b) => a.d - b.d).slice(0, 6).map(({ n, v }) => ({ n, v }));
// 医療・介護の保険（全年度の目名の和集合。「等」が付いた改称 3 件をまとめる）
const SREN: Record<string, string> = { '後期高齢者医療財政調整交付金': '後期高齢者医療等財政調整交付金', '国民健康保険後期高齢者医療費支援金負担金': '国民健康保険後期高齢者医療費支援金等負担金', '国民健康保険後期高齢者医療費支援金財政調整交付金': '国民健康保険後期高齢者医療費支援金等財政調整交付金' };
const sm: Record<string, Record<number, number>> = {};
for (const y of Y) for (const [n0, v] of Object.entries(s3[y] as Record<string, number>)) { const n = SREN[n0] ?? n0; (sm[n] ??= {})[y] = (sm[n][y] ?? 0) + v; }
const social = Object.entries(sm).sort((a, b) => (b[1][2026] ?? b[1][2017] ?? 0) - (a[1][2026] ?? a[1][2017] ?? 0)).map(([n, r]) => ({ n, v: Y.map(y => oku(r[y])) }));
writeFileSync('data.json', JSON.stringify({ Y, rows, mins, up, down, social }));
console.log(JSON.stringify(rows.map(r => [r.y, r.total, r.gen, r.kofuTax, r.jouyo, r.tokurei, r.kodomo, r.otherSp, r.social])));
console.log(up.map(u => `${u.n} ${u.v[0]}→${u.v[9]}`).join(' / '));
console.log(down.map(u => `${u.n} ${u.v[0]}→${u.v[9]}`).join(' / '));
console.log(mins.map(u => `${u.n} ${u.v[0]}→${u.v[9]}`).join(' / '));
