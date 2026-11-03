import json
o = json.load(open('s1.json'))
Y = [str(y) for y in range(2017, 2025)]
tot = lambda e, k: sum(e['y'].get(y, {}).get(k, 0) for y in Y)
es = sorted(o.values(), key=lambda e: -tot(e, 'unused'))
allun = sum(tot(e, 'unused') for e in o.values())
print('8年 不用計', round(allun/1e12, 2), '現額計', round(sum(tot(e,'cur') for e in o.values())/1e12,2), '支出計', round(sum(tot(e,'spent') for e in o.values())/1e12,2))
for e in es[:14]:
    print(f"{e['acct']}|{e['kou']}|{e['moku']} 不用8年 {tot(e,'unused')/1e12:.2f}  ", ' '.join(f"{y[2:]}:{e['y'].get(y,{}).get('budget',0)/1e12:.2f}/{e['y'].get(y,{}).get('spent',0)/1e12:.2f}" for y in Y))
