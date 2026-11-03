# 地方創生臨時交付金の 2 系統（コロナ・物価高騰）の項・目を、決算の CSV から円単位で読む
import csv, glob, json
ROOT = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
KOU = {'新型コロナウイルス感染症対応地方創生推進費': 'covid', '物価高騰対応地方創生推進費': 'price'}
COLS = {'歳出予算額': 'approp', '前年度繰越額': 'cin', '予備費使用額': 'res', '流用等増△減額': 'flow', '予算決定後移替増△減額': 'mov',
        '歳出予算現額': 'cur', '支出済歳出額': 'spent', '翌年度繰越額': 'cout', '不用額': 'unused'}
def col(row, key):
    for k in row:
        if k.startswith(key + '('): return k
    raise KeyError(key)
out = {'kou': [], 'moku': [], 'files': {}}
for y in range(2020, 2025):
    for kind, lst in (('kou', out['kou']), ('moku', out['moku'])):
        f = glob.glob(f'{ROOT}/*/mof-archive/{y}/{kind}-general-kessan.csv')
        assert len(f) == 1, f
        out['files'][f'{kind}{y}'] = f[0].replace(ROOT + '/', '')
        rows = list(csv.DictReader(open(f[0], encoding='utf-8')))
        for i, r in enumerate(rows):
            if r['項名'] not in KOU: continue
            rec = {'y': y, 'min': r['所管'], 'stream': KOU[r['項名']], 'kou': r['項名'], 'line': i + 2}
            if kind == 'moku': rec['moku'] = r['目名']
            for jp, k in COLS.items(): rec[k] = int(r[col(r, jp)] or 0)
            lst.append(rec)
# 恒等式の確認
bad = []
for lst in (out['kou'], out['moku']):
    for r in lst:
        if r['approp'] + r['cin'] + r['res'] + r['flow'] + r['mov'] != r['cur']: bad.append(('in', r))
        if r['spent'] + r['cout'] + r['unused'] != r['cur']: bad.append(('out', r))
print('恒等式の不一致', len(bad))
# 目の計 = 項
for k in out['kou']:
    m = [x for x in out['moku'] if x['y'] == k['y'] and x['min'] == k['min'] and x['kou'] == k['kou']]
    for c in COLS.values():
        if sum(x[c] for x in m) != k[c]: print('目と項の差', k['y'], k['min'], k['kou'], c, sum(x[c] for x in m) - k[c])
json.dump(out, open('s1.json', 'w'), ensure_ascii=False, indent=1)
print(len(out['kou']), len(out['moku']))
