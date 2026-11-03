// DOM の代用で、描画スクリプトが最後まで動くか（NaN が出ないか）を確かめる
import { readFileSync } from 'node:fs';
const els = {}; const made = [];
const mk = (tag) => { const e = { tag, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', set className(v) { this.attrs.class = v; }, setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; }, addEventListener() {} }; made.push(e); return e; };
globalThis.document = { getElementById: id => (els[id] ??= mk('#' + id)), createElementNS: (_, t) => mk(t), createElement: t => mk(t) };
globalThis.innerWidth = 1200;
new Function(readFileSync('page.js', 'utf8'))();
const bad = made.filter(e => Object.values(e.attrs).some(v => /NaN|undefined|Infinity/.test(v)) || /NaN|undefined/.test(e.textContent));
const htmlBad = Object.entries(els).filter(([, e]) => /NaN|undefined/.test(e.innerHTML) || /NaN|undefined/.test(e.textContent));
console.log('要素', made.length, 'NaN などのある要素', bad.length, 'innerHTML/文の NaN', htmlBad.map(([k]) => k));
console.log(els.perLead.textContent); console.log(els.topLead.textContent); console.log(els.handLead.textContent); console.log(els.nkHead.textContent, els.nkBody.textContent);
