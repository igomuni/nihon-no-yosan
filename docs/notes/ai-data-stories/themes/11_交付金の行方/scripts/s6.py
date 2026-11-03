# 検算と、LP に埋め込むデータ
import json
s1 = json.load(open('s1.json')); s2 = json.load(open('s2.json')); s4 = json.load(open('s4.json')); s5 = json.load(open('s5.json'))
T = 1e12
# (1) 予算書の補正後（内閣府の項） = 決算の歳出予算額（内閣府 + 総務省）
for st, name in (('covid', '新型コロナウイルス感染症対応地方創生推進費'), ('price', '物価高騰対応地方創生推進費')):
    for y in range(2020, 2025):
        bud = [x for x in s5 if x['y'] == y and x['name'] == name and x['min'] == '内閣府']
        ap = sum(r['approp'] for r in s1['kou'] if r['y'] == y and r['stream'] == st)
        if not bud: continue
        rv = bud[0]['revised'] if bud[0]['revised'] is not None else bud[0]['budget']
        print('補正後 = 決算の歳出予算額', st, y, rv, ap, rv == ap)
# (2) RS 2-1 と決算（2 項の和）
rsmap = {'covid': '122', 'price': '7629'}
for st, rid in rsmap.items():
    for a in s4[rid]['amounts']:
        y = a[1]
        rows = [r for r in s1['kou'] if r['y'] == y and r['stream'] == st]
        if not rows: print('RS のみ', st, y, [round((v or 0) / T, 4) for v in a[2:9]]); continue
        k = {c: sum(r[c] for r in rows) for c in ['approp', 'cin', 'res', 'spent', 'cout', 'unused']}
        cmp = {'補正': (a[3], k['approp']), '前年度繰越': (a[4], k['cin']), '予備費': (a[5], k['res']), '支出': (a[7], k['spent']), '翌年度繰越': (a[8], k['cout'])}
        print('RS vs 決算', st, y, {n: (round(p / T, 4), round(q / T, 4), abs(p - q)) for n, (p, q) in cmp.items()})
# LP のデータ
years = {}
for st in ('covid', 'price'):
    ys = []
    for y in range(2020, 2025):
        rows = [r for r in s1['kou'] if r['y'] == y and r['stream'] == st]
        if not rows: continue
        g = lambda m, c: sum(r[c] for r in rows if r['min'] == m)
        ys.append({'y': y, 'supp': sum(r['approp'] for r in rows), 'res': sum(r['res'] for r in rows), 'cin': sum(r['cin'] for r in rows),
                   'spent': sum(r['spent'] for r in rows), 'unused': sum(r['unused'] for r in rows), 'cout': sum(r['cout'] for r in rows),
                   'cao': {c: g('内閣府', c) for c in ['approp', 'cin', 'res', 'flow', 'mov', 'cur', 'spent', 'cout', 'unused']},
                   'soumu': {c: g('総務省', c) for c in ['approp', 'cin', 'res', 'flow', 'mov', 'cur', 'spent', 'cout', 'unused']}})
    years[st] = ys
mk = {}
for r in s1['moku']:
    a = mk.setdefault(r['moku'], {'stream': r['stream'], 'approp': 0, 'res': 0, 'flow': 0, 'spent': 0, 'unused': 0, 'cout_last': 0, 'years': set()})
    for c in ['approp', 'res', 'flow', 'spent', 'unused']: a[c] += r[c]
    a['years'].add(r['y'])
for m, a in mk.items():
    last = max(a['years']); a['cout_last'] = sum(r['cout'] for r in s1['moku'] if r['moku'] == m and r['y'] == last); a['years'] = sorted(a['years'])
rs = {st: {'id': rid, 'name': s4[rid]['name'], 'amounts': s4[rid]['amounts'], 'links': s4[rid]['links']} for st, rid in rsmap.items()}
fy25 = [x for x in s5 if x['y'] >= 2025]
json.dump({'years': years, 'moku': mk, 'rs': rs, 'fy25': fy25, 'files': s1['files']}, open('page-data.json', 'w'), ensure_ascii=False)
print('ok')
