# 目の単位（moku-special-kessan.csv）: 国債整理支出・原賠繰入・外為・地震・食糧・基礎年金給付の内訳
import csv, os, re, json
DS = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y, nm):
    for d in ('reference-v0', 'mof-history-v0'):
        p = f'{DS}/{d}/mof-archive/{y}/{nm}'
        if os.path.exists(p): return p
C = ['歳出予算額', '前年度繰越額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']
T = {'国債整理基金|国債整理支出': None, 'エネルギー対策|国債整理基金特別会計へ繰入': None, '外国為替資金|': None, '地震再保険|': None, '食料安定供給|食糧買入費': None, '年金|基礎年金給付費': None}
out = {}
for y in range(2017, 2025):
    R = list(csv.DictReader(open(path(y, 'moku-special-kessan.csv'), encoding='utf-8')))
    cm = {c: [k for k in R[0] if k.startswith(c)][0] for c in C}
    for r in R:
        for t in T:
            a, kn = t.split('|')
            if r['特別会計'] != a or (kn and r['項名'] != kn): continue
            key = f"{t}|{r['勘定']}|{r['項名'] if not kn else ''}|{r['目名']}"
            o = out.setdefault(key, {})
            v = o.setdefault(y, {c: 0 for c in C})
            for c in C: v[c] += int(r[cm[c]] or 0)
json.dump(out, open('s4.json', 'w'), ensure_ascii=False)
for k, ys in sorted(out.items(), key=lambda kv: -sum(v['不用額'] for v in kv[1].values())):
    tu = sum(v['不用額'] for v in ys.values()); tc = sum(v['歳出予算現額'] for v in ys.values())
    if tu < 5e10 and sum(v['翌年度繰越額'] for v in ys.values()) < 5e10: continue
    print(k, f'8年 現額 {tc/1e12:.2f} 不用 {tu/1e12:.2f}')
    print('   現額', ' '.join(f"{ys[y]['歳出予算現額']/1e12:.2f}" if y in ys else '-' for y in range(2017, 2025)))
    print('   支出', ' '.join(f"{ys[y]['支出済歳出額']/1e12:.2f}" if y in ys else '-' for y in range(2017, 2025)))
    print('   繰越', ' '.join(f"{ys[y]['翌年度繰越額']/1e12:.2f}" if y in ys else '-' for y in range(2017, 2025)))
    print('   不用', ' '.join(f"{ys[y]['不用額']/1e12:.2f}" if y in ys else '-' for y in range(2017, 2025)))
