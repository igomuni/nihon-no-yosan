import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const nodes = []; const byId = {};
class N { constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this._t = ''; this.innerHTML = ''; nodes.push(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); } appendChild(c) { this.children.push(c); c.parent = this; return c; }
  addEventListener() {} insertAdjacentHTML() {} set textContent(v) { this._t = String(v); } get textContent() { return this._t; } }
for (const m of html.matchAll(/id="([^"]+)"/g)) { const n = new N('svg-or-el'); byId[m[1]] = n; }
globalThis.document = { createElementNS: (_, t) => new N(t), getElementById: id => byId[id] };
globalThis.innerWidth = 1200;
new Function(js)();
let bad = 0;
for (const n of nodes) {
  const all = Object.values(n.attrs).join(' ') + ' ' + n._t + ' ' + n.innerHTML;
  if (/NaN|undefined|Infinity/.test(all)) { bad++; console.log('BAD', n.tag, n.attrs, n._t.slice(0, 40), n.innerHTML.slice(0, 80)); }
}
// viewBox check
for (const [id, s] of Object.entries(byId)) {
  const vb = s.attrs.viewBox; if (!vb) continue; const [, , W, H] = vb.split(' ').map(Number);
  const walk = n => { for (const c of n.children) { const a = c.attrs; let x0, x1, y0, y1;
    if (c.tag === 'rect') { x0 = +a.x; x1 = +a.x + +a.width; y0 = +a.y; y1 = +a.y + +a.height; }
    if (c.tag === 'text') { const w = [...c._t].reduce((s, ch) => s + (ch.charCodeAt(0) > 255 ? 12 : 6.6), 0); const anc = a['text-anchor']; x0 = anc === 'end' ? +a.x - w : anc === 'middle' ? +a.x - w / 2 : +a.x; x1 = x0 + w; y0 = +a.y - 11; y1 = +a.y + 2; }
    if (c.tag === 'line') { x0 = Math.min(+a.x1, +a.x2); x1 = Math.max(+a.x1, +a.x2); y0 = Math.min(+a.y1, +a.y2); y1 = Math.max(+a.y1, +a.y2); }
    if (x0 !== undefined && (x0 < -1 || y0 < -1 || x1 > W + 1 || y1 > H + 1)) { bad++; console.log('OUT', id, c.tag, c._t || '', [x0, y0, x1, y1].map(v => Math.round(v)), W, H); }
    walk(c); } };
  walk(s);
}
console.log('problems', bad);
