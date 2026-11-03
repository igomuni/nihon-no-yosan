// 予備費の行方: 決算の目（一般会計）の「予備費使用額」から、予備費の項（マイナス）と使った先（プラス）を年度ごとに集計
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { readCsv, lifecycleGroupsOf, codeNameOf, lifecycleValues } from '/Users/igomuni/orca/nihon-no-yosan/packages/core/src/index.ts';
const ROOT = '/Users/igomuni/orca/nihon-no-yosan/';
const L = ROOT + 'apps/web/public/data/lifecycle/';
const rd = (f: string) => JSON.parse(gunzipSync(readFileSync(L + f)).toString());
const d = rd('data.json.gz'), codes = rd('codes.json.gz');
const kouById = new Map<string, any>(d.kous.map((k: any, i: number) => [k.id, { k, i }]));
const ev = new Map<number, any[]>(); for (const e of d.events) (ev.get(e[0]) ?? ev.set(e[0], []).get(e[0])!).push(e);
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const dir = (y: number) => (y <= 2022 ? ROOT + 'data/dataset/mof-history-v0/mof-archive/' : ROOT + 'data/dataset/reference-v0/mof-archive/') + y + '/';
const num = (s: string | undefined) => (s === undefined || s === '' ? 0 : Number(s));
const out: any = {};
for (const y of Y) {
  const rows = readCsv(readFileSync(dir(y) + 'moku-general-kessan.csv', 'utf8')) as Record<string, string>[];
  const col = (re: RegExp) => Object.keys(rows[0]!).find(c => re.test(c))!;
  const cRes = col(/^予備費使用額/), cBud = col(/^歳出予算額/), cCur = col(/^歳出予算現額/), cSp = col(/^支出済/), cUn = col(/^不用額/), cCo = col(/^翌年度繰越/), cMv = col(/^流用等/), cTr = col(/^予算決定後移替/);
  const reserves = new Map<string, any>(); const users: any[] = []; let neg = 0, pos = 0;
  for (const r of rows) {
    const v = num(r[cRes]);
    const kouName = r['項名']!;
    const isReserveKou = /予備費$/.test(kouName);
    if (isReserveKou) {
      const x = reserves.get(kouName) ?? reserves.set(kouName, { name: kouName, ministry: r['所管'], code: r['項コード'], budget: 0, used: 0, move: 0, trans: 0, current: 0, spent: 0, carried: 0, unused: 0 }).get(kouName)!;
      x.budget += num(r[cBud]); x.used += v; x.move += num(r[cMv]); x.trans += num(r[cTr]); x.current += num(r[cCur]); x.spent += num(r[cSp]); x.carried += num(r[cCo]); x.unused += num(r[cUn]);
    }
    if (v < 0) neg += v;
    if (v > 0) {
      pos += v;
      const id = `${y}:general:${r['所管']}|${r['組織']}|${r['項コード']}|${kouName}`;
      const kk = kouById.get(id);
      users.push({ ministry: r['所管'], org: r['組織'], kouCode: r['項コード'], kou: kouName, moku: r['目名'], major: r['主要経費別分類コード'], v, group: kk ? lifecycleGroupsOf(kk.k)[0] : null, spent: num(r[cSp]), unused: num(r[cUn]), carried: num(r[cCo]), current: num(r[cCur]) });
    }
  }
  // 当初・補正（予算の一生のデータ。項の id で）
  for (const x of reserves.values()) {
    const id = `${y}:general:${x.ministry}|${x.ministry}|${x.code}|${x.name}`;
    const hit = [...kouById.values()].find(o => o.k.year === y && o.k.account === 'general' && o.k.ministry === x.ministry && o.k.code === x.code);
    x.initialName = hit?.k.name ?? null;
    const v = hit ? lifecycleValues((ev.get(hit.i) ?? []).filter((e: any) => e[1] !== 'derived')) : null;
    x.initial = v?.budget_amount ?? null; x.revised = v?.revised_amount ?? null; x.kouId = hit?.k.id ?? null; x.idGuess = id;
  }
  const byGroup = new Map<string, number>(), byMajor = new Map<string, number>(), byKou = new Map<string, any>();
  let unmatched = 0;
  for (const u of users) {
    const g = u.group ?? (unmatched++, u.ministry);
    byGroup.set(g, (byGroup.get(g) ?? 0) + u.v);
    byMajor.set(u.major, (byMajor.get(u.major) ?? 0) + u.v);
    const kk = `${g}|${u.kou}`; const o = byKou.get(kk) ?? byKou.set(kk, { group: g, kou: u.kou, v: 0, mokus: new Map<string, number>() }).get(kk)!; o.v += u.v; o.mokus.set(u.moku, (o.mokus.get(u.moku) ?? 0) + u.v);
  }
  out[y] = {
    neg, pos, users: users.length, userList: users, unmatched,
    reserves: [...reserves.values()],
    byGroup: [...byGroup].sort((a, b) => b[1] - a[1]),
    byMajor: [...byMajor].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, codeNameOf(codes, 'major', c, y, 'general')?.name ?? '?', v]),
    byKou: [...byKou.values()].sort((a, b) => b.v - a.v).slice(0, 15).map(o => ({ group: o.group, kou: o.kou, v: o.v, mokus: [...o.mokus].sort((a, b) => b[1] - a[1]).slice(0, 3) })),
  };
  const t = (x: number | null) => (x === null ? '—' : (x / 1e12).toFixed(3));
  console.log(`\n== FY${y} 使用(+) ${t(pos)} / 予備費側(−) ${t(-neg)} / 使った目 ${users.length} / 所管の対応なし ${unmatched}`);
  for (const x of reserves.values()) console.log(`  ${x.name}: 当初 ${t(x.initial)} 補正後 ${t(x.revised)} | 決算 歳出予算額 ${t(x.budget)} 使用 ${t(-x.used)} 流用 ${t(x.move)} 移替 ${t(x.trans)} 現額 ${t(x.current)} 支出 ${t(x.spent)} 繰越 ${t(x.carried)} 不用 ${t(x.unused)}`);
  console.log('  府省', out[y].byGroup.slice(0, 6).map(([g, v]: any) => `${g} ${t(v)}`).join(' / '));
  console.log('  主要経費', out[y].byMajor.slice(0, 5).map(([c, n, v]: any) => `${n} ${t(v)}`).join(' / '));
  console.log('  項', out[y].byKou.slice(0, 5).map((o: any) => `${o.group} ${o.kou} ${t(o.v)}`).join(' / '));
}
writeFileSync('r1.json', JSON.stringify(out));
