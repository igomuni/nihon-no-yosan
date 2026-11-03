# 補正の分析の中身（s3.json から）: 主要経費の名前（その年度の補正のコード表 → 決算 → 当初 → 近い年度の当初）、区分、上位の項・事項、国債費の事項
import json, collections
S=json.load(open('s3.json')); P=json.load(open('codepages.json'))['pages']
def name(code,y):
    for forms in (['21002','21001'],['77001'],['11001']):
        for f in forms:
            for p in P:
                if p['year']==y and p['form']==f:
                    m=dict(p['major'])
                    if code in m: return m[code], f
    for p in sorted([p for p in P if p['form']=='11001'],key=lambda p:(abs(p['year']-y),p['year'])):
        m=dict(p['major'])
        if code in m: return m[code], 'near'
    return code,'none'
Y=S['years']; T=lambda v:round(v/1e9,2)
# 区分（AI の判断。理由は verify.md）
PUBLIC={'41','42','43','44','45','46','47','49'}  # 公共事業関係（41〜47 + 災害復旧 49）。48 推進費等は除く
RESERVE={'93','94','96','98'}
def cat(c):
    if c in PUBLIC: return 'public'
    if c=='35': return 'defense'
    if c in RESERVE: return 'reserve'
    if c=='20': return 'debt'
    if c=='31' or c=='32': return 'local'
    return 'other'
by=collections.defaultdict(lambda:collections.defaultdict(lambda:[0,0,0]))
for c,d in S['major'].items():
    for y,v in d.items():
        t=by[cat(c)][int(y)]
        for i in range(3): t[i]+=v[i]
for k in ['public','defense','reserve','debt','local','other']:
    print(k,' '.join(f"{y%100}:{T(by[k][y][2])}" for y in Y))
tot={y:sum(by[k][y][2] for k in by) for y in Y}
print('合計', ' '.join(f"{y%100}:{T(tot[y])}" for y in Y))
print('\n94 の名前', [ (y,name('94',y)) for y in [2020,2021,2022,2023]], name('96',2026), name('93',2022))
# 年度ごとの追加の上位の事項
for y in [2017,2020,2021,2022,2023,2024,2025,2026]:
    js=S['jikou'][str(y)]
    print(f'\n== {y} 追加上位の事項'); [print(' ',k,T(a),T(b)) for k,a,b,n in js[:6]]
    red=sorted(js,key=lambda z:z[2])[:4]; print('  減少上位'); [print('  ',k,T(a),T(b)) for k,a,b,n in red]
print('\n== 国債費の事項')
for y in Y:
    d=S['debt'][str(y)]; print(y,{k[:22]:T(v[2]) for k,v in d.items()})
