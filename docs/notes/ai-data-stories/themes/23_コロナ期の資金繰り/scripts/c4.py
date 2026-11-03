# 区分を決めて、FY2020〜FY2022 の入り（前年度繰越 + 歳出予算額 + 予備費 + 流用 + 移替）と、出（支出・不用・FY2022 末の繰越）を締める
import json
c3=json.load(open('c3.json')); c2=json.load(open('c2.json')); c1=json.load(open('c1.json'))
CAT=[('出資（政策金融機関へ）',lambda n:n in ('株式会社日本政策金融公庫出資金','危機対応円滑化業務出資金','株式会社商工組合中央金庫出資金')),
     ('保証・利子補給',lambda n:n in ('経営安定関連保証等基金補助金','中小企業再生支援利子補給補助金')),
     ('給付金',lambda n:n in ('新型コロナウイルス感染症対策中小企業等持続化給付金','新型コロナウイルス感染症対策中小企業等家賃支援給付金')),
     ('参考: 事業再構築の補助',lambda n:n=='中小企業等事業再構築促進補助金')]
def cat(n):
    for c,f in CAT:
        if f(n): return c
    return None
YRS=['2019','2020','2021','2022','2023','2024']
items={}
for y in YRS:
    for d in c3[y]:
        c=cat(d['k'][3])
        if not c: continue
        it=items.setdefault(tuple(d['k']),{'k':d['k'],'cat':c,'y':{}})
        it['y'][y]={x:d.get(x) for x in ['budget','appr','cin','res','ryu','iga','cur','spent','cout','unused']}
        it['y'][y]['supp']=sum((d.get('rounds') or {}).values()) if d.get('rounds') else None
W=['2020','2021','2022']
def g(it,y,x): return (it['y'].get(y) or {}).get(x) or 0
res=[]
for it in items.values():
    cin=g(it,'2020','cin'); new=sum(g(it,y,'appr')+g(it,y,'res')+g(it,y,'ryu')+g(it,y,'iga') for y in W)
    sp=sum(g(it,y,'spent') for y in W); un=sum(g(it,y,'unused') for y in W); co=g(it,'2022','cout')
    supp=sum(g(it,y,'supp') for y in W)
    it.update(cin20=cin,new=new,spent=sp,unused=un,cout22=co,supp=supp,close=cin+new-sp-un-co,
              res=sum(g(it,y,'res') for y in W),ryu=sum(g(it,y,'ryu') for y in W),base19=g(it,'2019','cur'),
              budget=sum(g(it,y,'budget') for y in W))
    res.append(it)
t=lambda v:f'{v/1e12:.3f}'
for c,_ in CAT:
    rs=[r for r in res if r['cat']==c]
    print('==',c,'入り',t(sum(r['new'] for r in rs)),'前年度繰越',t(sum(r['cin20'] for r in rs)),'支出',t(sum(r['spent'] for r in rs)),'不用',t(sum(r['unused'] for r in rs)),'FY22末繰越',t(sum(r['cout22'] for r in rs)),'締め',t(sum(r['close'] for r in rs)))
    for r in sorted(rs,key=lambda r:-r['new']):
        if r['new']<5e9: continue
        print('   ',r['k'][0][:5],r['k'][3][:26],'当初',t(r['budget']),'補正',t(r['supp']),'予備費',t(r['res']),'流用',t(r['ryu']),'入り',t(r['new']),'支出',t(r['spent']),'不用',t(r['unused']),'繰越',t(r['cout22']),'19',t(r['base19']),'締め',r['close'])
# 年度ごとの支出（区分別）
for c,_ in CAT:
    print(c,{y:round(sum(g(r,y,'spent') for r in res if r['cat']==c)/1e12,3) for y in YRS})
# FY2020 の公庫出資の補正（所管別）
print('FY2020 公庫出資 補正', {r['k'][0]:round(g(r,'2020','supp')/1e12,3) for r in res if r['k'][3]=='株式会社日本政策金融公庫出資金'}, round(sum(g(r,'2020','supp') for r in res if r['k'][3]=='株式会社日本政策金融公庫出資金')/1e12,3))
# 財投（融資の原資）
fz={}
for y in YRS:
    for d in c2[y]:
        if d['k'][0]=='special' and d['k'][4]=='財政融資資金へ繰入':
            fz[y]={x:d.get(x) for x in ['budget','cur','spent','cout','unused']}; fz[y]['supp']=sum((d.get('rounds') or {}).values()) if d.get('rounds') else None; fz[y]['rounds']=d.get('rounds')
print('財投 財政融資資金へ繰入',{y:{k:(None if v is None else (v if isinstance(v,dict) else round(v/1e12,3))) for k,v in d.items()} for y,d in fz.items()})
json.dump({'items':[{k:v for k,v in r.items()} for r in res],'fz':fz,'cats':[c for c,_ in CAT]},open('c4.json','w'),ensure_ascii=False)
