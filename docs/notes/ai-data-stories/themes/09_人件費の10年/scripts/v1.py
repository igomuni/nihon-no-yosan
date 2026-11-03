# 検算: 予算書・決算書の目の CSV を直接読み、使途別分類コード 1 の行を足す（moku.json.gz を通さない）
import csv, re, os, json
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
src = {y: f'{base}/mof-history-v0/mof-archive/{y}' for y in range(2017, 2023)}
src.update({2023: f'{base}/reference-v0/mof-archive/2023', 2024: f'{base}/reference-v0/mof-archive/2024', 2025: f'{base}/reference-v0/mof-archive/2025_teishutsu', 2026: f'{base}/reference-v0/mof-archive/2026'})
settle_src = {y: src[y] for y in range(2017, 2023)}
settle_src.update({2023: f'{base}/reference-v0/mof-archive/2023', 2024: f'{base}/reference-v0/mof-archive/2024'})
out = {}
for y, d in src.items():
    for acc in ['general', 'special']:
        p = f'{d}/moku-{acc}.csv'
        if not os.path.exists(p): out[f'{y}-{acc}'] = None; continue
        rows = list(csv.DictReader(open(p, encoding='utf-8')))
        col = [c for c in rows[0] if re.match(r'^(令和|平成)(元|\d+)年度(要求|予定)額', c)][0]
        s = sum(int(r[col] or 0) for r in rows if r['使途別分類コード'] == '1')
        out[f'{y}-{acc}'] = s
kes = {}
for y, d in settle_src.items():
    p = f'{d}/moku-general-kessan.csv'
    if not os.path.exists(p): continue
    rows = list(csv.DictReader(open(p, encoding='utf-8')))
    def col(k): return [c for c in rows[0] if c.startswith(k)][0]
    kes[y] = {k: sum(int(r[col(k)] or 0) for r in rows if r['使途別分類コード'] == '1') for k in ['歳出予算現額', '支出済歳出額', '翌年度繰越額', '不用額']}
print(json.dumps(out)); print(json.dumps(kes, ensure_ascii=False))
