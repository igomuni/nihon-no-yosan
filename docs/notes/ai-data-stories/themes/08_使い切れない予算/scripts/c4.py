# 検算と確認: 内閣府・総務省の「新型コロナウイルス感染症対応地方創生推進費」の、決算の全列（移替を含む）
import csv, os
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y):
    for d in ('mof-history-v0', 'reference-v0'):
        p = f'{base}/{d}/mof-archive/{y}/kou-general-kessan.csv'
        if os.path.exists(p): return p
names = ['新型コロナウイルス感染症対応地方創生推進費', '物価高騰対応地方創生推進費']
for y in range(2020, 2025):
    for r in csv.DictReader(open(path(y), encoding='utf-8')):
        if r['項名'] in names:
            v = {k.split('(')[0]: round(int(r[k] or 0) / 1e12, 3) for k in r if '(円)' in k}
            print(y, r['所管'], r['組織'], r['項名'][:12], v)
