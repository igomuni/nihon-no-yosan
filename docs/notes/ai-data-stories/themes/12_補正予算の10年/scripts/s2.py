# 事項・目の補正の行で、差引額がどこまで分類コードで分けられるか（回ごと）
import csv, os, collections
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def dirof(y):
    for base in ['reference-v0','mof-history-v0']:
        d=f'{R}/{base}/mof-archive/{y}'
        if os.path.exists(f'{d}/kou-general-hosei.csv'): return d
def files(y,kind):
    d=dirof(y); out=[]
    for r in range(1,5):
        f=f'{d}/{kind}-general-hosei.csv' if r==1 else f'{d}/{kind}-general-hosei-{r}.csv'
        if os.path.exists(f): out.append(f)
    return out
for y in range(2017,2027):
    for kind in ['jikou','moku']:
        net=0; coded=0; types=collections.Counter()
        for f in files(y,kind):
            rows=list(csv.DictReader(open(f,encoding='utf-8')))
            h=list(rows[0].keys()); cn=[x for x in h if '差引額' in x][0]
            for x in rows:
                v=int(x[cn] or 0); net+=v
                if x.get('主要経費別分類コード'): coded+=v
                types[x.get('行の種類','-')]+=v
        print(y,kind,'差引',round(net/1e9,2),'コード付き',round(coded/1e9,2), {k:round(v/1e9,2) for k,v in types.items()} if kind=='jikou' else '')
