import csv,glob,json
CORE={'障害保健福祉費','障害児支援等対策費'}
out={}
for y in range(2017,2027):
    src='2025_teishutsu' if y==2025 else str(y)
    f=glob.glob(f'/Users/igomuni/orca/nihon-no-yosan/data/dataset/*/mof-archive/{src}/kou-general.csv')[0]
    r=list(csv.DictReader(open(f,encoding='utf-8')))
    amt=[k for k in r[0] if ('要求額' in k or '予定額' in k)][0]
    b=sum(int(x[amt] or 0) for x in r if x['項名'] in CORE)
    fm=glob.glob(f'/Users/igomuni/orca/nihon-no-yosan/data/dataset/*/mof-archive/{src}/moku-general.csv')[0]
    rm=list(csv.DictReader(open(fm,encoding='utf-8')))
    am=[k for k in rm[0] if ('要求額' in k or '予定額' in k)][0]
    jiritsu=sum(int(x[am] or 0) for x in rm if x['項名'] in CORE and x['目名']=='障害者自立支援給付費負担金')
    jidou=sum(int(x[am] or 0) for x in rm if x['項名'] in CORE and x['目名']=='障害児入所給付費等負担金')
    o={'bud':b/1e9,'jiritsu':jiritsu/1e9,'jidou':jidou/1e9,'col':amt}
    kf=glob.glob(f'/Users/igomuni/orca/nihon-no-yosan/data/dataset/*/mof-archive/{y}/kou-general-kessan.csv')
    if kf:
        rk=list(csv.DictReader(open(kf[0],encoding='utf-8')))
        col=lambda key:[k for k in rk[0] if key in k][0]
        for key,name in [('歳出予算現額','cur'),('支出済歳出額','spent'),('不用額','unused'),('翌年度繰越額','carried')]:
            o[name]=sum(int(x[col(key)] or 0) for x in rk if x['項名'] in CORE)/1e12
    out[y]=o
for y,o in out.items(): print(y,{k:(round(v,3) if isinstance(v,float) else v) for k,v in o.items()})
json.dump(out,open('v1.json','w'),ensure_ascii=False)
