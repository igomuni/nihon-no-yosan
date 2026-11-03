# 一般会計の国債費の補正（事項）: 補正要求差引額を、事項名の区分ごとに足す（回が複数ある年は全回）
import csv, glob, json
from d4 import cat
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
out = {}
for y in range(2017, 2027):
    files = sorted(glob.glob(f'{base}/*/mof-archive/{y}/jikou-general-hosei*.csv'))
    o = out.setdefault(y, {'_files': [f.split('/')[-1] for f in files]})
    for f in files:
        rows = [r for r in csv.DictReader(open(f, encoding='utf-8')) if r['項名'] == '国債費' and r.get('行の種類', '事項') == '事項']
        if not rows: continue
        c = [k for k in rows[0] if '差引額' in k][0]
        for r in rows:
            k = cat(r['事項名']); o[k] = o.get(k, 0) + int(r[c] or 0)
for y, o in out.items(): print(y, o['_files'], {k: round(v / 1e9, 2) for k, v in o.items() if not k.startswith('_')})
json.dump(out, open('d5.json', 'w'), ensure_ascii=False)
