// DOM の代用でスクリプトを最後まで動かし、属性に NaN・undefined が無いか、SVG の座標が viewBox に収まるかを見る
import fs from 'node:fs';
const h = fs.readFileSync('index.html', 'utf8');
const js = h.slice(h.indexOf('<script>') + 8, h.lastIndexOf('</script>'));
const nodes = []; const mk = tag => { const n = { tag, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); c.parent = this; }, addEventListener() {} }; nodes.push(n); return n; };
const byId = {}; const document = { getElementById: id => (byId[id] ??= mk('svg#' + id)), createElementNS: (_, t) => mk(t) };
globalThis.document = document; globalThis.innerWidth = 1200;
new Function('document', js)(document);
let bad = 0;
for (const n of nodes) for (const [k, v] of Object.entries(n.attrs)) if (/NaN|undefined/.test(v)) { bad++; console.log('bad', n.tag, k, v); }
for (const [id, s] of Object.entries(byId)) {
  if (!s.attrs.viewBox) { if (/NaN|undefined/.test(s.innerHTML)) { bad++; console.log('bad html', id); } continue; }
  const [, , W, H] = s.attrs.viewBox.split(' ').map(Number);
  const walk = n => { for (const c of n.children) { const a = c.attrs; const xs = [a.x, a.x1, a.x2].filter(v => v !== undefined).map(Number), ys = [a.y, a.y1, a.y2].filter(v => v !== undefined).map(Number);
    if (a.width) xs.push(Number(a.x) + Number(a.width)); if (a.height) ys.push(Number(a.y) + Number(a.height));
    if (xs.some(v => v < -1 || v > W + 1) || ys.some(v => v < -1 || v > H + 1)) { bad++; console.log('outside', id, c.tag, JSON.stringify(a), c.textContent); } walk(c); } };
  walk(s); console.log(id, 'viewBox', W, H, 'elements', nodes.filter(n => n.parent === s).length);
}
console.log('problems', bad);
