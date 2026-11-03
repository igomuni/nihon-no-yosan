"""LP に埋め込むデータ（page-data.json）を、s1・s2・s3 から作る。額は億円（小数 1 桁）"""
import json
s1, s2, s3 = (json.load(open(f)) for f in ['s1.json', 's2.json', 's3.json'])
oku = lambda yen: None if yen is None else round(yen / 1e8, 1)
G = ['kaken', 'kakushin', 'sohatsu', 'uchu']
NAME = {'kaken': '学術研究助成基金（科研費）', 'kakushin': '革新的研究開発推進基金', 'sohatsu': '創発的研究推進基金', 'uchu': '宇宙開発支援基金'}
years = s1['years']
fund = {}
for g in G:
    rows = []
    for y in years:
        d = s1['g'][g].get(str(y), {})
        rows.append({'y': y, 'b': oku(d['budget'] * 1000) if 'budget' in d else None, 's': oku(d['supp'] * 1000) if 'supp' in d else None,
                     'spent': oku(d['k_支出済歳出額']) if 'k_支出済歳出額' in d else None, 'cur': oku(d['k_歳出予算現額']) if 'k_歳出予算現額' in d else None,
                     'car': oku(d['k_翌年度繰越額']) if 'k_翌年度繰越額' in d else None, 'un': oku(d['k_不用額']) if 'k_不用額' in d else None})
    fund[g] = {'name': NAME[g], 'rows': rows, 'byMin': {m: oku(v * 1000) for m, v in sorted(s1['byMin'].get(g, {}).items(), key=lambda kv: -kv[1])}}
sci = {}
for y, d in s3['sci'].items():
    f, o = d['fund'], d['other']
    sci[y] = {'fund': oku(f['歳出予算現額']), 'other': oku(o['歳出予算現額']), 'oSpent': oku(o['支出済歳出額']), 'oCar': oku(o['翌年度繰越額']), 'oUn': oku(o['不用額'])}
sciBook = {y: {'b': oku(v['budget'] * 1000), 's': oku((v['supp'] or 0) * 1000)} for y, v in s1['sci'].items()}
# RS 事業
jig = []
for i, j in s2['jig'].items():
    bl = [b for b in s2['blocks'] if b['id'] == i]
    d1 = [b for b in bl if b['d'] == 1]
    deeper = [b for b in bl if (b['d'] or 0) >= 2]
    first = sorted({r['name'] for r in s2['recs'] if r['id'] == i and r['d'] == 1 and r['name']})
    s24 = j['sum'].get('2024', {})
    jig.append({'id': i, 'min': j['min'], 'name': j['name'], 'g': j['groups'], 'spent24': oku(s24.get('執行額(合計)')), 'd1': oku(sum(b['amt'] or 0 for b in d1)),
                'first': first, 'deep': len(deeper), 'deepAmt': oku(sum(b['amt'] or 0 for b in deeper)), 'other': len(j['otherMoku'])})
jig.sort(key=lambda x: -(x['spent24'] or 0))
cmp = [c for c in s3['cmp'] if c['y'] >= 2024]
json.dump({'years': years, 'fund': fund, 'sci': sci, 'sciBook': sciBook, 'jig': jig, 'cmp': [{'y': c['y'], 'kind': c['kind'], 'min': c['min'], 'g': c['g'], 'book': oku(c['book_yen']), 'rs': oku(c['rs_yen'])} for c in cmp]}, open('page-data.json', 'w'), ensure_ascii=False)
print(len(jig), 'jig;', sum(1 for c in cmp if c['book_yen'] == c['rs_yen']), '/', len(cmp), 'cmp ok')
for x in jig: print(x)
