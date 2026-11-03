# 検算: 予算書の目の CSV を直接読み、同じ判定規則で、当初（政府案）と補正（全ての回の差引額の和）を足す
import csv, glob, re, json, os
B='/Users/igomuni/orca/nihon-no-yosan/data/dataset/'
def cls(name):
    if re.search(r'特別会計へ繰入|運営費交付金|分担金|拠出金|給付費負担金|事務局|国際交流基金|年金基金', name): return None
    if re.search(r'基金', name) or re.search(r'造成費(補助金|交付金)', name): return 'fund'
    if re.search(r'出資金', name): return 'invest'
    if re.search(r'資金へ繰入', name): return 'reserve'
    return None
def d(y, ver=None):
    ver = ver or str(y)
    for root in ('reference-v0','mof-history-v0'):
        p=f'{B}{root}/mof-archive/{ver}'
        if y>=2023 and root=='mof-history-v0': continue
        if os.path.exists(p+'/moku-general.csv') or glob.glob(p+'/moku-general-hosei*.csv'): return p
out={}
for y in range(2017,2027):
    bd=d(y,'2025_teishutsu' if y==2025 else None); sd=d(y)
    r=list(csv.DictReader(open(bd+'/moku-general.csv',encoding='utf-8')))
    amt=[k for k in r[0] if re.match(r'^(令和|平成)(元|\d+)年度(要求|予定)額',k)][0]
    tot={c:[0,0] for c in ('fund','invest','reserve')}
    for x in r:
        c=cls(x['目名'])
        if c: tot[c][0]+=int(x[amt] or 0)
    for f in sorted(glob.glob(sd+'/moku-general-hosei*.csv')):
        rr=list(csv.DictReader(open(f,encoding='utf-8')))
        col=[k for k in rr[0] if '差引額' in k][0]
        for x in rr:
            c=cls(x['目名'])
            if c: tot[c][1]+=int(x[col] or 0)
    out[y]={c:[round(a/1e9,3),round(b/1e9,3)] for c,(a,b) in tot.items()}
    print(y,out[y])
json.dump(out,open('v1.json','w'))
