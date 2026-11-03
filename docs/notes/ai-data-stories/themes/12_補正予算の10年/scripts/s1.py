# 補正の回ごとの一般会計の規模（項の CSV）と恒等式
import csv, glob, json, os
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def dirof(y):
    for base in ['reference-v0','mof-history-v0']:
        d=f'{R}/{base}/mof-archive/{y}'
        if os.path.exists(f'{d}/kou-general-hosei.csv'): return d
out={}
for y in range(2017,2027):
    d=dirof(y); rounds=[]
    for r in range(1,5):
        f=f'{d}/kou-general-hosei.csv' if r==1 else f'{d}/kou-general-hosei-{r}.csv'
        if not os.path.exists(f): break
        rows=list(csv.DictReader(open(f,encoding='utf-8')))
        h=list(rows[0].keys())
        c=lambda k:[x for x in h if k in x][0]
        cb,ca,cr,cn,cv=c('成立予算額'),c('追加額'),c('修正減少額'),c('差引額'),[x for x in h if x.startswith('改')][0]
        s={k:sum(int(x[col] or 0) for x in rows) for k,col in [('base',cb),('add',ca),('red',cr),('net',cn),('rev',cv)]}
        bad1=sum(1 for x in rows if int(x[cb] or 0)+int(x[cn] or 0)!=int(x[cv] or 0))
        bad2=sum(1 for x in rows if int(x[ca] or 0)+int(x[cr] or 0)!=int(x[cn] or 0))
        s.update(n=len(rows),bad_rev=bad1,bad_net=bad2,file=os.path.relpath(f,R))
        rounds.append(s)
    out[y]=rounds
    for i,s in enumerate(rounds,1):
        print(y,f'第{i}回',s['n'],'項 成立',round(s['base']/1e9,2),'追加',round(s['add']/1e9,2),'減少',round(s['red']/1e9,2),'差引',round(s['net']/1e9,2),'改',round(s['rev']/1e9,2),'恒等式NG',s['bad_rev'],s['bad_net'])
json.dump(out,open('s1.json','w'),ensure_ascii=False)
