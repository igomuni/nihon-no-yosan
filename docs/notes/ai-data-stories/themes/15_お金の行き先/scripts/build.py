"""s1.json・s2.json から LP（index.html）と、そのまま開ける preview.html を作る。使い方: python3 -I build.py"""
import json, re
s1 = json.load(open('s1.json')); s2 = json.load(open('s2.json'))

SHORT = {
    'まとめた支出先: 給付の受給者': ('給付の受給者（まとめ）', 'まとめた支出先のうち、名前が「年金受給者」「児童手当の受給者」など'),
    'まとめた支出先: 「その他」': ('「その他」（まとめ）', 'まとめた支出先のうち、名前が「その他」で始まるもの'),
    'まとめた支出先: その他の集まり': ('ほかの集まり（まとめ）', 'まとめた支出先のうち、上の 2 つと借入金の返済など以外（例: 開発途上地域の政府等、各地の農政局）'),
    'まとめた支出先: 借入金の返済など': ('借入金の返済など（まとめ）', 'まとめた支出先のうち、名前が借入金・回収金'),
    'その他の法人': ('その他の法人', '法人種別がその他の設立登記法人などで、名前の語で分けられなかった法人（全国健康保険協会・日本年金機構など）'),
    '法人番号なし（個人を含む。名前を出さない）': ('法人番号なし・個人', '法人番号が 9999999999999 の支出先（個人・海外の団体など。名前は出さない）'),
    '法人番号なしの支出先（名前を出さない）': ('法人番号なし（その他）', '法人番号が空で、名前の語でも分けられなかった支出先（名前は出さない）'),
}
short = lambda c: SHORT.get(c, (c, ''))[0]
note = lambda c: SHORT.get(c, (c, ''))[1]

cats = []
for c, v in s1['by_cat'].items():
    cd = s1['cat_depth'].get(c, {})
    cats.append({'c': short(c), 'note': note(c), 's1': v.get('s1', 0), 'n1': v.get('n_s1', 0), 'all': v.get('all', 0), 'nall': v.get('n_all', 0),
                 'd2': sum(a for d, a in cd.items() if d not in ('1', 'None')), 'dn': cd.get('None', 0)})
cats.sort(key=lambda x: -x['s1'])

def label(t):
    names = t['names']
    if t['cat'] == '国の機関' and t['others'] > 0:
        base = next((n for n in names if re.search(r'(省|庁)$', n)), names[0])
        return f'{base}（同じ法人番号の地方支分部局などを含む）'
    if t['others'] > 0 and t['cat'] == '地方公共団体':
        return f'{names[0]}（警察・教育委員会など、同じ法人番号の機関を含む）'
    return re.sub(r'国立研空開発法人', '国立研究開発法人', names[0])
top = [{'name': label(t), 'cat': short(t['cat']), 'amt': t['amt'], 'n': t['n']} for t in s1['top'][:20]]

dm = s1['deep_by_min']
mins = sorted(({'m': k, 'n': v['n'], 'multi': v.get('multi', 0), 'd3': v.get('d3', 0)} for k, v in dm.items() if v['n'] >= 30), key=lambda x: -x['multi'] / x['n'])
stage = {k: v for k, v in s1['stage_block'].items()}
dist = s1['depth_dist']
top_down = [{'min': x['min'], 'name': x['name'], 'down': x['down'], 's1': x['s1'], 'maxd': x['maxd']} for x in s1['top_down'][:10]]
v24 = s2['2024']
D = {'cats': cats, 'top': top, 'mins': mins, 'stage': stage, 'dist': dist, 'topDown': top_down,
     'v24': v24, 'v23': s2['2023'], 'spent24': s2['spentTotal2024'], 'nSpent24': s2['nSpent2024'],
     'nBlocks': s1['n_blocks'], 'nJigyo': s1['n_jigyo_blocks'], 'nRec': s1['n_rows_rec'],
     'noDepth': s1['blocks_no_depth'], 'noDepthAmt': s1['blocks_no_depth_amt'], 'indirect': s1['indirect_total']}

tpl = open('page.tpl.html', encoding='utf-8').read()
html = tpl.replace('__DATA__', json.dumps(D, ensure_ascii=False))
open('index.html', 'w', encoding='utf-8').write(html)
open('preview.html', 'w', encoding='utf-8').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>')
print('ok', len(html))
