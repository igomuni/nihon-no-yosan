// 描画の検査: DOM の代用でスクリプトを動かし、NaN・undefined と、SVG の rect/text/line が viewBox の外に出ないかを見る（文字幅は 1 文字 11px の概算）
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const els = {}; const created = [];
const mk = (tag, id) => { const e = { tag, id, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', hidden: true,
  setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); c.parent = this; return c; }, addEventListener() {} }; created.push(e); return e; };
for (const m of html.matchAll(/id="([^"]+)"/g)) els[m[1]] = mk(m[1].includes('svg') ? 'svg' : 'div', m[1]);
for (const m of html.matchAll(/<svg[^>]*id="([^"]+)"/g)) els[m[1]].tag = 'svg';
globalThis.document = { getElementById: id => els[id], createElementNS: (ns, t) => mk(t) };
globalThis.innerWidth = 1200;
new Function(script)();
let bad = 0;
for (const [id, e] of Object.entries(els)) {
  const txt = (e.innerHTML || '') + (e.textContent || '');
  if (/NaN|undefined/.test(txt)) { console.log('NaN/undefined in', id); bad++; }
  if (e.tag !== 'svg' || !e.attrs.viewBox) continue;
  const [, , W, H] = e.attrs.viewBox.split(' ').map(Number);
  const walk = n => { for (const c of n.children) { const a = c.attrs; const num = k => Number(a[k] ?? 0);
    if (Object.values(a).some(v => /NaN|undefined/.test(v)) || /NaN|undefined/.test(c.textContent)) { console.log('NaN attr', id, c.tag); bad++; }
    if (c.tag === 'rect' && (num('x') < -1 || num('y') < -1 || num('x') + num('width') > W + 1 || num('y') + num('height') > H + 1)) { console.log('rect out', id, a); bad++; }
    if (c.tag === 'text') { const w = [...c.textContent].length * 11, x = num('x'), anc = a['text-anchor']; const x0 = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x;
      if (x0 < -2 || x0 + w > W + 2 || num('y') > H + 1 || num('y') < 8) { console.log('text out', id, c.textContent, x0, x0 + w, W); bad++; } }
    walk(c); } };
  walk(e);
}
console.log(bad ? `problems: ${bad}` : 'ok');
