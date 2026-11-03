# 一般会計・特別会計の項: 当初・補正（全回の差引の和、最後の回の改予算額）・決算（FY2019〜FY2024）
import csv, json, os, sys
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset/'
H=R+'mof-history-v0/mof-archive/'; F=R+'reference-v0/mof-archive/'
def src(y):
    if y<=2022: return dict(budget=H+str(y), supp=H+str(y), settle=H+str(y))
    if y<=2024: return dict(budget=F+str(y), supp=F+str(y), settle=F+str(y))
    if y==2025: return dict(budget=F+'2025_teishutsu', supp=F+'2025', settle=None)
    return dict(budget=F+'2026', supp=F+'2026', settle=None)
def rd(p):
    if not os.path.exists(p): return None
    return list(csv.DictReader(open(p,encoding='utf-8')))
def col(r,pred):
    c=[k for k in r[0] if pred(k)]; assert len(c)==1,(c,list(r[0])); return c[0]
def keyof(acct,r):
    if acct=='general': return ('general',r['所管'],r['組織'],r['項コード'],r['項名'])
    return ('special',r['特別会計'],r['勘定'],r['項コード'],r['項名'])
out={}
for y in range(2019,2027):
    s=src(y); rows={}
    for acct in ['general','special']:
        b=rd(s['budget']+f'/kou-{acct}.csv')
        cb=col(b,lambda k:('予定額' in k or '要求額' in k) and '合計' in k and '前年度' not in k)
        for r in b:
            k=keyof(acct,r); rows[k]={'k':list(k),'budget':int(r[cb] or 0)*1000}
        n=1
        while s['supp']:
            q=rd(s['supp']+(f'/kou-{acct}-hosei.csv' if n==1 else f'/kou-{acct}-hosei-{n}.csv'))
            if q is None: break
            cr=col(q,lambda k:k.startswith('改')); cn=col(q,lambda k:k.startswith('補正') and '差引' in k)
            for r in q:
                if acct=='special' and not r.get('項名'): continue
                k=keyof(acct,r); d=rows.setdefault(k,{'k':list(k),'budget':None})
                d['revised']=int(r[cr] or 0)*1000; d['suppNet']=d.get('suppNet',0)+int(r[cn] or 0)*1000
                d.setdefault('rounds',{})[n]=int(r[cn] or 0)*1000
            n+=1
        if s['settle']:
            kk=rd(s['settle']+f'/kou-{acct}-kessan.csv')
            names={'歳出予算額':'appr','前年度繰越額':'cin','予備費使用額':'res','流用等増△減額':'ryu','予算決定後移替増△減額':'iga','歳出予算現額':'cur','支出済歳出額':'spent','翌年度繰越額':'cout','不用額':'unused'}
            cols={v:col(kk,lambda c,n=n:c.startswith(n)) for n,v in names.items()}
            for r in kk:
                k=keyof(acct,r); d=rows.setdefault(k,{'k':list(k),'budget':None})
                for v,c in cols.items(): d[v]=d.get(v,0)+int(r[c] or 0)
    out[y]=list(rows.values())
json.dump(out,open('c1.json','w'),ensure_ascii=False)
print({y:len(v) for y,v in out.items()})
