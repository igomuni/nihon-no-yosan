"""d1.json から LP（index.html と preview.html）を作る。使い方: python3 -I build.py"""
import json
d = json.load(open('d1.json'))
PROC = d['PROC']
GROUPS = [  # 方式のまとめ（LP の積み上げ棒の色の区分）
    ('一般競争', ['一般競争契約(最低価格)', '一般競争契約(総合評価)']),
    ('指名競争', ['指名競争契約(最低価格)', '指名競争契約(総合評価)']),
    ('随意契約（公募・企画競争）', ['随意契約(公募)', '随意契約(企画競争)']),
    ('随意契約（その他）', ['随意契約(その他)']),
    ('随意契約（少額・不落）', ['随意契約(少額)', '随意契約(不落・不調)']),
    ('国庫債務負担行為等', ['国庫債務負担行為等']),
    ('その他・交付', ['その他', '補助金等交付', '交付', '']),
]
ORDER = ['航空機', '艦船', '誘導弾・弾薬', '通信・電子・システム', '車両・火器', '燃料', '役務（輸送・警備・清掃など）', '調査・研究', '施設・工事', '糧食・被服・日用品', 'その他']
oku = lambda v: round(v / 1e8)  # 円 → 億円
rows = []
for k in ORDER:
    m = d['by_k_m'].get(k, {}); n = d['by_k_m_n'].get(k, {}); c = d['by_k_comp'].get(k, {}); rt = d['by_k_rate'].get(k, {})
    proc = sum(m.get(x, 0) for x in PROC)
    filled = sum(v for b, v in rt.items() if b != '未記入'); hi = sum(rt.get(b, 0) for b in ('95〜', '99〜', '100'))
    rows.append({'k': k, 'g': [oku(sum(m.get(x, 0) for x in xs)) for _, xs in GROUPS], 'proc': oku(proc), 'procN': sum(n.get(x, 0) for x in PROC),
                 'nc': oku(m.get('随意契約(その他)', 0)), 'svc': oku(d['by_k_svc'].get(k, {}).get('svc', 0)),
                 'compN': c.get('n', 0), 'oneN': c.get('one_n', 0), 'unkN': c.get('unk_n', 0), 'rateFilled': filled, 'rateHi': hi,
                 'top': [{'name': t['name'], 'gaiyo': t['gaiyo'], 'amt': oku(t['amt']), 'm': t['m'], 'bid': t['bid'] or '—'} for t in d['top'].get(k, [])[:3]]})
pairs = [{'kou': p['kou'], 'moku': p['moku'], 'rs': oku(p['rs']), 'book': None if p['book'] is None else oku(p['book'])} for p in d['pairs'][:14]]
data = {'groups': [g for g, _ in GROUPS], 'rows': rows, 'tot': {'all': oku(d['tot']['all']), 'proc': oku(d['tot']['proc']), 'procN': d['tot']['proc_n']},
        'fallback': {'n': d['fallback']['n'], 'amt': oku(d['fallback']['amt'])},
        'rs22': {'amt': oku(d['rs22']['amt']), 'noMoku': oku(d['rs22']['no_moku']), 'n': d['rs22']['n']}, 'book': oku(d['book_total']), 'pairs': pairs,
        'rules': d['rules'], 'service': d['service']}
html = open('page.tpl.html', encoding='utf-8').read().replace('__DATA__', json.dumps(data, ensure_ascii=False))
open('index.html', 'w', encoding='utf-8').write(html)
open('preview.html', 'w', encoding='utf-8').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>')
json.dump(data, open('page-data.json', 'w'), ensure_ascii=False)
print('ok', len(html))
