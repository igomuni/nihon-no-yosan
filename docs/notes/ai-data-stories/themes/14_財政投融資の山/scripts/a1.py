# 財政投融資特別会計: 項ごとの当初・補正後（最後の回）・決算（FY2017〜FY2026）
import csv, json, os, glob
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset/'
H=R+'mof-history-v0/mof-archive/'; F=R+'reference-v0/mof-archive/'
def src(y):
    if y<=2022: return dict(budget=H+str(y), supp=H+str(y), settle=H+str(y))
    if y<=2024: return dict(budget=F+str(y), supp=F+str(y), settle=F+str(y))
    if y==2025: return dict(budget=F+'2025_teishutsu', supp=F+'2025', settle=None)
    return dict(budget=F+'2026', supp=None, settle=None)
def rd(p):
    if not os.path.exists(p): return None
    return list(csv.DictReader(open(p,encoding='utf-8')))
def col(r,pred):
    c=[k for k in r[0] if pred(k)]; assert len(c)==1,(c,list(r[0])); return c[0]
out={}
for y in range(2017,2027):
    s=src(y); rows={}
    b=rd(s['budget']+'/kou-special.csv')
    cb=col(b,lambda k:('予定額' in k or '要求額' in k) and '合計' in k and '前年度' not in k)
    cp=col(b,lambda k:k.startswith('前年度予算額'))
    for r in b:
        if r['特別会計']!='財政投融資': continue
        key=(r['勘定'],r['項コード'],r['項名'])
        rows[key]={'acct':r['勘定'],'code':r['項コード'],'name':r['項名'],'budget':int(r[cb] or 0)*1000,'prev':int(r[cp] or 0)*1000}
    # 補正（回ごと。最後の回の改予定額、差引額は全回の和）
    rounds=[]
    if s['supp']:
        p=s['supp']+'/kou-special-hosei.csv'
        n=1
        while True:
            q=rd(p if n==1 else s['supp']+f'/kou-special-hosei-{n}.csv')
            if q is None: break
            rounds.append(q); n+=1
    for ri,q in enumerate(rounds):
        cr=col(q,lambda k:k.startswith('改')); cn=col(q,lambda k:k.startswith('補正予定差引額'))
        for r in q:
            if r['特別会計']!='財政投融資': continue
            key=(r['勘定'],r['項コード'],r['項名'])
            d=rows.setdefault(key,{'acct':r['勘定'],'code':r['項コード'],'name':r['項名'],'budget':None,'prev':None})
            d['revised']=int(r[cr] or 0)*1000; d['suppNet']=d.get('suppNet',0)+int(r[cn] or 0)*1000; d['suppRound']=ri+1
    if s['settle']:
        k=rd(s['settle']+'/kou-special-kessan.csv')
        names={'歳出予算額':'appr','前年度繰越額':'cin','予備費使用額':'res','予算総則の規定による経費増額':'rule','流用等増△減額':'ryu','予算決定後移替増△減額':'iga','歳出予算現額':'cur','支出済歳出額':'spent','翌年度繰越額':'cout','不用額':'unused'}
        cols={v:col(k,lambda c,n=n:c.startswith(n)) for n,v in names.items()}
        for r in k:
            if r['特別会計']!='財政投融資': continue
            key=(r['勘定'],r['項コード'],r['項名'])
            d=rows.setdefault(key,{'acct':r['勘定'],'code':r['項コード'],'name':r['項名'],'budget':None,'prev':None})
            for v,c in cols.items(): d[v]=int(r[c] or 0)
    out[y]={'rounds':len(rounds),'rows':list(rows.values())}
json.dump(out,open('a1.json','w'),ensure_ascii=False)
t=lambda v:'-' if v is None else f'{v/1e12:.2f}'
for y,o in out.items():
    print(f'== FY{y} 補正回数 {o["rounds"]}')
    for d in sorted(o['rows'],key=lambda d:(d['acct'],d['code'])):
        if max(abs(d.get(k) or 0) for k in ['budget','revised','cur','spent'])<5e10: continue
        print(f"  {d['acct'][:6]} {d['code']} {d['name'][:22]:<22} 当初{t(d['budget'])} 前年{t(d['prev'])} 補正後{t(d.get('revised'))} 現額{t(d.get('cur'))} 支出{t(d.get('spent'))} 繰越{t(d.get('cout'))} 不用{t(d.get('unused'))}")
