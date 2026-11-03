import csv,glob,json
D='/Users/igomuni/orca/nihon-no-yosan/data/dataset'
rows=[]
for y in range(2017,2025):
    f=sorted(glob.glob(f'{D}/*/mof-archive/{y}/moku-general-kessan.csv'))[0]
    m=list(csv.DictReader(open(f,encoding='utf-8')))
    c=[x for x in m[0] if '移替' in x][0]
    for r in m:
        v=int(r[c] or 0)
        if v: rows.append(dict(y=y,min=r['所管'],org=r['組織'],code=r['項コード'],kou=r['項名'],moku=r['目名'],v=v,
          base=int(r['歳出予算額(円)'] or 0),carry=int(r['前年度繰越額(円)'] or 0),res=int(r['予備費使用額(円)'] or 0),flow=int(r['流用等増△減額(円)'] or 0),
          cur=int(r['歳出予算現額(円)'] or 0),spent=int(r['支出済歳出額(円)'] or 0),out=int(r['翌年度繰越額(円)'] or 0),unused=int(r['不用額(円)'] or 0),src=f.split('dataset/')[1],row=r['source_row']))
json.dump(rows,open('s1.json','w'),ensure_ascii=False)
for r in rows: print(r['y'],r['min'],r['org'],r['kou'][:24],'/',r['moku'][:26],round(r['v']/1e8,1),'億')
