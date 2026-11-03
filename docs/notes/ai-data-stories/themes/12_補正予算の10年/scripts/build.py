# LP に埋め込む値を作る（s1.json・s3.json・codepages.json から）。単位は億円（千円 ÷ 100,000 を四捨五入）
import json, collections
S=json.load(open('s3.json')); S1=json.load(open('s1.json')); P=json.load(open('codepages.json'))['pages']
Y=S['years']
def oku(v): return round(v/1e5)
def name(code,y):
    for f in ['21002','21001','77001','11001']:
        for p in P:
            if p['year']==y and p['form']==f:
                m=dict(p['major'])
                if code in m: return m[code]
    for p in sorted([p for p in P if p['form']=='11001'],key=lambda p:(abs(p['year']-y),p['year'])):
        m=dict(p['major'])
        if code in m: return m[code]
    return code
PUBLIC={'41','42','43','44','45','46','47','49'}; RESERVE={'93','94','96','98'}
CATS=[('public','公共事業'),('defense','防衛関係費'),('local','地方交付税など'),('reserve','予備費'),('debt','国債費'),('covid','中小企業・保健衛生'),('rest','その他')]
def cat(c):
    if c in PUBLIC: return 'public'
    if c=='35': return 'defense'
    if c in ('31','32'): return 'local'
    if c in RESERVE: return 'reserve'
    if c=='20': return 'debt'
    if c in ('60','07'): return 'covid'
    return 'rest'
years=[]
for y in Y:
    ys=str(y); add=collections.Counter(); red=collections.Counter()
    for c,d in S['major'].items():
        if ys in d: add[cat(c)]+=d[ys][0]; red[cat(c)]+=d[ys][1]
    yr=S['year'][ys]
    years.append({'y':y,'add':oku(yr['add']),'red':oku(yr['red']),'net':oku(yr['net']),
        'rounds':[oku(r['net']) for r in S1[ys]],
        'catAdd':{k:oku(add[k]) for k,_ in CATS},'catRed':{k:oku(red[k]) for k,_ in CATS},
        'covidNamed':[oku(S['corona'][ys][0]),oku(S['corona'][ys][1])]})
# 主要経費の表（FY2017〜FY2025 の 9 年で追加のあった年数）
majors=[]
for c,d in S['major'].items():
    net=[oku(d[str(y)][2]) if str(y) in d else None for y in Y]
    addv=[oku(d[str(y)][0]) if str(y) in d else 0 for y in Y]
    redv=[oku(d[str(y)][1]) if str(y) in d else 0 for y in Y]
    yrs=sum(1 for y in Y[:9] if str(y) in d and d[str(y)][0]>0)
    if sum(addv)==0 and sum(redv)==0: continue
    majors.append({'c':c,'n':name(c,2025 if c not in ('93','94','96') else max(int(y) for y in d)),'net':net,'add':sum(addv),'red':sum(redv),'yrs':yrs,'cat':cat(c),
        'normal':sum(addv[i] for i,y in enumerate(Y) if y not in (2020,2021,2022,2026))})
majors.sort(key=lambda m:-m['add'])
# 予備費のコードの年度ごとの名前
reserveNames={c:{y:name(c,y) for y in Y if str(y) in S['major'].get(c,{})} for c in RESERVE}
# 事項の上位（追加・減少）
def label(k):
    g,kou,j=k.split('|',2); return {'g':g,'kou':kou,'j':j}
top={}
for y in Y:
    js=S['jikou'][str(y)]
    top[y]={'add':[{**label(k),'a':oku(a),'r':oku(b)} for k,a,b,n in js[:8] if a>0],
            'red':[{**label(k),'a':oku(a),'r':oku(b)} for k,a,b,n in sorted(js,key=lambda z:z[2])[:5] if b<0]}
# 国債費の事項（利払い・剰余金・その他）
debt=[]
for y in Y:
    d=S['debt'][str(y)]; i=s=o=0
    for k,v in d.items():
        if '利子' in k: i+=v[2]
        elif '剰余金' in k: s+=v[2]
        else: o+=v[2]
    debt.append({'y':y,'interest':oku(i),'surplus':oku(s),'other':oku(o)})
# 府省
groups=[]
for g,d in S['group'].items():
    net=[oku(d[str(y)][2]) if str(y) in d else None for y in Y]
    groups.append({'g':g,'net':net,'sum':sum(v for v in net if v)})
groups.sort(key=lambda z:-z['sum'])
out={'Y':Y,'cats':CATS,'years':years,'majors':majors,'reserveNames':reserveNames,'top':top,'debt':debt,'groups':groups[:16]}
json.dump(out,open('page-data.json','w'),ensure_ascii=False)
print(json.dumps(years[3],ensure_ascii=False)); print(len(majors), [ (m['n'],m['yrs']) for m in majors[:12]]); print(debt); print(reserveNames)
