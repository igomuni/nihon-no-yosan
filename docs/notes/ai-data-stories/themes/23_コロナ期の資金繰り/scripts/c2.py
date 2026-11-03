# 対象の項の目: 当初・補正（回ごと）・決算（FY2019〜FY2024）
import csv, json, os
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset/'
H=R+'mof-history-v0/mof-archive/'; F=R+'reference-v0/mof-archive/'
def base(y): return (H if y<=2022 else F)+str(y)
def rd(p):
    if not os.path.exists(p): return None
    return list(csv.DictReader(open(p,encoding='utf-8')))
def col(r,pred):
    c=[k for k in r[0] if pred(k)]; assert len(c)==1,(c,list(r[0])); return c[0]
KOU_G={('財務省','政策金融費'),('経済産業省','中小企業事業環境整備費'),('経済産業省','経営革新・創業促進費'),('経済産業省','独立行政法人中小企業基盤整備機構運営費'),('経済産業省','技術革新促進・環境整備費'),('経済産業省','サービス産業強化費'),('財務省','産業投資支出財政投融資特別会計へ繰入'),('経済産業省','中小企業金融対策費'),('経済産業省','中小企業経営支援等対策費')}
KOU_S={('財政投融資','財政融資資金へ繰入'),('財政投融資','産業投資支出')}
def hit(acct,r):
    if acct=='general': return (r['所管'],r['項名']) in KOU_G
    return (r['特別会計'],r['項名']) in KOU_S
out={}
for y in range(2019,2025):
    rows={}
    for acct in ['general','special']:
        def key(r): return (acct,r['所管'] if acct=='general' else r['特別会計'],r['組織'] if acct=='general' else r['勘定'],r['項名'],r['目名'])
        b=rd(base(y)+f'/moku-{acct}.csv')
        cb=col(b,lambda k:('予定額' in k or '要求額' in k) and '前年度' not in k)
        for r in b:
            if hit(acct,r): rows[key(r)]={'k':list(key(r)),'budget':int(r[cb] or 0)*1000}
        n=1
        while True:
            q=rd(base(y)+(f'/moku-{acct}-hosei.csv' if n==1 else f'/moku-{acct}-hosei-{n}.csv'))
            if q is None: break
            cn=col(q,lambda k:k.startswith('補正') and '差引' in k)
            for r in q:
                if hit(acct,r) and r.get('目名'):
                    d=rows.setdefault(key(r),{'k':list(key(r)),'budget':None}); d.setdefault('rounds',{})[n]=d.get('rounds',{}).get(n,0)+int(r[cn] or 0)*1000
            n+=1
        kk=rd(base(y)+f'/moku-{acct}-kessan.csv')
        if kk:
            names={'歳出予算額':'appr','前年度繰越額':'cin','予備費使用額':'res','流用等増△減額':'ryu','予算決定後移替増△減額':'iga','歳出予算現額':'cur','支出済歳出額':'spent','翌年度繰越額':'cout','不用額':'unused'}
            cols={v:col(kk,lambda c,n=n:c.startswith(n)) for n,v in names.items()}
            for r in kk:
                if hit(acct,r):
                    d=rows.setdefault(key(r),{'k':list(key(r)),'budget':None})
                    for v,c in cols.items(): d[v]=d.get(v,0)+int(r[c] or 0)
    out[y]=list(rows.values())
json.dump(out,open('c2.json','w'),ensure_ascii=False)
t=lambda v:'-' if v is None else f'{v/1e12:.3f}'
for y in [2020,2021,2022]:
    print('== FY',y)
    for d in sorted(out[y],key=lambda d:-max(abs(d.get('cur') or 0),abs(sum((d.get('rounds') or {}).values())))):
        s=sum((d.get('rounds') or {}).values()) if d.get('rounds') else None
        if max(abs(d.get('cur') or 0),abs(s or 0),abs(d['budget'] or 0))<2e10: continue
        print(' ',d['k'][1][:5],d['k'][3][:14],'|',d['k'][4][:34],'当初',t(d['budget']),'補正',t(s),{k:round(v/1e12,3) for k,v in (d.get('rounds') or {}).items()},'現額',t(d.get('cur')),'支出',t(d.get('spent')),'繰越',t(d.get('cout')),'不用',t(d.get('unused')),'前繰',t(d.get('cin')))
