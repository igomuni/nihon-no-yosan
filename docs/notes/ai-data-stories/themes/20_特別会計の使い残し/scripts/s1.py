# 特別会計の決算（FY2017〜FY2024）を、会計・勘定・項ごとに集める。当初（予算書）・補正後（補正予算書の最後の回）も付ける。
import csv, glob, json, os, re, sys
DS = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
def path(y, name):
    for d in ('reference-v0', 'mof-history-v0'):
        p = f'{DS}/{d}/mof-archive/{y}/{name}'
        if os.path.exists(p): return p
    return None
def rows(p): return list(csv.DictReader(open(p, encoding='utf-8')))
def col(r0, pat): return [k for k in r0 if re.search(pat, k)][0]
def n(v): return int(v) if v not in ('', None) else 0
YEARS = range(2017, 2025)
KCOLS = ['歳出予算額', '前年度繰越額', '予備費使用額', '予算総則の規定による経費増額', '流用等増△減額', '予算決定後移替増△減額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']
out = {'items': [], 'files': {}}
for y in YEARS:
    pk, pb = path(y, 'kou-special-kessan.csv'), path(y, 'kou-special.csv')
    out['files'][y] = {'kessan': pk.replace(DS + '/', ''), 'budget': pb.replace(DS + '/', '')}
    # 当初（千円）
    B = rows(pb); bc = col(B[0], r'(予定|要求)額')
    bud = {}
    for r in B:
        k = (r['特別会計'], r['勘定'], r['項コード'], r['項名'])
        bud[k] = bud.get(k, 0) + n(r[bc]) * 1000
    # 補正（回ごと。最後の回の改予定額）
    rev = {}; rounds = []
    for nm in ['kou-special-hosei.csv'] + [f'kou-special-hosei-{i}.csv' for i in range(2, 6)]:
        p = path(y, nm)
        if not p: break
        rounds.append(p.replace(DS + '/', ''))
        H = rows(p); hc = col(H[0], r'^改')
        for r in H:
            if not r['項名']: continue  # 項名の無い行（集計の行）は除く
            rev[(r['特別会計'], r['勘定'], r['項コード'], r['項名'])] = n(r[hc]) * 1000
    out['files'][y]['supp'] = rounds
    # 当初の項と補正の項の対応: 名前（会計・勘定・項コード・項名）で合わせ、合わない項どうしは、同じ会計・勘定・項コードなら合わせる（年度の途中の改称。例: FY2022 の機構名の変更）
    hn = set(rev); bn = set(bud)
    un_b = {k[:3]: k for k in bn - hn}; un_h = {k[:3]: k for k in hn - bn}
    alias = {un_b[c]: un_h[c] for c in un_b if c in un_h}
    out.setdefault('alias', {})[y] = [[list(a), list(b)] for a, b in alias.items()]
    # 決算（円）。共管別の行は、同じ項に足す
    K = rows(pk); cmap = {c: col(K[0], '^' + re.escape(c)) for c in KCOLS}
    kes = {}
    for r in K:
        k = (r['特別会計'], r['勘定'], r['項コード'], r['項名'])
        a = kes.setdefault(k, {c: 0 for c in KCOLS} | {'所管': r['所管']})
        for c in KCOLS: a[c] += n(r[cmap[c]])
    hosei_only = (hn - bn) - set(alias.values())  # 補正で新しくできた項（当初に無い）
    keys = set(kes) | set(bud) | hosei_only
    for k in keys:
        a = kes.get(k)
        out['items'].append({'y': y, 'acct': k[0], 'sub': k[1], 'code': k[2], 'name': k[3],
            'minis': (a or {}).get('所管', ''),
            'init': bud.get(k), 'revised': (rev.get(alias.get(k, k), bud[k]) if k in bud else (rev[k] if k in hosei_only else None)),
            **({c: a[c] for c in KCOLS} if a else {c: None for c in KCOLS})})
json.dump(out, open('s1.json', 'w'), ensure_ascii=False)
# 概要
it = out['items']
print('items', len(it), 'kessan なし', sum(1 for x in it if x['歳出予算現額'] is None), '当初なし', sum(1 for x in it if x['init'] is None and x['歳出予算現額'] is not None))
for y in YEARS:
    xs = [x for x in it if x['y'] == y and x['歳出予算現額'] is not None]
    s = lambda c: sum(x[c] or 0 for x in xs) / 1e12
    i0 = sum(x['init'] or 0 for x in it if x['y'] == y) / 1e12
    print(y, f"当初 {i0:.2f} 歳出予算額 {s('歳出予算額'):.2f} 現額 {s('歳出予算現額'):.2f} 支出 {s('支出済歳出額'):.2f} 繰越 {s('翌年度繰越額'):.2f} 不用 {s('不用額'):.2f}")
