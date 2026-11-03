# 年金特別会計の目: 当初（予算書）と決算（歳出予算額＝補正後、現額、支出済、繰越、不用）を FY2017〜FY2024 で並べる
import csv, json, os, sys
D = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y, f):
    for root in (['reference-v0'] if y >= 2023 else ['mof-history-v0']):
        p = f'{D}/{root}/mof-archive/{y}/{f}'
        if os.path.exists(p): return p
    raise SystemExit(f'missing {y} {f}')
def rows(y, f):
    with open(path(y, f), encoding='utf-8') as fh: return list(csv.DictReader(fh))
Y = list(range(2017, 2025))
out = {}
for y in Y:
    base = rows(y, 'moku-special.csv')
    amt = [k for k in base[0] if ('予定額' in k or '要求額' in k) and '前年度' not in k][0]
    kes = rows(y, 'moku-special-kessan.csv')
    for r in base:
        if r['特別会計'] != '年金': continue
        k = (r['勘定'], r['項名'], r['目名'])
        e = out.setdefault('|'.join(k), {'acct': r['勘定'], 'kou': r['項名'], 'moku': r['目名'], 'use': r['使途別分類コード'], 'y': {}})
        d = e['y'].setdefault(str(y), {})
        d['budget'] = d.get('budget', 0) + int(r[amt] or 0) * 1000
    for r in kes:
        if r['特別会計'] != '年金': continue
        k = (r['勘定'], r['項名'], r['目名'])
        e = out.setdefault('|'.join(k), {'acct': r['勘定'], 'kou': r['項名'], 'moku': r['目名'], 'use': r['使途別分類コード'], 'y': {}})
        d = e['y'].setdefault(str(y), {})
        for key, col in [('appr', '歳出予算額(円)'), ('cin', '前年度繰越額(円)'), ('res', '予備費使用額(円)'), ('rule', '予算総則の規定による経費増額(円)'), ('flow', '流用等増△減額(円)'), ('mv', '予算決定後移替増△減額(円)'), ('cur', '歳出予算現額(円)'), ('spent', '支出済歳出額(円)'), ('cout', '翌年度繰越額(円)'), ('unused', '不用額(円)')]:
            d[key] = d.get(key, 0) + int(r[col] or 0)
json.dump(out, open('s1.json', 'w'), ensure_ascii=False)
# 勘定ごとの集計
acc = {}
for e in out.values():
    for y, d in e['y'].items():
        a = acc.setdefault(e['acct'], {}).setdefault(y, {})
        for k, v in d.items(): a[k] = a.get(k, 0) + v
for a, ys in acc.items():
    print('==', a)
    for y in sorted(ys):
        d = ys[y]; t = lambda k: f"{d.get(k, 0)/1e12:7.2f}"
        print(y, '当初', t('budget'), '補正後', t('appr'), '現額', t('cur'), '支出', t('spent'), '不用', t('unused'), '繰越', t('cout'))
# 恒等式
bad = 0
for e in out.values():
    for y, d in e['y'].items():
        if 'cur' not in d: continue
        if d['cur'] != d['appr'] + d['cin'] + d['res'] + d['rule'] + d['flow'] + d['mv']: bad += 1
        if d['cur'] != d['spent'] + d['cout'] + d['unused']: bad += 1
print('恒等式の不一致', bad, '目数', len(out))
