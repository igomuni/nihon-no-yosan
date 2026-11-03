# 検算: 決算の項の CSV を直接読んで、8 年計と、上位の項の繰越・不用を出す（画面用データとは独立）
import csv, json, os
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y):
    for d in ('mof-history-v0', 'reference-v0'):
        p = f'{base}/{d}/mof-archive/{y}/kou-general-kessan.csv'
        if os.path.exists(p): return p
tot = {'現額': 0, '翌年度繰越': 0, '不用': 0, '前年度繰越': 0}
items = {}
for y in range(2017, 2025):
    rows = list(csv.DictReader(open(path(y), encoding='utf-8')))
    col = lambda key: [c for c in rows[0] if key in c][0]
    cc, co, cu, ci = col('歳出予算現額'), col('翌年度繰越額'), col('不用額'), col('前年度繰越額')
    for r in rows:
        v = lambda c: int(r[c] or 0)
        tot['現額'] += v(cc); tot['翌年度繰越'] += v(co); tot['不用'] += v(cu); tot['前年度繰越'] += v(ci)
        key = (r['所管'], r['項名'])
        a = items.setdefault(key, {}); a[y] = (v(cc), v(co), v(cu), v(ci))
print({k: round(v / 1e12, 3) for k, v in tot.items()})
for key in [('国土交通省', '社会資本総合整備事業費'), ('国土交通省', '観光振興費'), ('内閣府', '新型コロナウイルス感染症対応地方創生推進費'), ('経済産業省', 'エネルギー需給構造高度化対策費')]:
    a = items.get(key, {})
    print(key, {y: tuple(round(x / 1e12, 3) for x in a[y]) for y in sorted(a)})
    print('   8 年計 繰越', round(sum(x[1] for x in a.values()) / 1e12, 3), '不用', round(sum(x[2] for x in a.values()) / 1e12, 3))
