# RS（2025 年度版）: 予算書の基金系の目に結ぶ事業、事業名・支出ブロック名に「基金」がある事業、その支出先
import csv, json, re, collections, sys
import unicodedata as _ud
def read_rs_rows(path):
    """RS の配布物（サイトの CSV）を、そのまま読む。見出しとセルを NFKC にし、セルの前後の空白を除く（`rs-spend-v0` を作るときと同じ。契約方式などの名前の全角のかっこを半角にそろえる）。(見出し, 行) を返す"""
    f = open(path, encoding='utf-8-sig', newline='')
    r = csv.reader(f)
    h = [_ud.normalize('NFKC', x).strip() for x in next(r)]
    return h, ([_ud.normalize('NFKC', x).strip() for x in row] + [''] * (len(h) - len(row)) for row in r)
def read_rs_dict(path):
    h, rows = read_rs_rows(path)
    return (dict(zip(h, row)) for row in rows)
D='/Users/igomuni/orca/nihon-no-yosan/data/download/rs/2025/'
def cls(name):
    if re.search(r'特別会計へ繰入|運営費交付金|分担金|拠出金|給付費負担金|事務局|国際交流基金|年金基金', name): return None
    if re.search(r'基金', name) or re.search(r'造成費(補助金|交付金)', name): return 'fund'
    if re.search(r'出資金', name): return 'invest'
    if re.search(r'資金へ繰入', name): return 'reserve'
    return None
# 2-2: 事業 × 予算年度 × 予算種別 × 項・目
by_cls=collections.defaultdict(lambda: collections.defaultdict(int)); jig_cls=collections.defaultdict(set); names={}
cand_moku=set(json.load(open('f3.json'))['list'] and [x['name'] for x in json.load(open('f3.json'))['list']])
cand_jig=collections.defaultdict(set)
if True:
    for r in read_rs_dict(D+'2-2_RS_2025_予算・執行_予算種別・歳出予算項目.csv'):
        names[r['予算事業ID']]=(r['事業名'],r['府省庁'])
        if r['会計区分']!='一般会計': continue
        c=cls(r['目'] or '')
        y=r['予算年度']; amt=int(r['予算額(歳出予算項目ごと)'] or 0) if (r['予算額(歳出予算項目ごと)'] or '').lstrip('-').isdigit() else 0
        if c:
            by_cls[(c,y)][r['予算種別'] or '（空）']+=amt; jig_cls[(c,y)].add(r['予算事業ID'])
        if r['目'] in cand_moku: cand_jig[(r['目'],y)].add(r['予算事業ID'])
res={'by_cls':{f'{c}|{y}':dict(v) for (c,y),v in by_cls.items()},'jig_cls':{f'{c}|{y}':sorted(v) for (c,y),v in jig_cls.items()}}
fund_ids=set().union(*[v for (c,y),v in jig_cls.items() if c=='fund' and y in('2024','2025')]) if jig_cls else set()
name_ids={i for i,(n,_) in names.items() if '基金' in n}
# 5-1: 支出ブロック名に「基金」、基金系事業の支出先（1 段目のブロック）
blk_ids=set(); recips=collections.defaultdict(int); recip_kind=collections.defaultdict(int)
if True:
    for r in read_rs_dict(D+'5-1_RS_2025_支出先_支出情報.csv'):
        i=r['予算事業ID']
        if '基金' in (r['支出先ブロック名'] or '') or '基金' in (r['事業を行う上での役割'] or ''): blk_ids.add(i)
        if i in fund_ids and r['支出先ブロック番号'] and r['支出先ブロック番号'][:1]=='A' and r['支出先名'] and r['法人番号'] and r['法人番号']!='9999999999999':
            v=r['支出先の合計支出額']; 
            if v and v.lstrip('-').isdigit(): recips[(r['支出先名'],r['法人種別'])]+=int(v)
res['fund_ids_2024_25']=len(fund_ids); res['name_ids']=len(name_ids); res['blk_ids']=len(blk_ids)
res['overlap']={'name&fund':len(name_ids&fund_ids),'blk&fund':len(blk_ids&fund_ids),'any':len(name_ids|blk_ids|fund_ids)}
res['recips']=sorted([[n,k,v] for (n,k),v in recips.items()],key=lambda x:-x[2])[:40]
res['cand']={f'{m}|{y}':[[i,names[i][0],names[i][1],(i in blk_ids)] for i in sorted(ids)] for (m,y),ids in cand_jig.items()}
f3=json.load(open('f3.json'))['list']
ev=[];nov=[];nolink=[]
for x in f3:
    k=f"{x['name']}|{x['year']}"
    if k not in res['cand']: nolink.append(x); continue
    (ev if any(e[3] for e in res['cand'][k]) else nov).append({**x,'jig':[e[1] for e in res['cand'][k] if e[3]] or [e[1] for e in res['cand'][k]]})
res['cand_ev']={'evidence':ev,'no_evidence':nov,'not_linked':nolink}
print('候補 RS で基金の記載あり', len(ev), round(sum(x['supp'] for x in ev)/1e9,2), '記載なし', len(nov), round(sum(x['supp'] for x in nov)/1e9,2), 'RS に結べない（年度の範囲外を含む）', len(nolink), round(sum(x['supp'] for x in nolink)/1e9,2))
for x in sorted(ev,key=lambda x:-x['supp']): print(' ',x['year'],round(x['supp']/1e9,3),x['name'],'←',x['jig'][:2])
json.dump(res,open('f4.json','w'),ensure_ascii=False)
print(json.dumps({k:res[k] for k in ['fund_ids_2024_25','name_ids','blk_ids','overlap']},ensure_ascii=False))
for k,v in sorted(res['by_cls'].items()): print(k, {a:round(b/1e12,3) for a,b in v.items()}, len(res['jig_cls'][k]))
for r in res['recips'][:12]: print(r[0],r[1],round(r[2]/1e8,1),'億')
for m,l in list(res['cand'].items())[:12]: print(m, [(x[1][:30],x[3]) for x in l][:3])
