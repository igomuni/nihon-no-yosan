# 検算: 予算書の目の CSV を直接読み、経済性質別 80〜86 を合計する（目のデータを通さない）
import csv, glob, re, sys, json
out = {}
for y in range(2017, 2027):
    for a in ('general', 'special'):
        fs = [f for f in glob.glob(f'*/mof-archive/{y}/moku-{a}.csv')]
        if y == 2025: fs = [f for f in glob.glob(f'*/mof-archive/2025_teishutsu/moku-{a}.csv')]
        f = sorted(fs)[0]
        r = list(csv.DictReader(open(f, encoding='utf-8')))
        amt = [k for k in r[0] if re.match(r'^(令和|平成)(元|\d+)年度(要求|予定)額', k)][0]
        ec = [k for k in r[0] if '経済性質' in k][0]
        tot = sum(int(x[amt] or 0) for x in r)
        loc = sum(int(x[amt] or 0) for x in r if re.match(r'^8[0-6]$', x[ec].strip()))
        nm = sum(int(x[amt] or 0) for x in r if re.search(r'(負担金|補助金|交付金|補助)$', x['目名']) and not re.match(r'^8[0-6]$', x[ec].strip()))
        out[f'{y}-{a}'] = [tot, loc, nm, f]
        print(y, a, f'合計 {tot/1e9:.2f} 対地方8x {loc/1e9:.3f} 名前が補助金等で8x以外 {nm/1e9:.2f}', f)
json.dump(out, open(sys.argv[1], 'w'))
