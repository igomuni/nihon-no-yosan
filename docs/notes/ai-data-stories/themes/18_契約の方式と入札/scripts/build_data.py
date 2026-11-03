"""c1.json から LP に埋め込む値を作る。出力: page-data.json（金額は億円、小数 1 桁）"""
import json, collections
r = json.load(open('c1.json'))
oku = lambda v: round(v / 1e8, 1)
PROC, NON = r['PROC'], r['NONPROC']
ALL = PROC + NON
def tot(m, d=None): return sum(r['by_m_d'].get(m, {}).values()) if d is None else r['by_m_d'].get(m, {}).get(d, 0)
def cnt(m, d=None): return sum(r['by_m_d_n'].get(m, {}).values()) if d is None else r['by_m_d_n'].get(m, {}).get(d, 0)
grand = sum(tot(m) for m in ALL)
methods = [{'m': m or '（空欄）', 'proc': m in PROC, 's1': oku(tot(m, '1')), 's2': oku(tot(m, '2以上')), 'su': oku(tot(m, 'たどれない')), 'n': cnt(m), 'n1': cnt(m, '1')} for m in ALL]
proc_all = sum(tot(m) for m in PROC); proc_s1 = sum(tot(m, '1') for m in PROC)
comp1 = {m: r['by_m_kind1'].get(m, {}).get('会社', 0) for m in ALL}
comp1_total = sum(comp1.values()); comp1_proc = sum(comp1[m] for m in PROC)
company = [{'m': m or '（空欄）', 'proc': m in PROC, 'v': oku(comp1[m]), 'n': r['by_m_kind1_n'].get(m, {}).get('会社', 0)} for m in ALL if comp1[m] > 0]
BINS = ['1', '2', '3', '4', '5', '6〜10', '11以上', '未記入・0']
BID_M = ['一般競争契約(最低価格)', '一般競争契約(総合評価)', '指名競争契約(最低価格)', '指名競争契約(総合評価)', '随意契約(企画競争)', '随意契約(公募)', '随意契約(不落・不調)', '随意契約(その他)']
bids = [{'m': m, 'n': [r['bids'][m].get(b, 0) for b in BINS], 'a': [oku(r['bids_amt'][m].get(b, 0)) for b in BINS]} for m in BID_M]
RB = ['50未満', '50〜', '60〜', '70〜', '80〜', '90〜', '95〜', '99〜', '100', '100超']
rates = [{'m': m, 'n': [r['rates'][m].get(b, 0) for b in RB], 'blank': r['rates'][m].get('未記入', 0) + r['rates'][m].get('0（未記入とみなす）', 0), 'total': sum(r['rates'][m].values())} for m in ['一般競争契約(最低価格)', '一般競争契約(総合評価)', '随意契約(企画競争)', '随意契約(公募)', '随意契約(その他)']]
gen = ['一般競争契約(最低価格)', '一般競争契約(総合評価)']
one = {'n': sum(r['bids'][m].get('1', 0) for m in gen), 'N': sum(sum(r['bids'][m].values()) for m in gen),
       'a': sum(r['bids_amt'][m].get('1', 0) for m in gen), 'A': sum(sum(r['bids_amt'][m].values()) for m in gen),
       'unk_n': sum(r['bids'][m].get('未記入・0', 0) for m in gen)}
mins = []
for k, s in r['by_min'].items():
    if s.get('proc', 0) < 1e9: continue
    mins.append({'min': k, 'proc': oku(s['proc']), 'pn': s.get('proc_n', 0), 'nc': oku(s.get('nc', 0)), 'ncs': round(100 * s.get('nc', 0) / s['proc'], 1),
                 'cn': s.get('comp_n', 0), 'on': s.get('one_n', 0), 'ons': round(100 * s.get('one_n', 0) / s['comp_n'], 1) if s.get('comp_n') else None,
                 'oas': round(100 * s.get('one', 0) / s['comp'], 1) if s.get('comp') else None})
mins.sort(key=lambda x: -x['proc'])
big = [{'m': m, 'n': v['n'], 'a': oku(v['amt']), 't': v.get('target', 0), 'ta': oku(v.get('target_amt', 0)), 'tr': v.get('target_reason', 0)} for m, v in r['big'].items() if m in PROC]
big.sort(key=lambda x: -x['a'])
top = lambda xs: [{'min': x['min'], 'name': x['name'], 'gaiyo': x['gaiyo'], 'a': oku(x['amt']), 'bid': x['bid'], 'rate': x['rate'], 'm': x['m']} for xs_ in [xs] for x in xs_]
pd = {'grand': oku(grand), 'proc_all': oku(proc_all), 'proc_s1': oku(proc_s1), 'methods': methods, 'company': company,
      'comp1_total': oku(comp1_total), 'comp1_proc': oku(comp1_proc), 'bins': BINS, 'bids': bids, 'rbins': RB, 'rates': rates,
      'one': {k: (oku(v) if k in ('a', 'A') else v) for k, v in one.items()}, 'mins': mins, 'big': big,
      'top_nc': top(r['top_nc'][:10]), 'top_one': top(r['one_bid_top'][:8]),
      'nc_s1': oku(tot('随意契約(その他)', '1')), 'other_contract': {'n': r['other_contract']['n'], 'a': oku(r['other_contract']['amt']), 'pn': r['other_contract']['proc_n'], 'pa': oku(r['other_contract']['proc_amt'])},
      'check': {'sup': r['check']['suppliers_with_contracts'], 'exact': r['check']['exact'], 'mismatch': r['check']['mismatch']},
      'n_contracts': sum(cnt(m) for m in ALL), 'other_matome': oku(r['by_m_kind1']['その他'].get('まとめた支出先', 0))}
json.dump(pd, open('page-data.json', 'w'), ensure_ascii=False)
print(json.dumps({k: pd[k] for k in ['grand', 'proc_all', 'proc_s1', 'comp1_total', 'comp1_proc', 'one', 'nc_s1', 'other_contract', 'n_contracts']}, ensure_ascii=False))
print('防衛', [m for m in mins if m['min'] == '防衛省'])
print('big', big)
