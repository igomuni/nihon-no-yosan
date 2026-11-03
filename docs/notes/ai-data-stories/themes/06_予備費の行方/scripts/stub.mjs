// DOM の代用で、スクリプトを最後まで動かし、NaN・undefined が出ないか見る
import { readFileSync } from 'node:fs';
const src = readFileSync('chk.js', 'utf8');
const texts = [];
const mk = (tag) => { const e = { tag, attrs: {}, children: [], style: {}, _t: '', hidden: true,
  setAttribute(k, v) { this.attrs[k] = String(v); if (/NaN|undefined/.test(String(v))) texts.push(`ATTR ${tag}.${k}=${v}`); },
  appendChild(c) { this.children.push(c); return c; }, addEventListener() {},
  set textContent(v) { this._t = v; texts.push(v); }, get textContent() { return this._t; },
  set innerHTML(v) { this._h = v; texts.push(v); }, get innerHTML() { return this._h; } }; return e; };
const els = new Map();
globalThis.document = { getElementById: id => els.get(id) ?? els.set(id, mk(id)).get(id), createElementNS: (_, t) => mk(t), createElement: t => mk(t), querySelector: () => mk('q') };
globalThis.innerWidth = 1000;
new Function(src)();
const bad = texts.filter(t => /NaN|undefined|Infinity/.test(t));
console.log('texts', texts.length, 'bad', bad.length, bad.slice(0, 3));
console.log(texts.filter(t => typeof t === 'string' && t.length < 300).slice(0, 8).join('\n'));
