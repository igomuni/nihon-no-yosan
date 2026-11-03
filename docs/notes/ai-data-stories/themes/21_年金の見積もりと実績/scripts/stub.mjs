// DOM の代用でスクリプトを動かし、NaN・undefined と、SVG の座標が viewBox の外に出ないか（文字幅は概算）を確かめる
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const els = {}; const created = [];
class E { constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this.textContent = ''; this.innerHTML = ''; this.hidden = false; }
  setAttribute(k, v) { this.attrs[k] = String(v); } appendChild(c) { c.parent = this; this.children.push(c); return c; } addEventListener() {} }
const document = { getElementById: id => (els[id] ??= Object.assign(new E('svg'), { id })), createElementNS: (_, t) => { const e = new E(t); created.push(e); return e; } };
globalThis.document = document; globalThis.innerWidth = 1200;
new Function(js)();
let bad = 0;
for (const [id, e] of Object.entries(els)) {
  const txt = String(e.textContent ?? '') + String(e.innerHTML ?? '');
  if (/NaN|undefined/.test(txt)) { console.log('NaN in', id, txt.slice(0, 120)); bad++; }
  if (e.attrs.viewBox) {
    const [, , W, H] = e.attrs.viewBox.split(' ').map(Number);
    const walk = n => { for (const c of n.children) { walk(c);
      for (const [k, v] of Object.entries(c.attrs)) if (/NaN|undefined/.test(v)) { console.log('NaN attr', id, c.tag, k, v); bad++; }
      const a = c.attrs, num = k => a[k] !== undefined ? +a[k] : null;
      let x0, x1, y0, y1;
      if (c.tag === 'rect') { x0 = num('x'); y0 = num('y'); x1 = x0 + num('width'); y1 = y0 + num('height'); }
      else if (c.tag === 'circle') { x0 = num('cx') - num('r'); x1 = num('cx') + num('r'); y0 = num('cy') - num('r'); y1 = num('cy') + num('r'); }
      else if (c.tag === 'line') { x0 = Math.min(num('x1'), num('x2')); x1 = Math.max(num('x1'), num('x2')); y0 = Math.min(num('y1'), num('y2')); y1 = Math.max(num('y1'), num('y2')); }
      else if (c.tag === 'text') { const w = [...String(c.textContent ?? '')].reduce((s, ch) => s + (ch.charCodeAt(0) > 255 ? 12 : 6.5), 0); const anc = a['text-anchor']; const x = num('x'); x0 = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x; x1 = x0 + w; y0 = num('y') - 11; y1 = num('y') + 2; }
      else if (c.tag === 'polyline' || c.tag === 'polygon') { const p = a.points.split(' ').map(s => s.split(',').map(Number)); x0 = Math.min(...p.map(q => q[0])); x1 = Math.max(...p.map(q => q[0])); y0 = Math.min(...p.map(q => q[1])); y1 = Math.max(...p.map(q => q[1])); }
      else continue;
      if (x0 < -2 || y0 < -2 || x1 > W + 2 || y1 > H + 2) { console.log('outside', id, c.tag, String(c.textContent ?? '').slice(0, 20), [x0, y0, x1, y1].map(Math.round), W, H); bad++; }
    } };
    walk(e);
  }
}
console.log('問題', bad, 'SVG 要素', created.length);
