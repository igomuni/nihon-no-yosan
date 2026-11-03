# page-data.json と index.html を作る
import json
c=json.load(open('c4.json'))
items=c['items']; fz=c['fz']; CATS=c['cats']
YRS=['2019','2020','2021','2022','2023','2024']
oku=lambda v: round(v/1e8)  # 円 → 億円
def g(it,y,x): return (it['y'].get(y) or {}).get(x) or 0
core=[i for i in items if not i['cat'].startswith('参考')]
kpi=dict(inflow=oku(sum(i['new'] for i in core)),spent=oku(sum(i['spent'] for i in core)),unused=oku(sum(i['unused'] for i in core)),
         fz20cur=oku(fz['2020']['cur']),fz20spent=oku(fz['2020']['spent']))
yearly={cat:[oku(sum(g(i,y,'spent') for i in items if i['cat']==cat)) for y in YRS] for cat in CATS}
SHORT={'株式会社日本政策金融公庫出資金':'日本政策金融公庫への出資','危機対応円滑化業務出資金':'危機対応円滑化業務への出資','株式会社商工組合中央金庫出資金':'商工組合中央金庫への出資',
 '中小企業再生支援利子補給補助金':'利子補給（中小企業再生支援）','経営安定関連保証等基金補助金':'信用保証の基金（経営安定関連）',
 '新型コロナウイルス感染症対策中小企業等持続化給付金':'持続化給付金','新型コロナウイルス感染症対策中小企業等家賃支援給付金':'家賃支援給付金','中小企業等事業再構築促進補助金':'事業再構築補助金（参考）'}
merged={}
for i in items:
    n=SHORT[i['k'][3]]; m=merged.setdefault(n,{'n':n,'cat':i['cat'],'new':0,'spent':0,'unused':0,'minis':set()})
    m['new']+=i['new']; m['spent']+=i['spent']; m['unused']+=i['unused']; m['minis'].add(i['k'][0])
bars=[{'n':m['n'],'cat':m['cat'],'new':oku(m['new']),'spent':oku(m['spent']),'unused':oku(m['unused']),'minis':'・'.join(sorted(m['minis']))} for m in merged.values() if m['new']>=5e10]
bars.sort(key=lambda b:-b['new'])
table=[{'cat':i['cat'],'min':i['k'][0],'kou':i['k'][2],'n':SHORT[i['k'][3]],'budget':oku(i['budget']),'supp':oku(i['supp']),'res':oku(i['res']),'ryu':oku(i['new']-sum(g(i,y,'appr')+g(i,y,'res') for y in ['2020','2021','2022'])),'new':oku(i['new']),'spent':oku(i['spent']),'unused':oku(i['unused']),'base19':oku(i['base19'])} for i in items if i['new']>=5e9]
table.sort(key=lambda r:(CATS.index(r['cat']),-r['new']))
fzrows=[{'y':int(y),'budget':oku(fz[y]['budget']),'supp':oku(fz[y]['supp'] or 0),'cur':oku(fz[y]['cur']),'spent':oku(fz[y]['spent']),'unused':oku(fz[y]['unused'])} for y in YRS]
fzR={k:oku(v) for k,v in (fz['2020']['rounds'] or {}).items()}
def find(n,mi):
    return [i for i in items if i['k'][3]==n and i['k'][0]==mi][0]
kou=find('株式会社日本政策金融公庫出資金','財務省'); kouM=find('株式会社日本政策金融公庫出資金','経済産業省')
jz=find('新型コロナウイルス感染症対策中小企業等持続化給付金','経済産業省'); yc=find('新型コロナウイルス感染症対策中小企業等家賃支援給付金','経済産業省')
detail=dict(
 kouRounds={k:oku(v) for k,v in (c['items'][items.index(kou)]['y']['2020'].get('rounds') or {}).items()} if False else None,
 kou20spent=oku(g(kou,'2020','spent')+g(kouM,'2020','spent')), kou20cout=oku(g(kou,'2020','cout')+g(kouM,'2020','cout')), kou21spent=oku(g(kou,'2021','spent')+g(kouM,'2021','spent')),
 jz=[{'y':y,'appr':oku(g(jz,y,'appr')),'res':oku(g(jz,y,'res')),'ryu':oku(g(jz,y,'ryu')),'cin':oku(g(jz,y,'cin')),'spent':oku(g(jz,y,'spent')),'cout':oku(g(jz,y,'cout')),'unused':oku(g(jz,y,'unused'))} for y in ['2020','2021','2022']],
 ycRyu=oku(g(yc,'2020','ryu')), ycSupp=oku(g(yc,'2020','supp')))
data=dict(kpi=kpi,Y=[int(y) for y in YRS],cats=CATS,yearly=yearly,bars=bars,table=table,fz=fzrows,fzR=fzR,detail=detail)
json.dump(data,open('page-data.json','w'),ensure_ascii=False,indent=1)
tpl=open('page.tpl.html').read()
open('index.html','w').write(tpl.replace('__DATA__',json.dumps(data,ensure_ascii=False)))
print(json.dumps(kpi,ensure_ascii=False)); print(detail['kou20spent'],detail['kou20cout'],detail['kou21spent'],fzR)
