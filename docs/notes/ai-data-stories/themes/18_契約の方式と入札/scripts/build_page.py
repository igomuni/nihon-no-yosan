import json
d = open('page-data.json').read()
t = open('page.tpl.html').read().replace('__DATA__', d)
open('index.html', 'w').write(t)
open('preview.html', 'w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + t + '</body></html>')
print(len(t))
