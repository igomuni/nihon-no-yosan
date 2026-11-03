# LP に埋め込む値を作る（円 → 億円の整数）
import json
o = json.load(open('s1.json')); g = json.load(open('s3.json'))
Y = [str(y) for y in range(2017, 2025)]
oku = lambda v: None if v is None else round(v / 1e8)
def ser(d, k): return [oku(d.get(y, {}).get(k)) if y in d and k in d[y] else None for y in Y]
ACC = ['基礎年金勘定', '厚生年金勘定', '国民年金勘定', '健康勘定', '子ども・子育て支援勘定', '業務勘定']
acc = {}
for e in o.values():
    for y, d in e['y'].items():
        a = acc.setdefault(e['acct'], {}).setdefault(y, {})
        for k, v in d.items(): a[k] = a.get(k, 0) + v
accs = [{'n': a, 'budget': ser(acc[a], 'budget'), 'appr': ser(acc[a], 'appr'), 'cur': ser(acc[a], 'cur'), 'spent': ser(acc[a], 'spent'), 'unused': ser(acc[a], 'unused'), 'cout': ser(acc[a], 'cout')} for a in ACC]
def m(acct, kou, moku):
    e = o['|'.join([acct, kou, moku])]
    return {'n': moku if moku != kou else kou, 'acct': acct, 'kou': kou, 'budget': ser(e['y'], 'budget'), 'appr': ser(e['y'], 'appr'), 'spent': ser(e['y'], 'spent'), 'unused': ser(e['y'], 'unused')}
mok = [
    m('基礎年金勘定', '基礎年金給付費', '基礎年金給付費'),
    m('厚生年金勘定', '保険給付費', '保険給付費'),
    m('厚生年金勘定', '基礎年金給付費等基礎年金勘定へ繰入', '基礎年金勘定へ繰入'),
    m('国民年金勘定', '基礎年金給付費等基礎年金勘定へ繰入', '基礎年金勘定へ繰入'),
    m('国民年金勘定', '国民年金給付費', '国民年金給付費'),
    m('健康勘定', '保険料等交付金', '保険料等交付金'),
    m('子ども・子育て支援勘定', '児童手当等交付金', '児童手当交付金'),
    m('厚生年金勘定', '保険給付費', '存続厚生年金基金等給付費等負担金'),
]
gk = g['基礎年金拠出金等年金特別会計へ繰入|基礎年金年金特別会計へ繰入']
gen = {'n': '一般会計の「基礎年金年金特別会計へ繰入」', 'budget': ser(gk, 'budget'), 'appr': ser(gk, 'appr'), 'spent': ser(gk, 'spent'), 'unused': ser(gk, 'unused')}
kouGen = [sum(g[k].get(y, {}).get('budget', 0) for k in g if k.startswith('基礎年金拠出金等')) for y in Y]
tot8 = lambda s: sum(x or 0 for x in s)
allcur = sum(tot8(a['cur']) for a in accs); allun = sum(tot8(a['unused']) for a in accs); allsp = sum(tot8(a['spent']) for a in accs)
data = {'Y': [int(y) for y in Y], 'acc': accs, 'moku': mok, 'gen': gen, 'kouGen': [oku(v) for v in kouGen], 'tot': {'cur': allcur, 'unused': allun, 'spent': allsp}}
json.dump(data, open('page-data.json', 'w'), ensure_ascii=False)
print('8年 現額', allcur, '不用', allun, '支出', allsp, '不用率', round(allun / allcur * 100, 2))
b = mok[0]; print('基礎年金給付費 gap', [ (b['budget'][i] - b['spent'][i]) for i in range(8)], b['unused'])
print('一般会計 基礎年金繰入 不用', gen['unused'], '項計', data['kouGen'])
for x in mok[2:4]: print(x['acct'], x['unused'])
