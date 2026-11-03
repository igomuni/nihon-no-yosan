import json
from collections import defaultdict
d = json.load(open('s1.json')); it = [x for x in d['items'] if x['歳出予算現額'] is not None]
C = ['歳出予算額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']
# 項（会計・勘定・項名）の 8 年計
m = defaultdict(lambda: {c: 0 for c in C} | {'ys': {}})
for x in it:
    k = (x['acct'], x['sub'], x['name'])
    for c in C: m[k][c] += x[c]
    m[k]['ys'][x['y']] = {c: x[c] for c in C}
rows = [{'acct': k[0], 'sub': k[1], 'name': k[2], **v} for k, v in m.items()]
print('== 不用 8年計 上位 25（兆円）')
for r in sorted(rows, key=lambda r: -r['不用額'])[:25]:
    print(f"{r['acct'][:8]:<8} {r['sub'][:12]:<12} {r['name'][:28]:<28} 現額 {r['歳出予算現額']/1e12:7.2f} 不用 {r['不用額']/1e12:6.2f} ({r['不用額']/r['歳出予算現額']*100:5.1f}%) 年 {len(r['ys'])}")
print('== 繰越 8年計 上位 15')
for r in sorted(rows, key=lambda r: -r['翌年度繰越額'])[:15]:
    print(f"{r['acct'][:8]:<8} {r['sub'][:12]:<12} {r['name'][:28]:<28} 現額 {r['歳出予算現額']/1e12:7.2f} 繰越 {r['翌年度繰越額']/1e12:6.2f} ({r['翌年度繰越額']/r['歳出予算現額']*100:5.1f}%) 毎年 " + ' '.join(f"{r['ys'][y]['翌年度繰越額']/1e12:.2f}" if y in r['ys'] else '-' for y in range(2017, 2025)))
# 勘定別 8 年計（エネルギー・食料・年金・労働・外為・地震）
sub = defaultdict(lambda: {c: 0 for c in C})
for x in it:
    for c in C: sub[(x['acct'], x['sub'])][c] += x[c]
print('== 勘定別')
for k, v in sorted(sub.items(), key=lambda kv: -kv[1]['不用額']):
    if v['不用額'] < 1e11: continue
    print(f"{k[0][:10]:<10} {k[1][:22]:<22} 現額 {v['歳出予算現額']/1e12:7.2f} 支出 {v['支出済歳出額']/1e12:7.2f} 繰越 {v['翌年度繰越額']/1e12:5.2f} 不用 {v['不用額']/1e12:6.2f} ({v['不用額']/v['歳出予算現額']*100:5.1f}%)")
json.dump(rows, open('s3.json', 'w'), ensure_ascii=False)
