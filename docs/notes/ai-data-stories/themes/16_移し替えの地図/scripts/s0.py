import csv,glob,collections,json,sys
D='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def load(y,kind):
    fs=sorted(glob.glob(f'{D}/*/mof-archive/{y}/{kind}-general-kessan.csv'))
    return fs, list(csv.DictReader(open(fs[0],encoding='utf-8')))
for y in range(2017,2025):
    fs,k=load(y,'kou'); _,m=load(y,'moku')
    ck=[c for c in k[0] if '移替' in c][0]; cm=[c for c in m[0] if '移替' in c][0]
    tk=sum(int(r[ck] or 0) for r in k); tm=sum(int(r[cm] or 0) for r in m)
    pos=sum(int(r[ck] or 0) for r in k if int(r[ck] or 0)>0)
    nk=sum(1 for r in k if int(r[ck] or 0)!=0); nm=sum(1 for r in m if int(r[cm] or 0)!=0)
    print(y,len(fs),'kou sum',tk,'moku sum',tm,'pos(兆)',round(pos/1e12,3),'項',nk,'目',nm)
# 内閣府の組織
_,k=load(2024,'kou'); print(sorted(set(r['組織'] for r in k if r['所管']=='内閣府')))
print(sorted(set(r['所管'] for r in k)))
