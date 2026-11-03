import csv,glob,json,collections
D='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
s2=json.load(open('s2.json')); rows=json.load(open('s1.json'))
def unit(mn,org):
    if mn=='内閣府' and (org.endswith('庁') or org.endswith('委員会')): return org
    return mn
ok=True
for y in range(2017,2025):
    fk=sorted(glob.glob(f'{D}/*/mof-archive/{y}/kou-general-kessan.csv'))[0]
    kou=collections.Counter(); kun=collections.Counter()
    for r in csv.DictReader(open(fk,encoding='utf-8')):
        v=int(r['予算決定後移替増△減額(円)の合計'] or 0)
        if v: kou[(r['所管'],r['組織'],r['項コード'],r['項名'])]+=v; kun[unit(r['所管'],r['組織'])]+=v
    mok=collections.Counter(); 
    for r in rows:
        if r['y']==y: mok[(r['min'],r['org'],r['code'],r['kou'])]+=r['v']
    if kou!=mok: ok=False; print('項≠目',y)
    # 対応づけ + 対応不明 の府省別純額 = 項の CSV の府省別純額
    net=collections.Counter()
    for p in s2['pairs']:
        if p['y']==y: net[p['g']]-=p['v']; net[p['r']]+=p['v']
    for u in s2['unknown']:
        if u['y']==y: net[u['u']]+=u['v']
    net={k:v for k,v in net.items() if v}; kun={k:v for k,v in kun.items() if v}
    if net!=kun: ok=False; print('府省別の純額が違う',y,net,kun)
    print(y,'項',len(kou),'年度の和',sum(kou.values()),'OK' if kou==mok and net==kun else 'NG')
# 恒等式
for r in rows:
    assert r['cur']==r['base']+r['carry']+r['res']+r['flow']+r['v']==r['spent']+r['out']+r['unused']
print('恒等式 OK', len(rows), '全体', ok)
