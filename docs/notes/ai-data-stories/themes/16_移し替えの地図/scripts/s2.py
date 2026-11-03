import csv,glob,json,collections
D='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
rows=json.load(open('s1.json'))
def unit(mn,org):
    if mn=='内閣府' and (org.endswith('庁') or org.endswith('委員会')): return org
    return mn
for r in rows: r['u']=unit(r['min'],r['org'])
# --- 対応づけ: 目名 → 項名 → 対応不明
pairs=[]; unknown=[]
def settle(group,level,y,key):
    givers=collections.defaultdict(int); recv=collections.defaultdict(int)
    for r in group:
        (givers if r['v']<0 else recv)[r['u']]+= r['v']
    tot=sum(r['v'] for r in group)
    if tot!=0 or not givers or not recv: return False
    if len(givers)==1:
        g=next(iter(givers))
        for u,v in recv.items(): pairs.append(dict(y=y,g=g,r=u,v=v,level=level,key=key))
    elif len(recv)==1:
        rr=next(iter(recv))
        for u,v in givers.items(): pairs.append(dict(y=y,g=u,r=rr,v=-v,level=level,key=key))
    else:
        return False
    return True
for y in range(2017,2025):
    ys=[r for r in rows if r['y']==y]
    left=[]
    for k,grp in collections.defaultdict(list,{}).items(): pass
    bym=collections.defaultdict(list)
    for r in ys: bym[r['moku']].append(r)
    for k,grp in bym.items():
        if not settle(grp,'目名',y,k): left+=grp
    byk=collections.defaultdict(list)
    for r in left: byk[r['kou']].append(r)
    left2=[]
    for k,grp in byk.items():
        if not settle(grp,'項名',y,k): left2+=grp
    # 年度の残りを、残りの全体で 1 対多なら対応づけ
    if left2 and not settle(left2,'年度の残り',y,'(残り)'):
        unknown+= [dict(y=y,u=r['u'],kou=r['kou'],moku=r['moku'],v=r['v']) for r in left2]
# --- 区分（AI の判断。規則）
KOFU={'新型コロナウイルス感染症対応地方創生推進費','物価高騰対応地方創生推進費'}
def cat(p):
    if p['key'] in KOFU or any(r['kou'] in KOFU and r['moku']==p['key'] for r in rows if r['y']==p['y']): return '臨時交付金'
    if p['y']==2021 and p['r']=='デジタル庁': return '組織の新設・移管'
    if p['y']==2023 and p['r']=='こども家庭庁': return '組織の新設・移管'
    if p['y']==2024 and p['g']=='厚生労働省' and p['r']=='国土交通省': return '組織の新設・移管'
    return '配分（研究開発・地域振興など）'
for p in pairs: p['cat']=cat(p); p['same']=p['g']==p['r']
tot=collections.Counter(); 
for p in pairs: tot[(p['y'],p['cat'])]+=p['v']
print('対応づけ', len(pairs), '対応不明', len(unknown), sum(u['v'] for u in unknown if u['v']>0))
for y in range(2017,2025):
    print(y, {c:round(tot[(y,c)]/1e8,1) for c in ['臨時交付金','組織の新設・移管','配分（研究開発・地域振興など）']}, '全移替(正)', round(sum(r['v'] for r in rows if r['y']==y and r['v']>0)/1e8,1))
# 組の一覧
pg=collections.defaultdict(lambda: collections.Counter())
for p in pairs:
    if p['same']: continue
    pg[(p['g'],p['r'])][p['y']]+=p['v']
lst=sorted(pg.items(), key=lambda kv:-sum(kv[1].values()))
for (g,r),c in lst: print(g,'→',r, round(sum(c.values())/1e8,1),'億', '年度',sorted(c))
same=[p for p in pairs if p['same']]; print('府省内', [(p['y'],p['g'],p['key'],round(p['v']/1e8,2)) for p in same])
print('unknown',unknown)
json.dump(dict(pairs=pairs,unknown=unknown),open('s2.json','w'),ensure_ascii=False)
