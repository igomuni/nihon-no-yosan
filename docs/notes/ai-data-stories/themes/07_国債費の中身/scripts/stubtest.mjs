// DOM の代用で、ページのスクリプトを最後まで動かし、NaN・undefined が出ないか確かめる
import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const texts = [];
class N { constructor(t) { this.t = t; this.attrs = {}; this.children = []; this.style = {}; this._text = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (/NaN|undefined/.test(String(v))) throw new Error(`bad attr ${k}=${v} on ${this.t}`); }
  appendChild(c) { this.children.push(c); return c; } addEventListener() {}
  set textContent(v) { this._text = v; texts.push(v); if (/NaN|undefined/.test(v)) throw new Error('bad text ' + v); } get textContent() { return this._text; }
  set innerHTML(v) { if (/NaN|undefined/.test(v)) throw new Error('bad html ' + v.slice(0, 200)); this._h = v; } }
const nodes = {};
globalThis.document = { createElementNS: (_, t) => new N(t), createElement: t => new N(t), getElementById: id => (nodes[id] ??= new N('div')) };
globalThis.innerWidth = 1200;
new Function(js)();
console.log('ok, texts:', texts.length, texts.slice(0, 8).join(' | '));
