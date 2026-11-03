// index.html のスクリプトを、最小の DOM の代用で最後まで走らせ、エラー・NaN・undefined が出ないか見る
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const texts = [];
function node(tag) {
  const n = { tag, attrs: {}, children: [], style: {}, hidden: false, _t: '', _h: '',
    setAttribute(k, v) { this.attrs[k] = String(v); texts.push(String(v)); }, appendChild(c) { this.children.push(c); return c; }, addEventListener() {},
    set textContent(v) { this._t = v; texts.push(String(v)); }, get textContent() { return this._t; },
    set innerHTML(v) { this._h = v; texts.push(String(v)); }, get innerHTML() { return this._h; } };
  return n;
}
const byId = Object.fromEntries(ids.map(i => [i, node('x')]));
globalThis.document = { getElementById: i => byId[i] ?? (() => { throw new Error('no id ' + i); })(), createElementNS: (_, t) => node(t), createElement: t => node(t) };
globalThis.innerWidth = 1200;
new Function(script)();
const bad = texts.filter(s => /NaN|undefined|Infinity/.test(s));
console.log('ok, texts', texts.length, 'bad', bad.length, bad.slice(0, 5));
for (const id of ['heroDelta', 'heroSub', 'shareText', 'minText', 'defText', 'y26Text', 'speText', 'settleText', 'carText', 'supText']) console.log(id, '|', byId[id].textContent);
