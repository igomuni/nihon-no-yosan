"""科学技術振興費（主要経費 13）の目の決算（FY2017〜FY2024）: 基金 4 目とそれ以外で、繰越・不用を比べる。
RS 2-2 の基金の目の行と、予算書（当初・補正差引）を、年度 × 予算種別 × 所管 × 基金で突き合わせる。出力 s3.json"""
import csv, glob, json, re, collections
ROOT = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
G = {'kakushin': '革新的研究開発推進基金', 'uchu': '宇宙開発支援基金', 'sohatsu': '創発的研究推進基金', 'kaken': '学術研究助成基金'}
grp = lambda m: next((k for k, t in G.items() if t in (m or '')), None)
rd = lambda y, f: (lambda fs: list(csv.DictReader(open(fs[0], encoding='utf-8'))) if fs else None)(glob.glob(f'{ROOT}/*/mof-archive/{y}/{f}'))
K = ['歳出予算額', '前年度繰越額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']
sci = {}
for y in range(2017, 2025):
    s = rd(y, 'moku-general-kessan.csv')
    cols = {n: [k for k in s[0] if k.startswith(n)][0] for n in K}
    acc = {'fund': collections.Counter(), 'other': collections.Counter()}
    for x in s:
        if x['主要経費別分類コード'] != '13': continue
        a = acc['fund' if grp(x['目名']) else 'other']
        for n, c in cols.items(): a[n] += int(x[c] or 0)
    sci[y] = {k: dict(v) for k, v in acc.items()}
# 予算書: 年度 × 種別（当初 / 補正） × 所管 × 基金（千円）
book = collections.Counter()
for y in range(2017, 2027):
    for x in rd(y, 'moku-general.csv'):
        g = grp(x['目名'])
        if g:
            c = [k for k in x if ('要求額' in k or '予定額' in k) and '前年度' not in k][0]
            book[(y, '当初', x['所管'], g)] += int(x[c] or 0)
    for f in ['moku-general-hosei.csv', 'moku-general-hosei-2.csv', 'moku-general-hosei-3.csv']:
        h = rd(y, f)
        if not h: continue
        c = [k for k in h[0] if '差引額' in k][0]
        for x in h:
            g = grp(x['目名'])
            if g: book[(y, '補正', x['所管'], g)] += int(x[c] or 0)
# RS 2-2（円）
rs = collections.Counter(); rsn = collections.Counter()
for r in csv.DictReader(open('/Users/igomuni/orca/nihon-no-yosan/data/download/rs/2025/2-2_RS_2025_予算・執行_予算種別・歳出予算項目.csv', encoding='utf-8-sig')):
    g = grp(r['目'])
    if not g: continue
    kind = '当初' if r['予算種別'] == '当初予算' else '補正' if '補正' in r['予算種別'] else r['予算種別']
    v = r['予算額(歳出予算項目ごと)']
    if re.fullmatch(r'-?\d+', v or ''): rs[(int(r['予算年度']), kind, r['所管'], g)] += int(v)
    else: rsn[(int(r['予算年度']), kind, r['所管'], g)] += 1
cmp = []
for key in sorted(set(rs) | {k for k in book if k[0] >= 2021 and k[0] <= 2025 and book[k] != 0}):
    b = book.get(key); r = rs.get(key)
    cmp.append({'y': key[0], 'kind': key[1], 'min': key[2], 'g': key[3], 'book_yen': None if b is None else b * 1000, 'rs_yen': r, 'rs_blank': rsn.get(key, 0)})
json.dump({'sci': sci, 'cmp': cmp}, open('s3.json', 'w'), ensure_ascii=False)
for y, d in sci.items():
    f, o = d['fund'], d['other']
    cr = lambda a: f"現額 {a.get('歳出予算現額',0)/1e12:.3f} 支出 {a.get('支出済歳出額',0)/1e12:.3f} 繰越 {a.get('翌年度繰越額',0)/1e12:.3f} 不用 {a.get('不用額',0)/1e12:.3f}"
    print(y, '基金', cr(f), '| 他', cr(o))
for c in cmp:
    ok = c['book_yen'] is not None and c['rs_yen'] is not None and c['book_yen'] == c['rs_yen']
    print(c['y'], c['kind'], c['min'], c['g'], c['book_yen'], c['rs_yen'], c['rs_blank'], 'OK' if ok else '')
