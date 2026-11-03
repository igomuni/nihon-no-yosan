"""検算: 5-1 を csv.reader の列番号で読み直し、防衛省・1 段目の調達の額・件数、随意契約(その他)の額、競争の入札者 1 者の件数を出す（d1.py と別の読み方）。
1 段目の判定は 5-2 の「担当組織からの支出」が TRUE のブロック（深さ 1 だけなので、つながりをたどらない）。"""
import csv, sys, re
src = sys.argv[1]
f2 = csv.reader(open(f'{src}/5-2_RS_2025_支出先_支出ブロックのつながり.csv', encoding='utf-8-sig')); h2 = next(f2)
iI, iOrg, iTo = h2.index('予算事業ID'), h2.index('担当組織からの支出'), h2.index('支出先の支出先ブロック')
first = {(r[iI], r[iTo]) for r in f2 if r[iOrg] == 'TRUE' and r[iTo]}
f = csv.reader(open(f'{src}/5-1_RS_2025_支出先_支出情報.csv', encoding='utf-8-sig')); h = next(f)
c = {k: h.index(k) for k in ('府省庁', '予算事業ID', '支出先ブロック番号', '支出先名', '支出先の合計支出額', '契約概要', '金額', '契約方式等', '入札者数')}
PROC = {'一般競争契約(最低価格)', '一般競争契約(総合評価)', '指名競争契約(最低価格)', '指名競争契約(総合評価)', '随意契約(企画競争)', '随意契約(公募)', '随意契約(不落・不調)', '随意契約(少額)', '随意契約(その他)'}
proc = n = nc = comp = one = allamt = kok = 0
for r in f:
    if r[c['府省庁']] != '防衛省' or not r[c['支出先名']] or r[c['支出先の合計支出額']]: continue
    if not (r[c['契約概要']] or r[c['金額']] or r[c['契約方式等']]) or not re.fullmatch(r'-?\d+', r[c['金額']]): continue
    if (r[c['予算事業ID']], r[c['支出先ブロック番号']]) not in first: continue
    v = int(r[c['金額']]); m = r[c['契約方式等']]; allamt += v
    if m == '国庫債務負担行為等': kok += v
    if m in PROC:
        proc += v; n += 1
        if m == '随意契約(その他)': nc += v
        if m.startswith(('一般競争', '指名競争')):
            comp += 1
            if r[c['入札者数']] == '1': one += 1
print({'all': allamt, 'proc': proc, 'n': n, 'nc': nc, 'nc_share': round(nc / proc * 100, 1), 'kok': kok, 'comp': comp, 'one': one, 'one_share': round(one / comp * 100, 1)})
