# 境界: 一般会計で、経済性質別が 71（他に分類されない国内経常移転）のうち、
# 目名に「後期高齢者」「介護」「国民健康保険」を含む負担金・交付金・補助金（保険者が広域連合・市町村などの社会保険への国費）。
# 全国健康保険協会・国民健康保険組合（保険者が地方ではない）と、名前に「災害」を含む臨時の補助金は除く
import csv, glob, re, sys, json, collections
out = {}
for y in range(2017, 2027):
    d = '2025_teishutsu' if y == 2025 else str(y)
    f = sorted(glob.glob(f'*/mof-archive/{d}/moku-general.csv'))[0]
    r = list(csv.DictReader(open(f, encoding='utf-8')))
    amt = [k for k in r[0] if re.match(r'^(令和|平成)(元|\d+)年度(要求|予定)額', k)][0]
    ec = [k for k in r[0] if '経済性質' in k][0]
    c = collections.Counter()
    for x in r:
        if x[ec].strip() == '71' and re.search(r'(後期高齢者|介護|国民健康保険)', x['目名']) and re.search(r'(負担金|交付金|補助金)$', x['目名']) and not re.search(r'(全国健康保険協会|組合|災害)', x['目名']):
            c[x['目名']] += int(x[amt] or 0)
    out[y] = dict(c)
    print(y, round(sum(c.values()) / 1e9, 2), [(k, round(v / 1e9, 2)) for k, v in c.most_common(6)])
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False)
