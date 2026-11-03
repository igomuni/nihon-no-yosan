# 検算 4: 補正の差引の合計（FY2017〜FY2024）を、決算の歳出予算額 − 当初予算（テーマ 1 の方法）と比べる。年度ごとに、成立額（第 1 回に出た項の成立額。回をまたぐ項は最初の回）・当初（画面用データの政府案）・決算の歳出予算額を並べる
import csv, os, json, gzip, glob
R='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
S=json.load(open('s3.json'))
D=json.load(gzip.open('/Users/igomuni/orca/nihon-no-yosan/apps/web/public/data/lifecycle/data.json.gz'))
# 政府案（budget_amount）の合計。イベントの形: [kou, stage, ..., key(5), raw, unit, value(8), ...]
bud={}
kous=D['kous']
for e in D['events']:
    if e[1]=='budget' and e[5]=='budget_amount':
        k=kous[e[0]]
        if k['account']=='general': bud[k['year']]=bud.get(k['year'],0)+e[8]
def rounds(y):
    for base in ['reference-v0','mof-history-v0']:
        d=f'{R}/{base}/mof-archive/{y}'
        if os.path.exists(f'{d}/kou-general-hosei.csv'):
            return [f for r in range(1,5) for f in [f'{d}/kou-general-hosei.csv' if r==1 else f'{d}/kou-general-hosei-{r}.csv'] if os.path.exists(f)]
tot_net=0; tot_k=0
for y in range(2017,2027):
    first={}
    for f in rounds(y):
        rows=list(csv.DictReader(open(f,encoding='utf-8'))); cb=[x for x in rows[0] if '成立予算額' in x][0]
        for x in rows: first.setdefault((x['所管'],x['組織'],x['項コード'],x['項名']),int(x[cb] or 0))
    base=sum(first.values())*1000
    net=S['year'][str(y)]['net']*1000
    ks=glob.glob(f'{R}/*/mof-archive/{y}/kou-general-kessan.csv')
    ap=None
    if ks:
        rows=list(csv.DictReader(open(ks[0],encoding='utf-8'))); c=[x for x in rows[0] if '歳出予算額' in x][0]; ap=sum(int(x[c] or 0) for x in rows)
    b=bud.get(y,0)
    line=f"{y} 当初(政府案) {b/1e12:.3f} 補正の成立額の計 {base/1e12:.3f}（差 {(base-b)/1e12:+.3f}） 差引計 {net/1e12:.3f} 当初+差引 {(b+net)/1e12:.3f}"
    if ap is not None:
        line+=f" 決算の歳出予算額 {ap/1e12:.3f} 歳出予算額−当初 {(ap-b)/1e12:.3f}（差引計との差 {(ap-b-net)/1e12:+.3f}）"; tot_net+=net; tot_k+=ap-b
    print(line)
print(f'FY2017〜FY2024 差引計 {tot_net/1e12:.2f} / 歳出予算額−当初 {tot_k/1e12:.2f}')
