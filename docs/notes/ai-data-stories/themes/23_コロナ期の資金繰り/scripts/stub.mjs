// DOM の代用で LP のスクリプトを最後まで動かし、NaN・undefined と、viewBox の外に出る座標（数値の属性）を調べる
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const els = new Map(); const created = [];
const mk = (tag) => { const e = { tag, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, appendChild(c) { this.children.push(c); c.parent = this; return c; }, addEventListener() {} }; created.push(e); return e; };
globalThis.document = { getElementById: id => { if (!els.has(id)) { const e = mk('svg'); e.id = id; els.set(id, e); } return els.get(id); }, createElementNS: (ns, t) => mk(t) };
globalThis.innerWidth = 1200;
new Function(js)();
let bad = 0;
for (const [id, e] of els) {
  const s = JSON.stringify([e.textContent, e.innerHTML]); if (/NaN|undefined/.test(s)) { console.log('NaN/undefined in', id); bad++; }
  const vb = e.attrs.viewBox?.split(' ').map(Number); if (!vb) continue;
  const walk = (n) => { for (const c of n.children) { const a = c.attrs; for (const k of ['x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height']) if (a[k] !== undefined && /NaN|undefined/.test(a[k])) { console.log('bad attr', id, c.tag, k, a[k]); bad++; }
    const x = +(a.x ?? a.x1 ?? 0), y = +(a.y ?? a.y1 ?? 0), w = +(a.width ?? 0), h = +(a.height ?? 0);
    if (c.tag !== 'pattern' && c.tag !== 'defs' && n.tag !== 'pattern' && (x < vb[0] - 1 || y < vb[1] - 1 || x + w > vb[2] + 1 || y + h > vb[3] + 1)) { console.log('out', id, c.tag, x, y, w, h, c.textContent.slice(0, 20)); bad++; }
    if (c.tag === 'text' && c.attrs['text-anchor'] !== 'end' && c.attrs['text-anchor'] !== 'middle' && x + c.textContent.length * 7 > vb[2] + 2) { console.log('text may overflow right', id, x, c.textContent); bad++; }
    walk(c); } };
  walk(e);
}
console.log('problems', bad);
