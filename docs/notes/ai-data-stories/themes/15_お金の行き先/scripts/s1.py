"""テーマ E: RS 2025 年度版の支出先（5-1・5-2）を集計する。出力: s1.json
使い方: python3 -I s1.py <RS の CSV のディレクトリ> <出力ディレクトリ>
"""
import csv, json, re, sys, collections
import unicodedata as _ud
def read_rs_rows(path):
    """RS の配布物（サイトの CSV）を、そのまま読む。見出しとセルを NFKC にし、セルの前後の空白を除く（`rs-spend-v0` を作るときと同じ。契約方式などの名前の全角のかっこを半角にそろえる）。(見出し, 行) を返す"""
    f = open(path, encoding='utf-8-sig', newline='')
    r = csv.reader(f)
    h = [_ud.normalize('NFKC', x).strip() for x in next(r)]
    return h, ([_ud.normalize('NFKC', x).strip() for x in row] + [''] * (len(h) - len(row)) for row in r)
def read_rs_dict(path):
    h, rows = read_rs_rows(path)
    return (dict(zip(h, row)) for row in rows)
src, out = sys.argv[1], sys.argv[2]
rd = lambda name: read_rs_dict(f'{src}/{name}')
num = lambda s: int(s) if re.fullmatch(r'-?\d+', s or '') else None

# ---- 5-2: ブロックのつながり（担当組織 → ブロック、ブロック → ブロック）。額は無い
org_to = collections.defaultdict(set)      # 事業 ID → 担当組織から支出されるブロック
edges = collections.defaultdict(set)       # (事業 ID, 支出元ブロック) → 支出先ブロック
indirect = collections.Counter()           # 事業 ID → 国自らが支出する間接経費
for r in rd('5-2_RS_2025_支出先_支出ブロックのつながり.csv'):
    i = r['予算事業ID']
    if r['担当組織からの支出'] == 'TRUE' and r['支出先の支出先ブロック']:
        org_to[i].add(r['支出先の支出先ブロック'])
    elif r['担当組織からの支出'] == 'FALSE' and r['支出元の支出先ブロック'] and r['支出先の支出先ブロック']:
        edges[(i, r['支出元の支出先ブロック'])].add(r['支出先の支出先ブロック'])
    if r['国自らが支出する間接経費'] and num(r['国自らが支出する間接経費の金額']) is not None:
        indirect[i] += num(r['国自らが支出する間接経費の金額'])

# 段の深さ（担当組織から何段目か。1 = 国から直接）。たどれないブロックは None
depth = {}
for i, firsts in org_to.items():
    q = [(b, 1) for b in sorted(firsts)]
    while q:
        b, d = q.pop(0)
        if (i, b) in depth and depth[(i, b)] <= d: continue
        depth[(i, b)] = d
        for nb in edges.get((i, b), ()): q.append((nb, d + 1))

# ---- 5-1: ブロックの合計と、支出先ごとの合計（支出先の合計支出額のある行だけ。契約の行は数えない）
blocks, recs = {}, []
meta = {}
for r in rd('5-1_RS_2025_支出先_支出情報.csv'):
    i, b = r['予算事業ID'], r['支出先ブロック番号']
    meta.setdefault(i, (r['府省庁'], r['事業名']))
    if (r['支出先ブロック名'] or r['ブロックの合計支出額']) and not r['支出先名']:
        blocks[(i, b)] = {'amt': num(r['ブロックの合計支出額']), 'role': r['事業を行う上での役割'], 'n': num(r['支出先の数'])}
    elif r['支出先名'] and r['支出先の合計支出額']:
        recs.append({'id': i, 'b': b, 'name': r['支出先名'], 'hno': r['法人番号'], 'kind': r['法人種別'], 'other': r['その他支出先'], 'amt': num(r['支出先の合計支出額'])})

NAME_RULES = [(r'国立研究開発法人|独立行政法人', '独立行政法人'), (r'国立大学法人|大学共同利用機関法人', '国立大学法人等'),
              (r'公益財団法人|公益社団法人', '公益法人'), (r'一般財団法人|一般社団法人', '一般財団・社団法人'),
              (r'学校法人', '学校法人'), (r'社会福祉法人|医療法人', '社会福祉・医療法人'),
              (r'協同組合|連合会|中央会|共済', '協同組合・連合会など'), (r'地方独立行政法人|公立大学法人', '地方独立行政法人')]
LOCAL = r'(都|道|府|県|市|区|町|村)$|警察本部$|教育委員会$|広域連合$|企業団$|一部事務組合$'
STATE = r'(省|庁|局|府|院|会議|本部|事務所|研究所|裁判所)$'
def by_name(n):
    for pat, lab in NAME_RULES:
        if re.search(pat, n): return lab
    return None
def cat(rec):
    """支出先の種類。法人種別のコード（国税庁の法人番号の区分。コードの意味は AI の知識で、名前の語で照合した）と、名前の語で分ける"""
    k, n = rec['kind'], rec['name'].strip()
    if rec['other'] == 'TRUE':
        if re.search(r'受給者|農業者', n): return 'まとめた支出先: 給付の受給者'
        if re.search(r'借入金|回収金', n): return 'まとめた支出先: 借入金の返済など'
        if n.startswith('その他'): return 'まとめた支出先: 「その他」'
        return 'まとめた支出先: その他の集まり'
    if rec['hno'] == '9999999999999': return '法人番号なし（個人を含む。名前を出さない）'
    if k == '101': return '国の機関'
    if k == '201': return '地方公共団体'
    if k in ('301', '302', '303', '304', '305'): return '会社'
    if k == '401': return '外国会社等'
    if k in ('399', '499'): return by_name(n) or 'その他の法人'
    # 法人種別が空: 名前の語で分ける
    lab = by_name(n)
    if lab: return lab
    if re.search(LOCAL, n): return '地方公共団体'
    if re.search(STATE, n): return '国の機関'
    if re.search(r'株式会社|有限会社|合同会社|合資会社|合名会社', n): return '会社'
    return '法人番号なしの支出先（名前を出さない）' if not rec['hno'] else 'その他の法人'

for x in recs:
    x['cat'] = cat(x)
    x['d'] = depth.get((x['id'], x['b']))

# 1 段目（国から直接）のブロックの合計 = 国が払った額の近似
stage = collections.Counter(); stage_rec = collections.Counter()
for (i, b), v in blocks.items():
    if v['amt'] is not None: stage[depth.get((i, b))] += v['amt']
for x in recs:
    if x['amt'] is not None: stage_rec[x['d']] += x['amt']

by_cat = collections.defaultdict(lambda: collections.Counter())
for x in recs:
    if x['amt'] is None: continue
    by_cat[x['cat']]['all'] += x['amt']; by_cat[x['cat']]['n_all'] += 1
    if x['d'] == 1: by_cat[x['cat']]['s1'] += x['amt']; by_cat[x['cat']]['n_s1'] += 1

# 法人番号のある支出先の上位（1 段目、全事業の合計）。法人番号なし・まとめた支出先は名前を出さない
top = collections.defaultdict(lambda: {'amt': 0, 'ids': set(), 'name': '', 'cat': ''})
for x in recs:
    if x['d'] != 1 or not re.fullmatch(r'\d{13}', x['hno']) or x['hno'] == '9999999999999' or x['other'] == 'TRUE' or x['amt'] is None: continue
    t = top[x['hno']]; t['amt'] += x['amt']; t['ids'].add(x['id']); t.setdefault('names', collections.Counter())[x['name']] += x['amt']; t['cat'] = x['cat']
top_list = sorted(top.values(), key=lambda t: -t['amt'])[:30]

# 多段: 事業ごとの最大の深さ、府省ごと
maxd = {}
for (i, b), d in depth.items(): maxd[i] = max(maxd.get(i, 0), d)
ids_with_blocks = {i for (i, b) in blocks}
deep_by_min = collections.defaultdict(lambda: collections.Counter())
for i in ids_with_blocks:
    m = meta[i][0]; d = maxd.get(i)
    deep_by_min[m]['n'] += 1
    if d is not None and d >= 2: deep_by_min[m]['multi'] += 1
    if d is not None and d >= 3: deep_by_min[m]['d3'] += 1
dist = collections.Counter(maxd.get(i) for i in ids_with_blocks)
deepest = sorted(((maxd[i], i) for i in maxd if maxd[i] >= 4), reverse=True)[:15]

s1_tmp = collections.Counter()
for (i, b), v in blocks.items():
    if depth.get((i, b)) == 1 and v['amt'] is not None: s1_tmp[i] += v['amt']
cat_depth = collections.defaultdict(collections.Counter)
for x in recs:
    if x['amt'] is not None: cat_depth[x['cat']][str(x['d'])] += x['amt']
# 2 段目以降へ流れる額の大きい事業（2 段目以降のブロックの合計）
down = collections.Counter(); dmax = {}
for (i, b), v in blocks.items():
    d = depth.get((i, b))
    if d is not None and d >= 2 and v['amt'] is not None: down[i] += v['amt']
top_down = [{'id': i, 'min': meta[i][0], 'name': meta[i][1], 'down': a, 's1': s1_tmp.get(i, 0), 'maxd': maxd.get(i)} for i, a in down.most_common(15)]
min_down = collections.Counter(); min_s1 = collections.Counter()
for (i, b), v in blocks.items():
    d = depth.get((i, b))
    if v['amt'] is None or d is None: continue
    if d == 1: min_s1[meta[i][0]] += v['amt']
    else: min_down[meta[i][0]] += v['amt']
res = {
    'n_rows_rec': len(recs), 'n_blocks': len(blocks), 'n_jigyo_blocks': len(ids_with_blocks),
    'blocks_no_depth': sum(1 for k in blocks if k not in depth), 'blocks_no_depth_amt': sum(v['amt'] or 0 for k, v in blocks.items() if k not in depth),
    'stage_block': {str(k): v for k, v in stage.items()}, 'stage_rec': {str(k): v for k, v in stage_rec.items()},
    'indirect_total': sum(indirect.values()),
    'by_cat': {k: dict(v) for k, v in by_cat.items()},
    'top': [{'name': t['names'].most_common(1)[0][0], 'names': [n for n, _ in t['names'].most_common(4)], 'others': len(t['names']) - 1, 'cat': t['cat'], 'amt': t['amt'], 'n': len(t['ids'])} for t in top_list],
    'depth_dist': {str(k): v for k, v in dist.items()},
    'deep_by_min': {k: dict(v) for k, v in deep_by_min.items()},
    'deepest': [{'d': d, 'id': i, 'min': meta[i][0], 'name': meta[i][1]} for d, i in deepest],
    'cat_depth': {k: dict(v) for k, v in cat_depth.items()}, 'top_down': top_down,
    'min_down': dict(min_down), 'min_s1': dict(min_s1),
    'blank_amt_blocks': sum(1 for v in blocks.values() if v['amt'] is None),
}
# 1 段目の事業ごとの合計（検算用）
s1_by_id = collections.Counter()
for (i, b), v in blocks.items():
    if depth.get((i, b)) == 1 and v['amt'] is not None: s1_by_id[i] += v['amt']
res['s1_by_id'] = dict(s1_by_id)
res['indirect_by_id'] = dict(indirect)
json.dump(res, open(f'{out}/s1.json', 'w'), ensure_ascii=False)
print(json.dumps({k: v for k, v in res.items() if k not in ('s1_by_id', 'indirect_by_id', 'top', 'deep_by_min')}, ensure_ascii=False, indent=1))
print('cats', json.dumps(res['by_cat'], ensure_ascii=False)); print('top', [(t['name'][:20], t['cat'], round(t['amt'] / 1e8)) for t in res['top'][:15]])
