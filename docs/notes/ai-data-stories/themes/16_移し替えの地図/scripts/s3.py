import csv,glob,json,collections
D='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
C=['歳出予算額(円)','前年度繰越額(円)','予備費使用額(円)','流用等増△減額(円)','予算決定後移替増△減額(円)','歳出予算現額(円)','支出済歳出額(円)','翌年度繰越額(円)','不用額(円)']
K=['base','carry','res','flow','tr','cur','spent','out','unused']
out={}
# 協力要請推進交付金（目）
trace=[]
for y in range(2017,2025):
    f=sorted(glob.glob(f'{D}/*/mof-archive/{y}/moku-general-kessan.csv'))[0]
    for r in csv.DictReader(open(f,encoding='utf-8')):
        if '協力要請推進交付金' in r['目名']:
            d={k:int(r[c] or 0) for k,c in zip(K,C)}; d.update(y=y,min=r['所管'],kou=r['項名'],moku=r['目名'],row=r['source_row'],src=f.split('dataset/')[1])
            assert d['cur']==d['base']+d['carry']+d['res']+d['flow']+d['tr']==d['spent']+d['out']+d['unused']
            trace.append(d)
for d in trace: print(d['y'],d['min'],{k:round(d[k]/1e8,1) for k in K})
# 補正予算（予算書）の協力要請推進交付金
for y in (2021,2022,2023):
    for f in sorted(glob.glob(f'{D}/*/mof-archive/{y}/moku-general*.csv')):
        if 'kessan' in f: continue
        rd=list(csv.DictReader(open(f,encoding='utf-8')))
        for r in rd:
            if '協力要請推進交付金' in r.get('目名',''):
                print('予算書',y,f.split('/')[-1],{k:v for k,v in r.items() if k in ('所管','項名') or '額' in k})
out['trace']=trace
# 府省別: 移替前（歳出予算額+前年度繰越+予備費+流用）と移替後（現額）、支出済
def unit(mn,org):
    if mn=='内閣府' and (org.endswith('庁') or org.endswith('委員会')): return org
    return mn
eff=[]
for y in range(2017,2025):
    f=sorted(glob.glob(f'{D}/*/mof-archive/{y}/kou-general-kessan.csv'))[0]
    agg=collections.defaultdict(lambda: collections.Counter())
    for r in csv.DictReader(open(f,encoding='utf-8')):
        u=unit(r['所管'],r['組織'])
        a=agg[u]
        for k,c in zip(K,C):
            a[k]+=int(r[c.replace('(円)','(円)の合計')] or 0)
    tot_tr=sum(a['tr'] for a in agg.values()); assert tot_tr==0
    for u,a in agg.items():
        if a['tr']: eff.append(dict(y=y,u=u,pre=a['cur']-a['tr'],tr=a['tr'],cur=a['cur'],spent=a['spent'],base=a['base']))
for e in sorted(eff,key=lambda e:(e['y'],e['tr'])):
    if abs(e['tr'])>=1e10: print(e['y'],e['u'],'移替前',round(e['pre']/1e12,2),'移替',round(e['tr']/1e12,2),'現額',round(e['cur']/1e12,2),'支出済',round(e['spent']/1e12,2),'歳出予算額',round(e['base']/1e12,2))
out['eff']=eff
json.dump(out,open('s3.json','w'),ensure_ascii=False)
