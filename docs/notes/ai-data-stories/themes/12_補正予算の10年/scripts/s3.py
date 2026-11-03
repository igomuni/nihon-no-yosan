# 一般会計の補正: 回ごとの全行を足す（項・事項・目）。年度×主要経費別・府省・項・事項の追加・減少・差引
import csv, os, json, re, collections
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
N=json.load(open('names.json'))
PUB=set(N['publishers'])
def rounds(y,kind):
    out=[]
    for base in ['reference-v0','mof-history-v0']:
        d=f'{R}/{base}/mof-archive/{y}'
        if not os.path.exists(f'{d}/{kind}-general-hosei.csv'): continue
        for r in range(1,5):
            f=f'{d}/{kind}-general-hosei.csv' if r==1 else f'{d}/{kind}-general-hosei-{r}.csv'
            if os.path.exists(f): out.append((r,f))
        return out
    return out
def num(x): return int(x or 0)
def cols(h):
    c=lambda k:[x for x in h if k in x][0]
    return c('追加額'),c('修正減少額'),c('差引額')
def group(ministry,org):
    if ministry=='内閣府' and org!='内閣府' and org in PUB: return org
    return re.split('、|及び',ministry)[0]
Y=list(range(2017,2027))
res={'years':Y,'year':{},'major':collections.defaultdict(lambda:collections.defaultdict(lambda:[0,0,0])),
     'group':collections.defaultdict(lambda:collections.defaultdict(lambda:[0,0,0])),'kou':{}, 'jikou':{}, 'debt':{}, 'corona':{}, 'reserve':{}}
for y in Y:
    # 目
    for r,f in rounds(y,'moku'):
        rows=list(csv.DictReader(open(f,encoding='utf-8'))); ca,cr,cn=cols(list(rows[0].keys()))
        for x in rows:
            a,b,n=num(x[ca]),num(x[cr]),num(x[cn])
            if not (a or b or n): continue
            m=x['主要経費別分類コード'] or '(なし)'
            for key,dct in [(m,res['major']),(group(x['所管'],x['組織']),res['group'])]:
                t=dct[key][y]; t[0]+=a; t[1]+=b; t[2]+=n
    # 項
    kou=collections.defaultdict(lambda:[0,0,0]); tot=[0,0,0]; nr=0
    for r,f in rounds(y,'kou'):
        nr+=1
        rows=list(csv.DictReader(open(f,encoding='utf-8'))); ca,cr,cn=cols(list(rows[0].keys()))
        for x in rows:
            a,b,n=num(x[ca]),num(x[cr]),num(x[cn])
            k=f"{group(x['所管'],x['組織'])}|{x['項名']}"
            kou[k][0]+=a; kou[k][1]+=b; kou[k][2]+=n; tot[0]+=a; tot[1]+=b; tot[2]+=n
    res['year'][y]={'rounds':nr,'add':tot[0],'red':tot[1],'net':tot[2]}
    res['kou'][y]=sorted([[k,*v] for k,v in kou.items() if v[0] or v[1]],key=lambda z:-z[1])
    # 事項
    jk=collections.defaultdict(lambda:[0,0,0]); debt=collections.defaultdict(lambda:[0,0,0]); cor=[0,0,0]
    for r,f in rounds(y,'jikou'):
        rows=list(csv.DictReader(open(f,encoding='utf-8'))); ca,cr,cn=cols(list(rows[0].keys()))
        for x in rows:
            a,b,n=num(x[ca]),num(x[cr]),num(x[cn])
            if not (a or b): continue
            k=f"{group(x['所管'],x['組織'])}|{x['項名']}|{x['事項名']}"
            jk[k][0]+=a; jk[k][1]+=b; jk[k][2]+=n
            if x['項名']=='国債費':
                d=debt[x['事項名']]; d[0]+=a; d[1]+=b; d[2]+=n
            if re.search('コロナ|感染症',x['事項名']+x['項名']):
                cor[0]+=a; cor[1]+=b; cor[2]+=n
    res['jikou'][y]=sorted([[k,*v] for k,v in jk.items()],key=lambda z:-z[1])
    res['debt'][y]={k:v for k,v in debt.items()}
    res['corona'][y]=cor
res['major']={k:{y:v for y,v in d.items()} for k,d in res['major'].items()}
res['group']={k:{y:v for y,v in d.items()} for k,d in res['group'].items()}
json.dump(res,open('s3.json','w'),ensure_ascii=False)
T=lambda v:round(v/1e9,2)
for y in Y: print(y,res['year'][y]['rounds'],'回 追加',T(res['year'][y]['add']),'減少',T(res['year'][y]['red']),'差引',T(res['year'][y]['net']),'| コロナ・感染症の事項 追加',T(res['corona'][y][0]),'減少',T(res['corona'][y][1]))
print('\n主要経費（追加のある年数, 10年の追加計, 減少計）')
for c,d in sorted(res['major'].items(),key=lambda kv:-sum(v[0] for v in kv[1].values())):
    yrs=sum(1 for v in d.values() if v[0]>0)
    nm=N['major'].get('2024',{}).get(c,{}).get('name') or N['major'].get('2020',{}).get(c,{}).get('name') or c
    print(c,nm[:20],yrs,'年 追加',T(sum(v[0] for v in d.values())),'減少',T(sum(v[1] for v in d.values())),'|',' '.join(f"{y%100}:{T(d[y][2]) if y in d else '-'}" for y in Y))
