"""検算: 支出先（5-1）の 1 段目の合計は、どの予算年度の執行額（2-1）と合うか。事業ごとに比べる。
使い方: python3 -I s2.py <RS の CSV のディレクトリ> <s1.json のあるディレクトリ>
"""
import csv, json, re, sys, collections
src, out = sys.argv[1], sys.argv[2]
s1 = json.load(open(f'{out}/s1.json'))
num = lambda s: int(s) if re.fullmatch(r'-?\d+', s or '') else None
spent = collections.defaultdict(dict)  # 年度 → 事業 ID → 執行額（合計の行）
for r in csv.DictReader(open(f'{src}/2-1_RS_2025_予算・執行_サマリ.csv', encoding='utf-8-sig')):
    if r['会計区分']: continue  # 合計の行だけ
    v = num(r['執行額(合計)'])
    if v is not None: spent[int(r['予算年度'])][r['予算事業ID']] = v
res = {}
for y in (2023, 2024, 2025):
    exact = near = far = miss = 0; tot_s1 = tot_sp = 0
    for i, a in s1['s1_by_id'].items():
        a2 = a + s1['indirect_by_id'].get(i, 0)
        sp = spent[y].get(i)
        if sp is None: miss += 1; continue
        tot_s1 += a2; tot_sp += sp
        if a2 == sp: exact += 1
        elif sp and abs(a2 - sp) / abs(sp) <= 0.01: near += 1
        else: far += 1
    res[y] = {'exact': exact, 'within1pct': near, 'other': far, 'noSpent': miss, 's1_plus_indirect': tot_s1, 'spent': tot_sp}
res['spentTotal2024'] = sum(spent[2024].values())
res['nSpent2024'] = len(spent[2024])
json.dump(res, open(f'{out}/s2.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
