# 検算: 項の CSV（目を通さない）で、交付税特会の項と、一般会計の地方交付税交付金・地方特例交付金の項
import csv, glob, re, json, sys
out = {}
for y in range(2017, 2027):
    d = '2025_teishutsu' if y == 2025 else str(y)
    res = {}
    for a in ('general', 'special'):
        f = sorted(glob.glob(f'*/mof-archive/{d}/kou-{a}.csv'))[0]
        r = list(csv.DictReader(open(f, encoding='utf-8')))
        amt = [k for k in r[0] if re.match(r'^(令和|平成)(元|\d+)年度(要求|予定)額', k)][0]
        for x in r:
            name = x['項名']; v = int(x[amt] or 0)
            if a == 'general' and name in ('地方交付税交付金', '地方特例交付金'): res['一般/' + name] = res.get('一般/' + name, 0) + v
            if a == 'special' and '交付税及び譲与税配付金' in ''.join(x.values()) and x.get('勘定', '') == '' or (a == 'special' and x.get('特別会計', x.get('会計', '')).startswith('交付税')):
                res['特会/' + name] = res.get('特会/' + name, 0) + v
    out[y] = res
    print(y, {k: round(v / 1e9, 2) for k, v in res.items()})
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False)
