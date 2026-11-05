"""テーマ 5-B「防衛の契約」: RS 2025 年度版（FY2024 の執行）の防衛省の 5-1 の契約の行を、契約概要（無ければ事業名）の語で装備・役務の種類に分け、方式・入札者数・落札率を集計する。
2-2 の FY2024 当初予算の目と、予算書の FY2024 の目（防衛省の所管）の対応も見る。出力: d1.json
使い方: python3 -I d1.py <RS の CSV のディレクトリ> <予算書の mof-archive/2024 のディレクトリ> <出力ディレクトリ>
"""
import csv, json, re, sys, collections, unicodedata
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
src, mof, out = sys.argv[1], sys.argv[2], sys.argv[3]
rd = lambda p: read_rs_dict(p)
num = lambda s: int(s) if re.fullmatch(r'-?\d+', s or '') else None
N = lambda s: unicodedata.normalize('NFKC', s or '')

# 段の深さ（4 回目 c1.py と同じ）
org_to = collections.defaultdict(set); edges = collections.defaultdict(set)
for r in rd(f'{src}/5-2_RS_2025_支出先_支出ブロックのつながり.csv'):
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

PROC = ['一般競争契約(最低価格)', '一般競争契約(総合評価)', '指名競争契約(最低価格)', '指名競争契約(総合評価)',
        '随意契約(企画競争)', '随意契約(公募)', '随意契約(不落・不調)', '随意契約(少額)', '随意契約(その他)']
# 種類の語の規則（NFKC で正規化した契約概要に、上から順に当て、最初に当たったもの。契約概要に当たらなければ事業名で同じ順に当てる）
RULES = [
    ('誘導弾・弾薬', r'誘導弾|ミサイル|弾薬|砲弾|弾丸|銃弾|魚雷|機雷|火薬|爆弾|ロケット弾|迫撃砲弾|SM-|PAC'),
    ('航空機', r'航空機|戦闘機|哨戒機|輸送機|救難機|練習機|ヘリコプ|回転翼|固定翼|F-35|F-15|F-2|P-1|P-3|C-2|C-130|KC-|E-2|E-767|UH-|AH-|SH-|CH-|MCH|US-2|オスプレイ|V-22|無人機|航空用|機体'),
    ('艦船', r'護衛艦|潜水艦|掃海|補給艦|輸送艦|艦艇|艦船|艦の|艦用|ふね|船舶|船体|艦'),
    ('車両・火器', r'車両|戦車|装甲|装輪|装軌|火砲|榴弾砲|小銃|機関銃|機関砲|拳銃|自動車|トラック|けん引'),
    ('通信・電子・システム', r'通信|レーダ|レーダー|ソフトウェア|システム|ネットワーク|電子|情報処理|サイバー|衛星|電算|端末|データ|プログラム|ICT|IT'),
    ('燃料', r'燃料|軽油|ガソリン|重油|灯油|航空タービン|JP-|油購入|潤滑油'),
    ('施設・工事', r'工事|建設|建築|土木|改修|新設|設計|施設整備|庁舎|隊舎|宿舎|格納庫|滑走路|岸壁|解体|測量|地質'),
    ('糧食・被服・日用品', r'糧食|食料|給食|被服|制服|作業服|寝具|事務用品|消耗品|日用品|医薬品|衛生材料'),
    ('調査・研究', r'調査|研究|試作|技術資料|研究開発|試験'),
    ('役務（輸送・警備・清掃など）', r'輸送|運搬|警備|清掃|役務|派遣|借上|賃貸借|リース|保険|管理業務|運営|委託'),
]
SERVICE = r'修理|整備|定期修理|オーバーホール|保守|維持|改修|補修|点検'
def kind(gaiyo, jigyo):
    for text in (N(gaiyo), N(jigyo)):
        for lab, pat in RULES:
            if re.search(pat, text): return lab, text is N(jigyo)
    return 'その他', False
def rate_bin(x):
    try: v = float(x)
    except ValueError: return '未記入'
    if v == 0: return '未記入'
    if v > 100: return '100超'
    if v == 100: return '100'
    for lo in (99, 95, 90, 80):
        if v >= lo: return f'{lo}〜'
    return '80未満'

C = lambda: collections.Counter()
by_k_m = collections.defaultdict(C); by_k_m_n = collections.defaultdict(C)
by_k_svc = collections.defaultdict(C)       # 種類 → 修理・整備か（調達のみ）
by_k_comp = collections.defaultdict(C)      # 種類 → 競争の件数・一者・入札者未記入
by_k_rate = collections.defaultdict(C)      # 種類 → 落札率の区分（一般・指名競争の件数）
fallback = C()                              # 事業名で当てた件数・額
top = collections.defaultdict(list)
tot = C(); meta = {}
for r in rd(f'{src}/5-1_RS_2025_支出先_支出情報.csv'):
    if r['府省庁'] != '防衛省': continue
    i, b = r['予算事業ID'], r['支出先ブロック番号']
    meta.setdefault(i, r['事業名'])
    if r['支出先名'] and r['支出先の合計支出額']: continue
    if not (r['支出先名'] and (r['契約概要'] or r['金額'] or r['契約方式等'])): continue
    v = num(r['金額'])
    if v is None or depth.get((i, b)) != 1: continue
    m = r['契約方式等']; k, fb = kind(r['契約概要'], r['事業名'])
    by_k_m[k][m] += v; by_k_m_n[k][m] += 1; tot['all'] += v
    if m in PROC:
        tot['proc'] += v; tot['proc_n'] += 1
        if fb: fallback['n'] += 1; fallback['amt'] += v
        by_k_svc[k]['svc' if re.search(SERVICE, N(r['契約概要'])) else 'other'] += v
        if m.startswith('一般競争') or m.startswith('指名競争'):
            c = by_k_comp[k]; c['n'] += 1; c['amt'] += v
            nb = num(r['入札者数'])
            if nb == 1: c['one_n'] += 1; c['one'] += v
            if not nb: c['unk_n'] += 1
            by_k_rate[k][rate_bin(r['落札率'])] += 1
        hno = r['法人番号'] or ''
        named = re.fullmatch(r'\d{13}', hno) and hno != '9999999999999' and r['その他支出先'] != 'TRUE' and r['その他の契約'] != 'TRUE'
        if named: top[k].append({'name': r['支出先名'], 'gaiyo': N(r['契約概要'])[:50], 'jigyo': r['事業名'][:40], 'amt': v, 'm': m, 'bid': r['入札者数'], 'rate': r['落札率']})

# 2-2: FY2024 の当初予算、防衛省の目ごとの合計（円）と、予算書の FY2024 の目（千円、防衛省の所管）
rs_moku = C(); rs_rows = C()
for r in rd(f'{src}/2-2_RS_2025_予算・執行_予算種別・歳出予算項目.csv'):
    if r['府省庁'] != '防衛省' or r['予算年度'] != '2024' or r['予算種別'] != '当初予算': continue
    v = num(r['予算額(歳出予算項目ごと)'])
    if v is None: continue
    rs_moku[(N(r['項']), N(r['目']))] += v; rs_rows['n'] += 1; rs_rows['amt'] += v
    if not r['目']: rs_rows['no_moku'] += v
bk = C()
base = list(rd(f'{mof}/moku-general.csv'))
amt = [c for c in base[0] if re.match(r'^(令和|平成)(元|\d+)年度(要求|予定)額', c)][0]
for r in base:
    if r['所管'] != '防衛省': continue
    bk[(N(r['項名']), N(r['目名']))] += int(r[amt] or 0) * 1000
pairs = [{'kou': k[0], 'moku': k[1], 'rs': v, 'book': bk.get(k)} for k, v in rs_moku.items()]
for k in ('航空機修理費', '艦船修理費', '航空機購入費', '誘導弾購入費', '通信維持費', '試作品費', '武器購入費', '弾薬購入費', '油購入費', '施設整備費'):
    pass
res = {'tot': dict(tot), 'fallback': dict(fallback),
       'by_k_m': {k: dict(v) for k, v in by_k_m.items()}, 'by_k_m_n': {k: dict(v) for k, v in by_k_m_n.items()},
       'by_k_svc': {k: dict(v) for k, v in by_k_svc.items()}, 'by_k_comp': {k: dict(v) for k, v in by_k_comp.items()},
       'by_k_rate': {k: dict(v) for k, v in by_k_rate.items()},
       'top': {k: sorted(v, key=lambda x: -x['amt'])[:5] for k, v in top.items()},
       'rs22': dict(rs_rows), 'pairs': sorted(pairs, key=lambda x: -x['rs']), 'book_total': sum(bk.values()), 'PROC': PROC,
       'rules': [[l, p] for l, p in RULES], 'service': SERVICE}
json.dump(res, open(f'{out}/d1.json', 'w'), ensure_ascii=False)
T = lambda x: round(x / 1e12, 4)
print('tot', {k: (T(v) if 'n' not in k else v) for k, v in tot.items()}, 'fallback', fallback)
for k in by_k_m:
    p = sum(by_k_m[k].get(m, 0) for m in PROC); c = by_k_comp[k]
    print(f'{k:16s} proc {T(p):8} nc {T(by_k_m[k].get("随意契約(その他)",0)):7} kokusai {T(by_k_m[k].get("国庫債務負担行為等",0)):7} comp_n {c["n"]:5} one {c["one_n"]:5} svc {T(by_k_svc[k].get("svc",0))}')
print('rs22', rs_rows, 'book', T(sum(bk.values())))
for p in res['pairs'][:15]: print(p['kou'][:14], p['moku'][:14], T(p['rs']), T(p['book']) if p['book'] is not None else None)
