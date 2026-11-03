"""検算: c1.py とは別の読み方（csv.reader と列番号、契約の行の判定も別の書き方）で、方式ごとの合計・一般競争の入札者 1 の件数と額・法人種別 301〜305 の方式別合計を出し、c1.json と比べる。
使い方: python3 -I v1.py <RS の CSV のディレクトリ> <c1.json>
"""
import csv, json, sys, collections
src, c1 = sys.argv[1], json.load(open(sys.argv[2]))
f = open(f'{src}/5-1_RS_2025_支出先_支出情報.csv', encoding='utf-8-sig'); rd = csv.reader(f); h = next(rd); ix = {k: i for i, k in enumerate(h)}
tot = collections.Counter(); one = collections.Counter(); one_n = collections.Counter(); n = collections.Counter(); comp = collections.Counter()
for row in rd:
    amt, name, sup_total = row[ix['金額']], row[ix['支出先名']], row[ix['支出先の合計支出額']]
    if not name or sup_total or not amt.lstrip('-').isdigit(): continue
    m = row[ix['契約方式等']]; v = int(amt)
    tot[m] += v; n[m] += 1
    if m.startswith('一般競争') and row[ix['入札者数']] == '1': one[m] += v; one_n[m] += 1
    if row[ix['法人種別']] in ('301', '302', '303', '304', '305') and row[ix['その他支出先']] != 'TRUE' and row[ix['法人番号']] != '9999999999999': comp[m] += v
ok = True
for m, v in tot.items():
    c = sum(c1['by_m_d'][m].values()); cn = sum(c1['by_m_d_n'][m].values())
    if c != v or cn != n[m]: ok = False; print('NG 方式', m, v, c, n[m], cn)
for m in one:
    c = c1['bids_amt'][m].get('1', 0); cn = c1['bids'][m].get('1', 0)
    if c != one[m] or cn != one_n[m]: ok = False; print('NG 一者', m, one[m], c, one_n[m], cn)
print('方式ごとの合計・件数、一般競争の入札者 1:', 'すべて一致' if ok else '不一致あり')
print('合計（兆円）', round(sum(tot.values()) / 1e12, 4), '件数', sum(n.values()))
print('一般競争の入札者 1', {m: (one_n[m], round(one[m] / 1e8, 1)) for m in one})
print('法人種別 301〜305 の全段・方式別（兆円）', {m: round(v / 1e12, 3) for m, v in sorted(comp.items(), key=lambda x: -x[1])})
