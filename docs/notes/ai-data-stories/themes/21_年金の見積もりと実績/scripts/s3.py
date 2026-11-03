# 一般会計 → 年金特会 の繰入（項「基礎年金拠出金等年金特別会計へ繰入」）の目: 当初・決算
import csv, os, json
D = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y, f):
    p = f"{D}/{'reference-v0' if y >= 2023 else 'mof-history-v0'}/mof-archive/{y}/{f}"
    assert os.path.exists(p), p; return p
def rows(y, f): return list(csv.DictReader(open(path(y, f), encoding='utf-8')))
res = {}
for y in range(2017, 2025):
    b = rows(y, 'moku-general.csv'); amt = [k for k in b[0] if ('予定額' in k or '要求額' in k) and '前年度' not in k][0]
    k = rows(y, 'moku-general-kessan.csv')
    for r in b:
        if '年金特別会計へ繰入' in r['項名']:
            d = res.setdefault(r['項名'] + '|' + r['目名'], {}).setdefault(str(y), {}); d['budget'] = d.get('budget', 0) + int(r[amt] or 0) * 1000; d['kou'] = r['項名']
    for r in k:
        if '年金特別会計へ繰入' in r['項名']:
            d = res.setdefault(r['項名'] + '|' + r['目名'], {}).setdefault(str(y), {})
            for key, col in [('appr', '歳出予算額(円)'), ('cur', '歳出予算現額(円)'), ('spent', '支出済歳出額(円)'), ('unused', '不用額(円)'), ('cout', '翌年度繰越額(円)')]: d[key] = d.get(key, 0) + int(r[col] or 0)
json.dump(res, open('s3.json', 'w'), ensure_ascii=False)
for m, ys in res.items():
    print('==', m)
    for y in sorted(ys):
        d = ys[y]; f = lambda k: f"{d.get(k, 0)/1e12:6.2f}"
        print(y, d.get('kou','')[:20], '当初', f('budget'), '補正後', f('appr'), '支出', f('spent'), '不用', f('unused'))
