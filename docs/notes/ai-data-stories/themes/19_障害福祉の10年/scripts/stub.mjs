// ブラウザを使わずに、LP のスクリプトを DOM の代用で走らせ、NaN と viewBox の外への はみ出しを調べる
import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const els = {};
const mk = (tag) => ({ tag, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', hidden: true,
  setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; }, addEventListener() {} });
globalThis.document = { getElementById: id => (els[id] ??= mk('svg')), createElementNS: (_, t) => mk(t) };
globalThis.innerWidth = 1200;
new Function(js)();
const probs = [];
const charW = (s, size) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? size : size * 0.6), 0);
for (const [id, e] of Object.entries(els)) {
  const all = []; (function walk(n) { for (const c of n.children) { all.push(c); walk(c); } })(e);
  for (const c of all) for (const [k, v] of Object.entries(c.attrs)) if (/NaN|undefined|Infinity/.test(v)) probs.push(`${id} ${c.tag}.${k}=${v}`);
  const vb = (e.attrs.viewBox ?? '').split(' ').map(Number); if (vb.length !== 4) continue;
  const [, , W, H] = vb;
  for (const c of all) {
    const a = c.attrs; let x0, x1, y0, y1;
    if (c.tag === 'rect') { x0 = +a.x; x1 = +a.x + +a.width; y0 = +a.y; y1 = +a.y + +a.height; }
    else if (c.tag === 'text') { const w = charW(c.textContent, /lbl/.test(a.class ?? '') ? 12 : 11); const x = +a.x; x0 = a['text-anchor'] === 'end' ? x - w : a['text-anchor'] === 'middle' ? x - w / 2 : x; x1 = x0 + w; y0 = +a.y - 11; y1 = +a.y + 2; }
    else if (c.tag === 'circle') { x0 = +a.cx - +a.r; x1 = +a.cx + +a.r; y0 = +a.cy - +a.r; y1 = +a.cy + +a.r; }
    else if (c.tag === 'line') { x0 = Math.min(+a.x1, +a.x2); x1 = Math.max(+a.x1, +a.x2); y0 = Math.min(+a.y1, +a.y2); y1 = Math.max(+a.y1, +a.y2); }
    else continue;
    if (c.tag === 'circle' && a.fill === 'transparent') continue;
    if (x0 < -1 || y0 < -1 || x1 > W + 1 || y1 > H + 1) probs.push(`${id} ${c.tag} 「${c.textContent}」 [${x0.toFixed(0)},${y0.toFixed(0)},${x1.toFixed(0)},${y1.toFixed(0)}] viewBox ${W}x${H}`);
  }
}
for (const [id, e] of Object.entries(els)) if (/NaN|undefined/.test(e.textContent + e.innerHTML)) probs.push(`${id} の文に NaN/undefined`);
console.log(probs.length ? probs.join('\n') : 'OK: NaN なし、はみ出しなし');
for (const k of ['kGrowth','kGen','kShare','leadStack','cJiritsu','cJidou','cOther','cReq','cReqText','cSupp','cSuppText','cUnused','cUnusedText']) console.log(k, els[k]?.textContent);
