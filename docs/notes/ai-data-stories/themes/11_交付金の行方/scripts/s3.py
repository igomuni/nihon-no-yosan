# 系統ごと・年度ごとの入りと出、目（交付金の種類）ごとの締め
import json
s = json.load(open('s1.json'))
T = 1e12
def agg(rows, key):
    o = {}
    for r in rows:
        a = o.setdefault(key(r), {c: 0 for c in ['approp','cin','res','flow','mov','cur','spent','cout','unused']})
        for c in a: a[c] += r[c]
    return o
res = {}
for st in ('covid', 'price'):
    rows = [r for r in s['kou'] if r['stream'] == st]
    yr = agg(rows, lambda r: r['y'])
    tot = agg(rows, lambda r: 'all')['all']
    fresh = tot['approp'] + tot['res'] + tot['flow']
    # 2 項を合わせると、移替は内部で相殺し、前年度繰越は前年の翌年度繰越と同じはず
    print(st, '移替の合計（0 なら相殺）', tot['mov'])
    ys = sorted(yr)
    for a, b in zip(ys, ys[1:]):
        print(' ', a, '→', b, '繰越の受け渡し', yr[a]['cout'], yr[b]['cin'], yr[a]['cout'] == yr[b]['cin'])
    first, last = ys[0], ys[-1]
    print(st, '入り（補正＋予備費＋流用）', fresh / T, '支出', tot['spent'] / T, '不用', tot['unused'] / T, '最後の年度の翌年度繰越', yr[last]['cout'] / T,
          '締め', fresh - tot['spent'] - tot['unused'] - yr[last]['cout'], '最初の年度の前年度繰越', yr[first]['cin'])
    res[st] = {'years': {y: v for y, v in yr.items()}, 'fresh': fresh, 'spent': tot['spent'], 'unused': tot['unused'], 'end_cout': yr[last]['cout'], 'res': tot['res'], 'approp': tot['approp'],
               'by_min': {m: agg([r for r in rows if r['min'] == m], lambda r: r['y']) for m in ('内閣府', '総務省')}}
# 目ごと
mk = {}
for r in s['moku']:
    a = mk.setdefault((r['stream'], r['moku']), {c: 0 for c in ['approp','res','mov','spent','unused','cout']})
    for c in a: a[c] += r[c]
for (st, m), a in mk.items():
    print(st, m, {k: round(v / T, 4) for k, v in a.items()})
# 目ごとに、最後に見えた年度の翌年度繰越
mfin = {}
for r in s['moku']:
    key = (r['stream'], r['moku'])
    mfin.setdefault(key, {})
    mfin[key].setdefault(r['y'], 0); mfin[key][r['y']] += r['cout']
res['moku'] = [{'stream': st, 'moku': m, **a, 'cout_by_year': mfin[(st, m)]} for (st, m), a in mk.items()]
json.dump(res, open('s3.json', 'w'), ensure_ascii=False, indent=1, default=str)
