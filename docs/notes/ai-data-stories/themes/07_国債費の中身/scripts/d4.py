# 一般会計の国債費を、事項名で「償還」「利払い」などに分ける（当初予算、予算書の事項の表）
import csv, glob, json
base = '/Users/igomuni/orca/nihon-no-yosan/data/dataset'
SRC = {y: str(y) for y in range(2017, 2027)}; SRC[2025] = '2025_teishutsu'  # 予算の一生と同じ版
def path(v, f):
    for d in (f'{base}/mof-history-v0/mof-archive/{v}', f'{base}/reference-v0/mof-archive/{v}'):
        if glob.glob(f'{d}/{f}'): return f'{d}/{f}'
def cat(n):
    if '利子' in n: return '利払い'
    if '決算上の剰余金' in n: return '剰余金の繰入'
    if '償還及び発行に関する諸費' in n or '事務取扱い' in n: return '諸費・事務'
    if '定率による' in n: return '償還（定率繰入）'
    if '償還財源' in n or '整理収入' in n: return '償還（その他）'
    return 'その他'
if __name__ == "__main__":
    out = {}; names = {}
    for y, v in SRC.items():
        p = path(v, 'jikou-general.csv'); rows = [r for r in csv.DictReader(open(p, encoding='utf-8')) if r['項名'] == '国債費']
        amt = [c for c in rows[0] if ('要求額' in c or '予定額' in c) and '前年度' not in c][0]
        o = out.setdefault(y, {})
        for r in rows:
            c = cat(r['事項名']); o[c] = o.get(c, 0) + int(r[amt] or 0)
            names.setdefault(c, set()).add(r['事項名'])
        o['_total'] = sum(int(r[amt] or 0) for r in rows); o['_n'] = len(rows)
    for y, o in out.items(): print(y, {k: round(v / 1e9, 2) if not k.startswith('_n') else v for k, v in o.items()})
    for c, s in names.items(): print('\n', c, '\n  ' + '\n  '.join(sorted(s)))
    json.dump({'out': out, 'names': {k: sorted(v) for k, v in names.items()}}, open('d4.json', 'w'), ensure_ascii=False)
