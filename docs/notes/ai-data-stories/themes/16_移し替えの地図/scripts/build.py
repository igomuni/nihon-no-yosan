import json,collections
rows=json.load(open('s1.json')); s2=json.load(open('s2.json')); s3=json.load(open('s3.json'))
Y=list(range(2017,2025))
oku=lambda v: round(v/1e8,1)
CATS=['臨時交付金','組織の新設・移管','配分（研究開発・地域振興など）']
bycat={c:[0]*len(Y) for c in CATS}; unk=[0]*len(Y)
for p in s2['pairs']:
    if p['g']==p['r']: continue
    bycat[p['cat']][p['y']-2017]+=p['v']
for u in s2['unknown']:
    if u['v']>0: unk[u['y']-2017]+=u['v']
same=[0]*len(Y)
for p in s2['pairs']:
    if p['g']==p['r']: same[p['y']-2017]+=p['v']
total=[sum(r['v'] for r in rows if r['y']==y and r['v']>0) for y in Y]
for i in range(len(Y)): assert total[i]==sum(bycat[c][i] for c in CATS)+unk[i]+same[i], (Y[i])
# 組
pg=collections.defaultdict(lambda:{'v':0,'ys':set(),'cats':set()})
for p in s2['pairs']:
    if p['g']==p['r']: continue
    k=(p['g'],p['r']); pg[k]['v']+=p['v']; pg[k]['ys'].add(p['y']); pg[k]['cats'].add(p['cat'])
pairs=sorted([dict(g=g,r=r,v=oku(d['v']),ys=sorted(d['ys']),cats=sorted(d['cats'])) for (g,r),d in pg.items()],key=lambda x:-x['v'])
# 項名ごとの年
kk=collections.defaultdict(lambda: collections.Counter())
for r in rows:
    if r['v']>0: kk[r['kou']][r['y']]+=r['v']
kous=sorted([dict(k=k,ys={y:oku(v) for y,v in sorted(c.items())},tot=oku(sum(c.values()))) for k,c in kk.items()],key=lambda x:-x['tot'])
trace=s3['trace']
eff=[dict(y=e['y'],u=e['u'],pre=round(e['pre']/1e12,3),tr=round(e['tr']/1e12,3),cur=round(e['cur']/1e12,3),spent=round(e['spent']/1e12,3)) for e in s3['eff'] if abs(e['tr'])>=1e10]
data=dict(Y=Y,cats=CATS,bycat={c:[oku(v) for v in bycat[c]] for c in CATS},unk=[oku(v) for v in unk],same=[oku(v) for v in same],total=[oku(v) for v in total],
  pairs=pairs,kous=kous,trace=[{k:(oku(v) if isinstance(v,int) and k not in('y',) else v) for k,v in d.items()} for d in trace],eff=eff,
  unknown=[dict(y=u['y'],u=u['u'],kou=u['kou'],moku=u['moku'],v=oku(u['v'])) for u in s2['unknown']],
  nrows=len(rows))
json.dump(data,open('page-data.json','w'),ensure_ascii=False)
print(data['total'],sum(data['total']))
print('臨時交付金の割合', sum(bycat['臨時交付金'])/sum(total))
print(json.dumps(pairs[:6],ensure_ascii=False))
print(json.dumps(kous[:14],ensure_ascii=False))
