# 検算 1: 回をまたぐつながり（第 r 回の成立額 = 第 r−1 回の改予算額、項ごと）と、項ごとの「最後の改 − 最初の成立 = 差引の合計」
# 検算 2: 目の差引の合計 = 項の差引の合計（年度ごと）。事項の差引の合計 = 項の差引の合計
# 検算 3: 当初予算（画面用データの政府案）と第 1 回の成立額の差
import csv, os, json, re, gzip
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def rounds(y,kind):
    for base in ['reference-v0','mof-history-v0']:
        d=f'{R}/{base}/mof-archive/{y}'
        if not os.path.exists(f'{d}/{kind}-general-hosei.csv'): continue
        out=[]
        for r in range(1,5):
            f=f'{d}/{kind}-general-hosei.csv' if r==1 else f'{d}/{kind}-general-hosei-{r}.csv'
            if os.path.exists(f): out.append(f)
        return out
    return []
def col(h,k): return [x for x in h if k in x][0]
S=json.load(open('s3.json'))
for y in range(2017,2027):
    prev={}; first={}; last={}; netsum={}; brk=0; seen_multi=0
    for f in rounds(y,'kou'):
        rows=list(csv.DictReader(open(f,encoding='utf-8'))); h=list(rows[0].keys())
        cb,cn=col(h,'成立予算額'),col(h,'差引額'); cv=[x for x in h if x.startswith('改')][0]
        for x in rows:
            k=(x['所管'],x['組織'],x['項コード'],x['項名'])
            b,n,v=int(x[cb] or 0),int(x[cn] or 0),int(x[cv] or 0)
            if k in prev:
                seen_multi+=1
                if prev[k]!=b: brk+=1
            first.setdefault(k,b); last[k]=v; netsum[k]=netsum.get(k,0)+n; prev[k]=v
    bad=sum(1 for k in last if last[k]-first[k]!=netsum[k])
    def tot(kind):
        s=0
        for f in rounds(y,kind):
            rows=list(csv.DictReader(open(f,encoding='utf-8'))); cn=col(list(rows[0].keys()),'差引額'); s+=sum(int(x[cn] or 0) for x in rows)
        return s
    k_,m_,j_=tot('kou'),tot('moku'),tot('jikou')
    print(y,'回をまたぐ項',seen_multi,'成立≠前回の改',brk,'| 最後−最初≠差引計',bad,'| 差引 項',k_,'目',m_,'事項',j_ if j_ else '(事項の補正ファイル無し)', '一致' if k_==m_ and (j_==k_ or j_==0) else '不一致')
