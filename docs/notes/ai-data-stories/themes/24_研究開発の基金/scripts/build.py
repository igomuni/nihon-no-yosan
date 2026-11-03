import json
t = open('page.tpl.html').read()
open('index.html', 'w').write(t.replace('__DATA__', json.dumps(json.load(open('page-data.json')), ensure_ascii=False)))
open('preview.html', 'w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + open('index.html').read() + '</body></html>')
print('ok')
