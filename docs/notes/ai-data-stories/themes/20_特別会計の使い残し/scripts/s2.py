# 会計・勘定ごとの集計、恒等式・受け渡し・補正後の照合、ランキング
import json
from collections import defaultdict
d = json.load(open('s1.json')); it = d['items']
Y = list(range(2017, 2025))
C = ['init', 'revised', '歳出予算額', '前年度繰越額', '予備費使用額', '予算総則の規定による経費増額', '流用等増△減額', '予算決定後移替増△減額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']
def agg(keyf):
    m = defaultdict(lambda: defaultdict(lambda: {c: 0 for c in C} | {'nk': 0}))
    for x in it:
        a = m[keyf(x)][x['y']]
        for c in C:
            if x[c] is not None: a[c] += x[c]
        if x['歳出予算現額'] is not None: a['nk'] += 1
    return m
acct = agg(lambda x: x['acct'])
sub = agg(lambda x: (x['acct'], x['sub']))
# 検算 1: 項の恒等式
bad1 = bad2 = 0
for x in it:
    if x['歳出予算現額'] is None: continue
    s = x['歳出予算額'] + x['前年度繰越額'] + x['予備費使用額'] + x['予算総則の規定による経費増額'] + x['流用等増△減額'] + x['予算決定後移替増△減額']
    if s != x['歳出予算現額']: bad1 += 1
    if x['支出済歳出額'] + x['翌年度繰越額'] + x['不用額'] != x['歳出予算現額']: bad2 += 1
print('恒等式 不成立 (財源側, 使途側):', bad1, bad2, '/', sum(1 for x in it if x['歳出予算現額'] is not None))
# 検算 2: 会計ごとの、補正後（予算書・補正予算書）と決算の歳出予算額
diff = []
for a, ys in acct.items():
    for y, v in ys.items():
        if v['nk'] == 0: continue
        dd = v['歳出予算額'] - v['revised']
        if abs(dd) > 0: diff.append((y, a, dd))
print('補正後 ≠ 決算の歳出予算額 の会計・年度:', len(diff)); [print('  ', y, a, f'{dd/1e8:,.1f}億') for y, a, dd in sorted(diff)[:20]]
# 検算 3: 年度間の受け渡し（会計ごと 翌年度繰越(y) = 前年度繰越(y+1)）
ho = []
for a, ys in acct.items():
    for y in Y[:-1]:
        if y in ys and y + 1 in ys and ys[y]['nk'] and ys[y + 1]['nk']:
            ho.append((a, y, ys[y]['翌年度繰越額'], ys[y + 1]['前年度繰越額']))
ok = sum(1 for h in ho if h[2] == h[3])
print('受け渡し 一致', ok, '/', len(ho)); [print('  ', h[0], h[1], f'{h[2]/1e8:,.1f} → {h[3]/1e8:,.1f}億') for h in ho if h[2] != h[3]]
# 会計ごとの 8 年計
res = []
for a, ys in acct.items():
    t = {c: sum(ys[y][c] for y in Y if y in ys) for c in C}
    if t['歳出予算現額'] == 0: continue
    res.append({'acct': a, **t, 'years': [y for y in Y if y in ys and ys[y]['nk']],
        'unusedRate': t['不用額'] / t['歳出予算現額'], 'carryRate': t['翌年度繰越額'] / t['歳出予算現額'], 'spentPerInit': t['支出済歳出額'] / t['init'] if t['init'] else None,
        'byYear': {y: {c: ys[y][c] for c in C} for y in Y if y in ys}})
res.sort(key=lambda r: -r['歳出予算現額'])
print('\n会計  8年計（兆円）: 当初 補正後 現額 支出 繰越 不用 | 不用率 繰越率 支出/当初')
for r in res:
    print(f"{r['acct'][:14]:<14} {r['init']/1e12:7.2f} {r['歳出予算額']/1e12:7.2f} {r['歳出予算現額']/1e12:7.2f} {r['支出済歳出額']/1e12:7.2f} {r['翌年度繰越額']/1e12:6.2f} {r['不用額']/1e12:6.2f} | {r['unusedRate']*100:5.1f}% {r['carryRate']*100:5.1f}% {(r['spentPerInit'] or 0)*100:5.1f}%  yrs {len(r['years'])}")
tot = {c: sum(r[c] for r in res) for c in C}
print('計', {c: round(tot[c] / 1e12, 3) for c in ['init', '歳出予算額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']})
json.dump({'acct': res, 'sub': [{'acct': k[0], 'sub': k[1], 'byYear': {y: v for y, v in ys.items()}} for k, ys in sub.items()]}, open('s2.json', 'w'), ensure_ascii=False)
