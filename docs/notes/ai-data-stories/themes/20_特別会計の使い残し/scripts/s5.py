# LP に埋め込む値（兆円は表示で丸める。ここでは億円の整数）
import json, csv, glob
s2 = json.load(open('s2.json')); s3 = json.load(open('s3.json')); s4 = json.load(open('s4.json'))
oku = lambda v: None if v is None else round(v / 1e8)
Y = list(range(2017, 2025))
acc = []
for r in s2['acct']:
    acc.append({'n': r['acct'], 'init': oku(r['init']), 'rev': oku(r['歳出予算額']), 'cur': oku(r['歳出予算現額']), 'sp': oku(r['支出済歳出額']), 'ca': oku(r['翌年度繰越額']), 'un': oku(r['不用額']),
        'y': {y: [oku(r['byYear'][str(y)][c]) if str(y) in r['byYear'] else None for c in ['init', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']] for y in Y}})
# 一般会計（決算の項の CSV を直接足す）
DS = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
g = {'cur': 0, 'sp': 0, 'ca': 0, 'un': 0}
for y in Y:
    f = sorted(glob.glob(f'{DS}/*/mof-archive/{y}/kou-general-kessan.csv'))[0]
    R = list(csv.DictReader(open(f, encoding='utf-8')))
    for k, c in [('cur', '歳出予算現額'), ('sp', '支出済歳出額'), ('ca', '翌年度繰越額'), ('un', '不用額')]:
        cc = [x for x in R[0] if x.startswith(c)][0]; g[k] += sum(int(x[cc] or 0) for x in R)
gen = {k: oku(v) for k, v in g.items()}
top_un = [{'a': r['acct'], 's': r['sub'], 'n': r['name'], 'cur': oku(r['歳出予算現額']), 'un': oku(r['不用額']), 'yrs': len(r['ys'])} for r in sorted(s3, key=lambda r: -r['不用額'])[:15]]
top_ca = [{'a': r['acct'], 's': r['sub'], 'n': r['name'], 'cur': oku(r['歳出予算現額']), 'ca': oku(r['翌年度繰越額']), 'by': [oku(r['ys'][str(y)]['翌年度繰越額']) if str(y) in r['ys'] else None for y in Y]} for r in sorted(s3, key=lambda r: -r['翌年度繰越額'])[:10]]
pick = {'債務償還費（国債整理基金）': '国債整理基金|国債整理支出|||債務償還費', '国債整理基金への繰入（エネルギー対策・原子力損害賠償支援勘定）': 'エネルギー対策|国債整理基金特別会計へ繰入|原子力損害賠償支援勘定||国債整理基金特別会計へ繰入',
        '基礎年金給付費（年金・基礎年金勘定）': '年金|基礎年金給付費|基礎年金勘定||基礎年金給付費', '再保険金（地震再保険）': '地震再保険|||再保険費|再保険金'}
series = [{'n': k, 'cur': [oku(s4[v][str(y)]['歳出予算現額']) for y in Y], 'sp': [oku(s4[v][str(y)]['支出済歳出額']) for y in Y], 'ca': [oku(s4[v][str(y)]['翌年度繰越額']) for y in Y], 'un': [oku(s4[v][str(y)]['不用額']) for y in Y]} for k, v in pick.items()]
gai = {k: [oku(s4[v][str(y)]['歳出予算現額']) if str(y) in s4[v] else None for y in Y] for k, v in {'繰入': '外国為替資金|||国債整理基金特別会計へ繰入|国債整理基金特別会計へ繰入'}.items()}
json.dump({'Y': Y, 'acc': acc, 'gen': gen, 'topUn': top_un, 'topCa': top_ca, 'series': series}, open('page-data.json', 'w'), ensure_ascii=False)
print(gen, len(acc))
