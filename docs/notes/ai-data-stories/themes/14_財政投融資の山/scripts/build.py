# LP を作る（a2.json・a3.json から埋め込みデータを作り、index.html と preview.html を書く）
import json
A=json.load(open('a2.json')); G=json.load(open('a3.json'))
Y=list(range(2017,2027)); ys=[str(y) for y in Y]
oku=lambda v: None if v is None else round(v/1e8,2)   # 円 → 億円
def series(key):
    k=A['kou'][key]; return {f:[oku(k.get(y,{}).get(f)) for y in ys] for f in ['budget','prev','revised','spent','unused']}
tot={}
for f in ['budget','revised','cur','spent','cout','unused']:
    arr=[]
    for y in ys:
        vals=[e[y].get(f) for e in A['acct'].values() if y in e and e[y].get(f) is not None]
        arr.append(oku(sum(vals)) if vals else None)
    tot[f]=arr
acct={a:{f:[oku(e.get(y,{}).get(f)) if y in e else None for y in ys] for f in ['budget','revised','cur','spent','cout','unused']} for a,e in A['acct'].items()}
rounds={y:{n:[{'r':x['round'],'b':oku(x['before']),'a':oku(x['after'])} for x in l] for n,l in s.items()} for y,s in A['rounds'].items()}
data={'Y':Y,'tot':tot,'acct':acct,'fund':series('財政融資資金勘定|財政融資資金へ繰入'),'debt':series('財政融資資金勘定|国債整理基金特別会計へ繰入'),
      'invest':series('投資勘定|産業投資支出'),'rounds':rounds,
      'toFilp':{y:{k:oku(v) for k,v in r.items()} for y,r in G['toFilp'].items()},
      'toGeneral':{y:[{'sub':r['sub'],'name':r['name'],'budget':oku(r['budget']),'revised':oku(r['revised']),'spent':oku(r['spent'])} for r in l] for y,l in G['toGeneral'].items()}}
html=open('template.html').read().replace('__DATA__',json.dumps(data,ensure_ascii=False))
open('index.html','w').write(html)
open('preview.html','w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html+'</body></html>')
open('page-data.json','w').write(json.dumps(data,ensure_ascii=False))
print('ok', len(html))
