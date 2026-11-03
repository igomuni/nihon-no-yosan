"""RS 2025 年度版: 4 つの基金の目が 2-2 に書かれた事業の、予算行・サマリ（FY2024 執行）・支出先（5-1・5-2、段の深さ）。出力 s2.json
使い方: python3 -I s2.py <RS の CSV のディレクトリ>"""
import csv, json, re, sys, collections
src = sys.argv[1]
rd = lambda name: csv.DictReader(open(f'{src}/{name}', encoding='utf-8-sig'))
num = lambda s: int(s) if re.fullmatch(r'-?\d+', s or '') else None
G = {'kakushin': '革新的研究開発推進基金', 'uchu': '宇宙開発支援基金', 'sohatsu': '創発的研究推進基金', 'kaken': '学術研究助成基金'}
grp = lambda m: next((k for k, t in G.items() if t in (m or '')), None)

# 2-2: 事業 × 予算年度 × 予算種別 × 目
jig, lines = {}, []
allrows = collections.defaultdict(list)
for r in rd('2-2_RS_2025_予算・執行_予算種別・歳出予算項目.csv'):
    allrows[r['予算事業ID']].append(r)
for i, rows in allrows.items():
    gs = {grp(r['目']) for r in rows} - {None}
    if not gs: continue
    jig[i] = {'id': i, 'name': rows[0]['事業名'], 'min': rows[0]['府省庁'], 'groups': sorted(gs)}
    for r in rows:
        lines.append({'id': i, 'year': num(r['予算年度']), 'kind': r['予算種別'], 'min': r['所管'], 'kou': r['項'], 'moku': r['目'], 'g': grp(r['目']), 'yen': num(r['予算額(歳出予算項目ごと)'])})
# 他の目を持つ事業か（基金以外の目の行）
for i in jig: jig[i]['otherMoku'] = sorted({l['moku'] for l in lines if l['id'] == i and not l['g'] and l['moku']})

# 2-1: 合計行（会計区分が空）
SUM = {}
for r in rd('2-1_RS_2025_予算・執行_サマリ.csv'):
    i = r['予算事業ID']
    if i in jig and not r['会計区分']:
        SUM.setdefault(i, {})[num(r['予算年度'])] = {k: num(r[k]) for k in r if k.endswith('(合計)') or '執行額' in k}
for i in jig: jig[i]['sum'] = SUM.get(i, {})

# 5-2: 段の深さ
org_to, edges = collections.defaultdict(set), collections.defaultdict(set)
for r in rd('5-2_RS_2025_支出先_支出ブロックのつながり.csv'):
    i = r['予算事業ID']
    if i not in jig: continue
    if r['担当組織からの支出'] == 'TRUE' and r['支出先の支出先ブロック']: org_to[i].add(r['支出先の支出先ブロック'])
    elif r['支出元の支出先ブロック'] and r['支出先の支出先ブロック']: edges[(i, r['支出元の支出先ブロック'])].add(r['支出先の支出先ブロック'])
depth = {}
for i, fs in org_to.items():
    q = [(b, 1) for b in sorted(fs)]
    while q:
        b, d = q.pop(0)
        if (i, b) in depth and depth[(i, b)] <= d: continue
        depth[(i, b)] = d
        for nb in edges.get((i, b), ()): q.append((nb, d + 1))

# 5-1: ブロックと支出先（名前は法人番号のある法人だけ）
blocks, recs = {}, []
for r in rd('5-1_RS_2025_支出先_支出情報.csv'):
    i, b = r['予算事業ID'], r['支出先ブロック番号']
    if i not in jig: continue
    if (r['支出先ブロック名'] or r['ブロックの合計支出額']) and not r['支出先名']:
        blocks[(i, b)] = {'id': i, 'b': b, 'bname': r['支出先ブロック名'], 'role': r['事業を行う上での役割'], 'n': num(r['支出先の数']), 'amt': num(r['ブロックの合計支出額']), 'd': depth.get((i, b))}
    elif r['支出先名'] and r['支出先の合計支出額']:
        named = bool(re.fullmatch(r'\d{13}', r['法人番号'] or '')) and r['法人番号'] != '9999999999999' and r['その他支出先'] != 'TRUE'
        recs.append({'id': i, 'b': b, 'name': r['支出先名'] if named else None, 'hno': r['法人番号'] if named else None, 'amt': num(r['支出先の合計支出額']), 'd': depth.get((i, b))})
out = {'jig': jig, 'lines': lines, 'blocks': list(blocks.values()), 'recs': recs}
json.dump(out, open('s2.json', 'w'), ensure_ascii=False)
t = lambda v: '-' if v is None else f'{v/1e8:,.1f}億'
for i, j in sorted(jig.items(), key=lambda kv: kv[1]['min']):
    s24 = j['sum'].get(2024, {})
    bl = [x for x in blocks.values() if x['id'] == i]
    d1 = sum(x['amt'] or 0 for x in bl if x['d'] == 1)
    print(i, j['min'], j['name'][:30], j['groups'], '他の目', len(j['otherMoku']), '| FY24 執行', t(s24.get('執行額(合計)')), '1段目', t(d1), '最深', max([x['d'] or 0 for x in bl] or [0]))
    for x in sorted(bl, key=lambda x: (x['d'] or 9, x['b']))[:5]:
        names = [r['name'] for r in recs if r['id'] == i and r['b'] == x['b'] and r['name']][:3]
        print('   ', x['d'], x['b'], (x['bname'] or '')[:24], t(x['amt']), names)
