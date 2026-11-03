# 4 つの基金の目を、当初・補正（回ごとの差引の和）・決算で年度ごとに集計。科学技術振興費（主要経費 13）の当初・補正も
import csv,glob,json,sys
ROOT='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
G={'kakushin':'革新的研究開発推進基金','uchu':'宇宙開発支援基金','sohatsu':'創発的研究推進基金','kaken':'学術研究助成基金'}
def grp(name):
    for k,t in G.items():
        if t in name: return k
    return None
def rd(y,f):
    fs=glob.glob(f'{ROOT}/*/mof-archive/{y}/{f}')
    return list(csv.DictReader(open(fs[0],encoding='utf-8'))) if fs else None
def col(r,pred):
    return [k for k in r[0] if pred(k)][0]
out={'years':list(range(2017,2027)),'g':{k:{} for k in G},'byMin':{},'sci':{},'rows':[]}
for y in out['years']:
    b=rd(y,'moku-general.csv')
    amt=col(b,lambda k:('要求額' in k or '予定額' in k) and '前年度' not in k)
    sci_b=0
    for x in b:
        v=int(x[amt] or 0)
        if x['主要経費別分類コード']=='13': sci_b+=v
        k=grp(x['目名'])
        if k:
            d=out['g'][k].setdefault(y,{}); d['budget']=d.get('budget',0)+v
            out['rows'].append([y,'当初',x['所管'],x['項名'],x['目名'],v])
    sci_s=0; rounds=0
    for f in ['moku-general-hosei.csv','moku-general-hosei-2.csv','moku-general-hosei-3.csv']:
        h=rd(y,f)
        if not h: continue
        rounds+=1
        c=col(h,lambda k:'差引額' in k)
        for x in h:
            v=int(x[c] or 0)
            if x.get('主要経費別分類コード')=='13': sci_s+=v
            k=grp(x['目名'])
            if k:
                d=out['g'][k].setdefault(y,{}); d['supp']=d.get('supp',0)+v
                out['rows'].append([y,f'補正{rounds}',x['所管'],x['項名'],x['目名'],v])
                m=out['byMin'].setdefault(k,{}); m[x['所管']]=m.get(x['所管'],0)+v
    out['sci'][y]={'budget':sci_b,'supp':sci_s if rounds else None,'rounds':rounds}
    s=rd(y,'moku-general-kessan.csv')
    if s:
        cols={n:col(s,lambda k,n=n:k.startswith(n)) for n in ['歳出予算額','前年度繰越額','歳出予算現額','支出済歳出額','翌年度繰越額','不用額']}
        for x in s:
            k=grp(x['目名'])
            if not k: continue
            d=out['g'][k].setdefault(y,{})
            for n,c in cols.items(): d['k_'+n]=d.get('k_'+n,0)+int(x[c] or 0)
            out['rows'].append([y,'決算',x['所管'],x['項名'],x['目名'],int(x[cols['支出済歳出額']])])
# budget 当初 by 所管 too
for x in out['rows']:
    if x[1]=='当初':
        k=grp(x[4]); m=out['byMin'].setdefault(k,{}); m[x[2]]=m.get(x[2],0)+x[5]
json.dump(out,open('s1.json','w'),ensure_ascii=False)
t=lambda v:'-' if v is None else f'{v/1e9:.3f}'
for k in G:
    print('==',G[k])
    for y in out['years']:
        d=out['g'][k].get(y)
        if not d: continue
        print(y,'当初',t(d.get('budget')),'補正',t(d.get('supp')),'| 決算 歳出予算額',t((d.get('k_歳出予算額') or 0)/1000) if 'k_歳出予算額' in d else '-', '支出',t(d['k_支出済歳出額']/1000) if 'k_支出済歳出額' in d else '-','繰越',t(d['k_翌年度繰越額']/1000) if 'k_翌年度繰越額' in d else '-','不用',t(d['k_不用額']/1000) if 'k_不用額' in d else '-','前繰',t(d['k_前年度繰越額']/1000) if 'k_前年度繰越額' in d else '-')
print('== 科学技術振興費(13)')
for y,d in out['sci'].items(): print(y,t(d['budget']),t(d['supp']),d['rounds'])
print('byMin',{k:{m:round(v/1e9,3) for m,v in d.items()} for k,d in out['byMin'].items()})
