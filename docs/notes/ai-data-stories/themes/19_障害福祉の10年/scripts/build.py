import json
s=json.load(open('s3.json'))
Y=list(range(2017,2028))
oku=lambda v: None if v is None else round(v/1e8)       # 円 → 億円
okuk=lambda v: None if v is None else round(v/1e5)      # 千円 → 億円
# 目のまとまり（政府案、千円）
G=[('jiritsu','障害者自立支援給付費負担金',['障害者自立支援給付費負担金']),
   ('jidou','障害児入所給付費等負担金（医療を含む）',['障害児入所給付費等負担金','障害児入所医療費等負担金']),
   ('iryo','障害者医療費負担金',['障害者医療費負担金']),
   ('teate','特別児童扶養手当・特別障害者手当等',['特別児童扶養手当給付費','特別障害者手当等給付費負担金']),
   ('other','地域生活支援事業費等補助金・その他',['地域生活支援事業費等補助金','その他'])]
mk=s['mk']
def gsum(names,y,f):
    vs=[mk[n][str(y)][f] for n in names if n in mk and str(y) in mk[n] and mk[n][str(y)][f] is not None]
    return okuk(sum(vs)) if vs else None
groups=[{'k':k,'n':n,'bud':[gsum(ns,y,'bud') for y in Y],'req':[gsum(ns,y,'req') for y in Y],'cur':[gsum(ns,y,'cur') for y in Y],'spent':[gsum(ns,y,'spent') for y in Y],'unused':[gsum(ns,y,'unused') for y in Y]} for k,n,ns in G]
tot={f:[oku(r[f]) for r in s['tot']] for f in ['req','bud','rev','cur','spent','carried','unused']}
# 項ごと（こども家庭庁の分）
cfa={f:[] for f in ['req','bud','rev']}
mhlw={f:[] for f in ['req','bud','rev']}
for y in Y:
    for f in cfa:
        a=[x[f] for x in s['kou'] if x['y']==y and x['org']=='こども家庭庁' and x['name']=='障害児支援等対策費' and x[f] is not None]
        b=[x[f] for x in s['kou'] if x['y']==y and x['org']=='厚生労働本省' and x[f] is not None]
        cfa[f].append(oku(sum(a)) if a else None); mhlw[f].append(oku(sum(b)) if b else None)
json.dump({'Y':Y,'groups':groups,'tot':tot,'cfa':cfa,'mhlw':mhlw,'gen':[974547,977128,1014571,1026580,1066097,1075964,1143812,1125717,1155415,1223092,None]},open('data.json','w'),ensure_ascii=False)
print(json.dumps(tot,ensure_ascii=False)); print(json.dumps(cfa)); print([ (g['k'],g['bud'][0],g['bud'][9]) for g in groups])
