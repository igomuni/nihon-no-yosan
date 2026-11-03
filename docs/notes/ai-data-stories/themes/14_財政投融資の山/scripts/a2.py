# 集計と検算: 勘定別の当初・補正後・決算、主な項、補正の回ごと、決算の恒等式
import csv, json, os
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset/'
H=R+'mof-history-v0/mof-archive/'; F=R+'reference-v0/mof-archive/'
A=json.load(open('a1.json'))
Y=list(range(2017,2027))
res={'acct':{}, 'kou':{}, 'checks':[], 'rounds':{}, 'gen':{}}
# 補正後: 補正の行がある項はその改予定額、無い項は当初（補正の書に載らない = 変更なし）。補正の書が無い年度（FY2026）は null
for y in Y:
    o=A[str(y)]; rows=o['rows']
    for d in rows:
        a=d['acct']; e=res['acct'].setdefault(a,{})
        t=e.setdefault(str(y),{'budget':0,'revised':None,'cur':None,'spent':None,'cout':None,'unused':None,'cin':None})
        t['budget']+=d['budget'] or 0
        if o['rounds']>0:
            t['revised']=(t['revised'] or 0)+(d['revised'] if 'revised' in d else (d['budget'] or 0))
        if 'cur' in d:
            for k in ['cur','spent','cout','unused','cin']: t[k]=(t[k] or 0)+d[k]
            # 恒等式（項ごと、円）
            if d['cur']!=d['appr']+d['cin']+d['res']+d['rule']+d['ryu']+d['iga']: res['checks'].append(f'FY{y} {d["name"]} 現額の式が合わない')
            if d['cur']!=d['spent']+d['cout']+d['unused']: res['checks'].append(f'FY{y} {d["name"]} 現額=支出+繰越+不用 が合わない')
            # 決算の歳出予算額 = 補正後（千円→円）
            exp=(d['revised'] if 'revised' in d else d['budget'])
            if exp is not None and d['appr']!=exp: res['checks'].append(f'FY{y} {d["name"]} 歳出予算額 {d["appr"]} ≠ 補正後 {exp}')
        key=d['acct']+'|'+d['name']
        k2=res['kou'].setdefault(key,{})
        k2[str(y)]={k:d.get(k) for k in ['budget','prev','revised','cur','spent','cout','unused']}
        if o['rounds']>0 and 'revised' not in d: k2[str(y)]['revised']=d['budget']
# 補正の回ごと（財政融資資金へ繰入・国債整理基金特別会計へ繰入）
def rd(p): return list(csv.DictReader(open(p,encoding='utf-8'))) if os.path.exists(p) else None
for y in Y:
    base=(H if y<=2022 else F)+str(y)
    steps={}
    n=1
    while True:
        q=rd(base+('/kou-special-hosei.csv' if n==1 else f'/kou-special-hosei-{n}.csv'))
        if q is None: break
        cr=[k for k in q[0] if k.startswith('改')][0]; cb=[k for k in q[0] if '成立予算額' in k][0]
        for r in q:
            if r['特別会計']=='財政投融資' and r['勘定']=='財政融資資金勘定' and r['項コード'] in ('01','04'):
                steps.setdefault(r['項名'],[]).append({'round':n,'before':int(r[cb])*1000,'after':int(r[cr])*1000})
        n+=1
    if steps: res['rounds'][str(y)]=steps
json.dump(res,open('a2.json','w'),ensure_ascii=False)
t=lambda v:'   -  ' if v is None else f'{v/1e12:6.2f}'
for a,e in res['acct'].items():
    print('==',a)
    for y in Y:
        x=e.get(str(y))
        if x: print(f'  FY{y} 当初{t(x["budget"])} 補正後{t(x["revised"])} 現額{t(x["cur"])} 支出{t(x["spent"])} 繰越{t(x["cout"])} 不用{t(x["unused"])}')
print('checks', len(res['checks']), res['checks'][:10])
for y,s in res['rounds'].items():
    for n,l in s.items(): print(y,n,[(x['round'],round(x['before']/1e12,2),round(x['after']/1e12,2)) for x in l])
