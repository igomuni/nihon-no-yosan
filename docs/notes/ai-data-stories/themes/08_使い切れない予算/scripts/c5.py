# 繰越の行方: 事業のまとまり（同じ項名の項。移替の相手の所管も含める）ごとに、期間の入りと出を締める
# 入り = 歳出予算額 + 予備費使用額 + 流用等 + 移替（まとまりの中の移替は相殺）、出 = 支出済 + 不用、残り = 最後の年度の翌年度繰越
import csv, os, json
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y):
    for d in ('mof-history-v0', 'reference-v0'):
        p = f'{base}/{d}/mof-archive/{y}/kou-general-kessan.csv'
        if os.path.exists(p): return p
data = {y: list(csv.DictReader(open(path(y), encoding='utf-8'))) for y in range(2017, 2025)}
def num(r, key): return int(r[[c for c in r if c.startswith(key)][0]] or 0)
progs = {
  'covid': ('新型コロナ対応の地方創生臨時交付金など', [('内閣府', '新型コロナウイルス感染症対応地方創生推進費'), ('総務省', '新型コロナウイルス感染症対応地方創生推進費')]),
  'bukka': ('物価高騰対応の地方創生臨時交付金など', [('内閣府', '物価高騰対応地方創生推進費'), ('総務省', '物価高騰対応地方創生推進費')]),
  'kanko': ('観光振興費（国土交通省）', [('国土交通省', '観光振興費')]),
  'energy': ('エネルギー需給構造高度化対策費（経済産業省）', [('経済産業省', 'エネルギー需給構造高度化対策費')]),
  'shakai': ('社会資本総合整備事業費（国土交通省）', [('国土交通省', '社会資本総合整備事業費')]),
}
out = {}
for key, (label, members) in progs.items():
    yrs = []
    for y, rows in data.items():
        rs = [r for r in rows if (r['所管'], r['項名']) in members]
        if not rs: continue
        s = lambda k: sum(num(r, k) for r in rs)
        yrs.append({'y': y, 'appr': s('歳出予算額'), 'cin': s('前年度繰越額'), 'res': s('予備費使用額'), 'fung': s('流用等'), 'tr': s('予算決定後移替'), 'cur': s('歳出予算現額'), 'spent': s('支出済歳出額'), 'cout': s('翌年度繰越額'), 'un': s('不用額')})
    new = sum(x['appr'] + x['res'] + x['fung'] + x['tr'] for x in yrs)
    spent = sum(x['spent'] for x in yrs); un = sum(x['un'] for x in yrs)
    start = yrs[0]['cin']; end = yrs[-1]['cout']
    # 年度の受け渡し: cout(y) = cin(y+1)
    hand = all(a['cout'] == b['cin'] for a, b in zip(yrs, yrs[1:]) if b['y'] == a['y'] + 1)
    gap = new + start - spent - un - end
    out[key] = {'label': label, 'years': yrs, 'new': new, 'spent': spent, 'un': un, 'start': start, 'end': end, 'handoff': hand, 'gap': gap}
    T = lambda v: round(v / 1e12, 3)
    print(label, '期間', yrs[0]['y'], '-', yrs[-1]['y'], '入り', T(new), '期首繰越', T(start), '支出', T(spent), '不用', T(un), '期末繰越', T(end), '締めの差', gap, '受け渡し一致', hand)
    print('   ', [(x['y'], T(x['cur']), T(x['spent']), T(x['cout']), T(x['un']), T(x['tr'])) for x in yrs])
json.dump(out, open('c5.json', 'w'), ensure_ascii=False)
