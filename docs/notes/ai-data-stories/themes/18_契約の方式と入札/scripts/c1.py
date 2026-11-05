"""テーマ C: RS 2025 年度版（FY2024 の執行）の 5-1 の契約の行を、契約方式・段・支出先の種類・府省で集計する。出力: c1.json
使い方: python3 -I c1.py <RS の CSV のディレクトリ> <出力ディレクトリ>
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

# ---- 段の深さ（3 回目の s1.py と同じ。5-2 の担当組織 → ブロック、ブロック → ブロック）
org_to = collections.defaultdict(set); edges = collections.defaultdict(set)
for r in rd('5-2_RS_2025_支出先_支出ブロックのつながり.csv'):
    i = r['予算事業ID']
    if r['担当組織からの支出'] == 'TRUE' and r['支出先の支出先ブロック']: org_to[i].add(r['支出先の支出先ブロック'])
    elif r['担当組織からの支出'] == 'FALSE' and r['支出元の支出先ブロック'] and r['支出先の支出先ブロック']:
        edges[(i, r['支出元の支出先ブロック'])].add(r['支出先の支出先ブロック'])
depth = {}
for i, firsts in org_to.items():
    q = [(b, 1) for b in sorted(firsts)]
    while q:
        b, d = q.pop(0)
        if (i, b) in depth and depth[(i, b)] <= d: continue
        depth[(i, b)] = d
        for nb in edges.get((i, b), ()): q.append((nb, d + 1))

# 契約方式の区分（RS の「契約方式等」の値そのもの。調達 = 競争契約と随意契約）
PROC = ['一般競争契約(最低価格)', '一般競争契約(総合評価)', '指名競争契約(最低価格)', '指名競争契約(総合評価)',
        '随意契約(企画競争)', '随意契約(公募)', '随意契約(不落・不調)', '随意契約(少額)', '随意契約(その他)']
NONPROC = ['補助金等交付', '運営費交付金交付', '国庫債務負担行為等', 'その他', '']
COMPANY = {'301', '302', '303', '304', '305'}
EMPTY_REASON = re.compile(r'^[\s\-－ー―‐−‑—]*$')

# 支出先の種類: 3 回目（r3e-recipients/s1.py の cat）と同じ分け方。会社 = 法人種別 301〜305、または法人種別が空で名前に株式会社など
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
def kind_of(k, hno, other, name):
    n = name.strip()
    if other == 'TRUE': return 'まとめた支出先'
    if hno == '9999999999999': return '法人番号なし'
    if k == '101': return '国の機関'
    if k == '201': return '地方公共団体'
    if k in COMPANY: return '会社'
    if k == '401': return '外国会社等'
    if k in ('399', '499'): return by_name(n) or 'その他の法人'
    lab = by_name(n)
    if lab: return lab
    if re.search(LOCAL, n): return '地方公共団体'
    if re.search(STATE, n): return '国の機関'
    if re.search(r'株式会社|有限会社|合同会社|合資会社|合名会社', n): return '会社'
    return '法人番号なし' if not hno else 'その他の法人'

def bid_bin(b):
    n = num(b)
    if n is None or n == 0: return '未記入・0'
    if n >= 11: return '11以上'
    if n >= 6: return '6〜10'
    return str(n)

def rate_bin(x):
    try: v = float(x)
    except ValueError: return '未記入'
    if v == 0: return '0（未記入とみなす）'
    if v > 100: return '100超'
    if v == 100: return '100'
    for lo in (99, 95, 90, 80, 70, 60, 50):
        if v >= lo: return f'{lo}〜'
    return '50未満'

C = lambda: collections.Counter()
by_m_d = collections.defaultdict(C)          # 方式 → 段 → 額
by_m_d_n = collections.defaultdict(C)
by_m_kind1 = collections.defaultdict(C)      # 方式 → 種類（1 段目）
by_m_kind1_n = collections.defaultdict(C)
bids = collections.defaultdict(C); bids_amt = collections.defaultdict(C)   # 方式 → 入札者数の区分
rates = collections.defaultdict(C); rates_amt = collections.defaultdict(C)
by_min = collections.defaultdict(C)          # 府省（1 段目・調達）
other_contract = C()                          # 「その他の契約」TRUE の行
big = collections.defaultdict(C)             # 10 億円以上: 方式 → 件数・理由の記入
top_nc = []                                   # 随意契約(その他)・1 段目・会社などの大きい契約（法人のみ）
one_bid_top = []                              # 一般競争で入札者 1 の大きい契約（1 段目、法人のみ）
sup_tot, con_sum = {}, C()
meta = {}
for r in rd('5-1_RS_2025_支出先_支出情報.csv'):
    i, b = r['予算事業ID'], r['支出先ブロック番号']
    meta.setdefault(i, (r['府省庁'], r['事業名']))
    key = (i, b, r['支出先名'], r['法人番号'])
    if r['支出先名'] and r['支出先の合計支出額']:
        sup_tot[key] = num(r['支出先の合計支出額']); continue
    if not (r['支出先名'] and (r['契約概要'] or r['金額'] or r['契約方式等'])): continue
    v = num(r['金額'])
    if v is None: continue
    con_sum[key] += v
    m = r['契約方式等']; d = depth.get((i, b)); ds = '1' if d == 1 else ('2以上' if d else 'たどれない')
    kind = kind_of(r['法人種別'], r['法人番号'], r['その他支出先'], r['支出先名'])
    by_m_d[m][ds] += v; by_m_d_n[m][ds] += 1
    if d == 1:
        by_m_kind1[m][kind] += v; by_m_kind1_n[m][kind] += 1
    if r['その他の契約'] == 'TRUE':
        other_contract['n'] += 1; other_contract['amt'] += v
        if m in PROC: other_contract['proc_n'] += 1; other_contract['proc_amt'] += v
    if m in PROC:
        bb = bid_bin(r['入札者数']); bids[m][bb] += 1; bids_amt[m][bb] += v
        rb = rate_bin(r['落札率']); rates[m][rb] += 1; rates_amt[m][rb] += v
        if d == 1:
            mn = meta[i][0]; s = by_min[mn]
            s['proc'] += v; s['proc_n'] += 1
            if m == '随意契約(その他)': s['nc'] += v; s['nc_n'] += 1
            if m.startswith('一般競争') or m.startswith('指名競争'):
                s['comp_n'] += 1; s['comp'] += v
                if num(r['入札者数']) == 1: s['one_n'] += 1; s['one'] += v
                if bb == '未記入・0': s['comp_unknown_n'] += 1
        named = kind not in ('まとめた支出先', '法人番号なし') and re.fullmatch(r'\d{13}', r['法人番号'] or '') and r['法人番号'] != '9999999999999'
        if d == 1 and named and r['その他の契約'] != 'TRUE':
            row = {'min': meta[i][0], 'jigyo': meta[i][1], 'name': r['支出先名'], 'kind': kind, 'gaiyo': r['契約概要'][:60], 'amt': v, 'bid': r['入札者数'], 'rate': r['落札率'], 'm': m}
            if m == '随意契約(その他)': top_nc.append(row)
            if m.startswith('一般競争') and num(r['入札者数']) == 1: one_bid_top.append(row)
    if v >= 1_000_000_000:
        big[m]['n'] += 1; big[m]['amt'] += v
        if not EMPTY_REASON.match(r['一者応札・一者応募又は競争性のない随意契約となった理由及び改善策(支出額10億円以上)']): big[m]['reason'] += 1
        if m in PROC and (num(r['入札者数']) == 1 or m == '随意契約(その他)'):
            big[m]['target'] += 1; big[m]['target_amt'] += v
            if not EMPTY_REASON.match(r['一者応札・一者応募又は競争性のない随意契約となった理由及び改善策(支出額10億円以上)']): big[m]['target_reason'] += 1

top_nc.sort(key=lambda x: -x['amt']); one_bid_top.sort(key=lambda x: -x['amt'])
eq = sum(1 for k in con_sum if sup_tot.get(k) == con_sum[k])
res = {
    'check': {'suppliers_with_contracts': len(con_sum), 'exact': eq, 'contract_total': sum(con_sum.values()), 'supplier_total': sum(v for v in sup_tot.values() if v),
              'mismatch': [{'id': k[0], 'diff': con_sum[k] - (sup_tot.get(k) or 0)} for k in con_sum if sup_tot.get(k) != con_sum[k]]},
    'by_m_d': {k: dict(v) for k, v in by_m_d.items()}, 'by_m_d_n': {k: dict(v) for k, v in by_m_d_n.items()},
    'by_m_kind1': {k: dict(v) for k, v in by_m_kind1.items()}, 'by_m_kind1_n': {k: dict(v) for k, v in by_m_kind1_n.items()},
    'bids': {k: dict(v) for k, v in bids.items()}, 'bids_amt': {k: dict(v) for k, v in bids_amt.items()},
    'rates': {k: dict(v) for k, v in rates.items()}, 'rates_amt': {k: dict(v) for k, v in rates_amt.items()},
    'by_min': {k: dict(v) for k, v in by_min.items()}, 'other_contract': dict(other_contract),
    'big': {k: dict(v) for k, v in big.items()},
    'top_nc': top_nc[:15], 'one_bid_top': one_bid_top[:12], 'PROC': PROC, 'NONPROC': NONPROC,
}
json.dump(res, open(f'{out}/c1.json', 'w'), ensure_ascii=False)
T = lambda x: round(x / 1e12, 3)
print('check', {k: (v if k != 'mismatch' else v) for k, v in res['check'].items()})
for m in PROC + NONPROC:
    print(f'{m or "(空)":16s}', {k: T(v) for k, v in by_m_d[m].items()}, dict(by_m_d_n[m]))
print('company s1 by method', {m: T(by_m_kind1[m].get('会社', 0)) for m in PROC + NONPROC}, 'total', T(sum(by_m_kind1[m].get('会社', 0) for m in by_m_kind1)))
print('other_contract', other_contract)
print('big', {k: dict(v) for k, v in big.items()})
