# 目名で資金繰り支援の候補を探す（一般会計、FY2019〜FY2024）。目ごと・年度ごとの当初・補正・決算
import csv, json, os, re
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset/'
H=R+'mof-history-v0/mof-archive/'; F=R+'reference-v0/mof-archive/'
def base(y): return (H if y<=2022 else F)+str(y)
def rd(p):
    if not os.path.exists(p): return None
    return list(csv.DictReader(open(p,encoding='utf-8')))
def col(r,pred):
    c=[k for k in r[0] if pred(k)]; assert len(c)==1,(c,list(r[0])); return c[0]
PAT=re.compile(r'日本政策金融公庫出資金|商工組合中央金庫出資金|危機対応円滑化業務出資金|保証|利子補給|持続化給付金|家賃支援給付金|資金繰り|事業再構築|経営安定')
def key(r): return (r['所管'],r['組織'],r['項名'],r['目名'])
out={}
for y in range(2019,2025):
    rows={}
    b=rd(base(y)+'/moku-general.csv'); cb=col(b,lambda k:('予定額' in k or '要求額' in k) and '前年度' not in k)
    for r in b:
        if PAT.search(r['目名']): rows[key(r)]={'k':list(key(r)),'budget':int(r[cb] or 0)*1000}
    n=1
    while True:
        q=rd(base(y)+(f'/moku-general-hosei.csv' if n==1 else f'/moku-general-hosei-{n}.csv'))
        if q is None: break
        cn=col(q,lambda k:k.startswith('補正') and '差引' in k)
        for r in q:
            if r.get('目名') and PAT.search(r['目名']):
                d=rows.setdefault(key(r),{'k':list(key(r)),'budget':None}); d.setdefault('rounds',{}); d['rounds'][str(n)]=d['rounds'].get(str(n),0)+int(r[cn] or 0)*1000
        n+=1
    kk=rd(base(y)+'/moku-general-kessan.csv')
    names={'歳出予算額':'appr','前年度繰越額':'cin','予備費使用額':'res','流用等増△減額':'ryu','予算決定後移替増△減額':'iga','歳出予算現額':'cur','支出済歳出額':'spent','翌年度繰越額':'cout','不用額':'unused'}
    cols={v:col(kk,lambda c,n=n:c.startswith(n)) for n,v in names.items()}
    for r in kk:
        if PAT.search(r['目名']):
            d=rows.setdefault(key(r),{'k':list(key(r)),'budget':None})
            for v,c in cols.items(): d[v]=d.get(v,0)+int(r[c] or 0)
    out[y]=list(rows.values())
json.dump(out,open('c3.json','w'),ensure_ascii=False)
# 目ごとに FY2020〜FY2024 を束ねる
agg={}
for y,rs in out.items():
    for d in rs:
        a=agg.setdefault(tuple(d['k']),{})
        a[y]=d
t=lambda v:f'{v/1e12:.3f}'
rows=[]
for k,a in agg.items():
    inflow=sum((a[y].get('appr',0)+a[y].get('res',0)+a[y].get('ryu',0)+a[y].get('iga',0)) for y in a if 2020<=y<=2024)
    supp=sum(sum((a[y].get('rounds') or {}).values()) for y in a if 2020<=y<=2022)
    sp=sum(a[y].get('spent',0) for y in a if 2020<=y<=2024); un=sum(a[y].get('unused',0) for y in a if 2020<=y<=2024)
    if max(inflow,supp,sp)<1e10: continue
    rows.append((k,inflow,supp,sp,un,a.get(2024,{}).get('cout',0),a.get(2019,{}).get('cur',0)))
for k,i,s,sp,un,co,c19 in sorted(rows,key=lambda r:-r[1]):
    print(k[0][:5],k[2][:16],'|',k[3][:34],'入り',t(i),'補正(20-22)',t(s),'支出',t(sp),'不用',t(un),'24末繰越',t(co),'19現額',t(c19))
