# 検算: 勘定ごとの決算（項の CSV）と、目の合計（s1.json）を比べる。当初は項の CSV（kou-special.csv）とも比べる
import csv, json, os
D = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
o = json.load(open('s1.json'))
def p(y, f): return f"{D}/{'reference-v0' if y >= 2023 else 'mof-history-v0'}/mof-archive/{y}/{f}"
bad = 0; n = 0
for y in range(2017, 2025):
    kk = [r for r in csv.DictReader(open(p(y, 'kou-special-kessan.csv'), encoding='utf-8')) if r['特別会計'] == '年金']
    kb = [r for r in csv.DictReader(open(p(y, 'kou-special.csv'), encoding='utf-8')) if r['特別会計'] == '年金']
    amt = [k for k in kb[0] if ('予定額' in k or '要求額' in k) and '前年度' not in k][0]
    for acct in sorted({r['勘定'] for r in kk}):
        for key, col in [('cur', '歳出予算現額(円)'), ('spent', '支出済歳出額(円)'), ('unused', '不用額(円)'), ('cout', '翌年度繰越額(円)')]:
            a = sum(int(r.get(col, r.get(col + 'の合計')) or 0) for r in kk if r['勘定'] == acct)
            b = sum(e['y'].get(str(y), {}).get(key, 0) for e in o.values() if e['acct'] == acct)
            n += 1; bad += a != b
        a = sum(int(r[amt] or 0) * 1000 for r in kb if r['勘定'] == acct)
        b = sum(e['y'].get(str(y), {}).get('budget', 0) for e in o.values() if e['acct'] == acct)
        n += 1; bad += a != b
        if a != b: print('budget diff', y, acct, a - b)
print('比較', n, '不一致', bad)
