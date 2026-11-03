# 決算書の目（一般会計、使途別 1）の、歳出予算現額の内訳（円 → 兆円）
import csv, json
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
src = {y: f'{base}/mof-history-v0/mof-archive/{y}' for y in range(2017, 2023)}
src.update({2023: f'{base}/reference-v0/mof-archive/2023', 2024: f'{base}/reference-v0/mof-archive/2024'})
K = ['歳出予算額', '前年度繰越額', '予備費使用額', '流用等増△減額', '予算決定後移替増△減額', '歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']
res = {}
for y, d in src.items():
    rows = list(csv.DictReader(open(f'{d}/moku-general-kessan.csv', encoding='utf-8')))
    col = {k: [c for c in rows[0] if c.startswith(k)][0] for k in K}
    s = {k: sum(int(r[col[k]] or 0) for r in rows if r['使途別分類コード'] == '1') for k in K}
    s['恒等式1の差'] = s['歳出予算現額'] - (s['歳出予算額'] + s['前年度繰越額'] + s['予備費使用額'] + s['流用等増△減額'] + s['予算決定後移替増△減額'])
    s['恒等式2の差'] = s['歳出予算現額'] - (s['支出済歳出額'] + s['翌年度繰越額'] + s['不用額'])
    res[y] = s
    print(y, ' '.join(f"{k[:4]}:{s[k]/1e12:.3f}" for k in K[:5]), '差1', s['恒等式1の差'], '差2', s['恒等式2の差'])
json.dump(res, open(f'{"/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2d-personnel"}/v2.json', 'w'), ensure_ascii=False)
