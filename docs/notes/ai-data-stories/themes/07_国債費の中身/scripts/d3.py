# 検算: 元の CSV（目）を直接読んで、国債整理基金特会の主要な値を出す
import csv, glob
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y, f):
    for d in (f'{base}/mof-history-v0/mof-archive/{y}', f'{base}/reference-v0/mof-archive/{y}'):
        p = f'{d}/{f}'
        if glob.glob(p): return p
    return None
def col(row, key): return [c for c in row if key in c][0]
for y in (2017, 2020, 2024):
    p = path(y, 'moku-special-kessan.csv'); rows = [r for r in csv.DictReader(open(p, encoding='utf-8')) if r['特別会計'] == '国債整理基金']
    for name in ('利子及割引料', '債務償還費'):
        rs = [r for r in rows if r['目名'] == name and r['項名'] == '国債整理支出']
        c = {k: sum(int(r[col(r, k)] or 0) for r in rs) / 1e12 for k in ('歳出予算額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額')}
        print(y, 'kessan', name, {k: round(v, 3) for k, v in c.items()}, 'rows', len(rs))
for y, f in ((2017, 'moku-special.csv'), (2024, 'moku-special.csv'), (2026, 'moku-special.csv')):
    p = path(y, f); rows = [r for r in csv.DictReader(open(p, encoding='utf-8')) if r['特別会計'] == '国債整理基金']
    amt = [c for c in rows[0] if ('要求額' in c or '予定額' in c)][0]
    for name in ('利子及割引料', '債務償還費'):
        s = sum(int(r[amt] or 0) for r in rows if r['目名'] == name and r['項名'] == '国債整理支出') / 1e9
        print(y, 'budget', name, round(s, 3), '兆円', amt)
    tot = sum(int(r[amt] or 0) for r in rows) / 1e9
    print(y, 'budget 特会 目の合計', round(tot, 2))
# 一般会計 国債費 の決算（項）
for y in (2017, 2024):
    p = path(y, 'kou-general-kessan.csv'); rows = [r for r in csv.DictReader(open(p, encoding='utf-8')) if r['項名'] == '国債費']
    print(y, '一般会計 国債費 支出済', round(sum(int(r[col(r, '支出済歳出額')] or 0) for r in rows) / 1e12, 3))
