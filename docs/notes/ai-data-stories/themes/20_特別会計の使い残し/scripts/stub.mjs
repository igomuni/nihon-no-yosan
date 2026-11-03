// DOM の代用でスクリプトを最後まで動かし、NaN・undefined と、SVG の要素が viewBox の外に出ていないかを調べる（文字幅は ASCII 7px・全角 12px の概算）
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const mk = (tag) => ({ tag, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', hidden: false, className: '',
  setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); c.parent = this; return c; }, addEventListener() {} });
const els = Object.fromEntries(ids.map(i => [i, mk('div')]));
for (const i of ids) if (/Chart$/.test(i)) els[i].tag = 'svg';
globalThis.document = { getElementById: i => els[i], createElementNS: (_, t) => mk(t), createElement: t => mk(t) };
globalThis.innerWidth = 1200;
new Function(js)();
const probs = [];
const walk = (e, vb) => {
  if (e.tag === 'svg' && e.attrs.viewBox) vb = e.attrs.viewBox.split(' ').map(Number);
  for (const [k, v] of Object.entries(e.attrs)) if (/NaN|undefined|Infinity/.test(v)) probs.push(`${e.tag}.${k}=${v}`);
  if (/NaN|undefined/.test(String(e.textContent))) probs.push(`${e.tag} text ${e.textContent}`);
  if (vb) {
    const a = e.attrs, n = k => +a[k];
    if (e.tag === 'rect' && (n('x') < -1 || n('y') < -1 || n('x') + n('width') > vb[2] + 1 || n('y') + n('height') > vb[3] + 1)) probs.push(`rect out ${JSON.stringify(a)}`);
    if (e.tag === 'text') { const w = [...String(e.textContent)].reduce((s, ch) => s + (ch.charCodeAt(0) > 255 ? 12 : 7), 0); const x0 = a['text-anchor'] === 'end' ? n('x') - w : a['text-anchor'] === 'middle' ? n('x') - w / 2 : n('x');
      if (x0 < -1 || x0 + w > vb[2] + 1 || n('y') < 8 || n('y') > vb[3] + 1) probs.push(`text out "${e.textContent}" x=${a.x} y=${a.y} vb=${vb}`); }
  }
  for (const c of e.children) walk(c, vb);
};
for (const e of Object.values(els)) { walk(e); if (/NaN|undefined/.test(e.innerHTML + e.textContent)) probs.push('html NaN in ' + e.tag); }
console.log(probs.length ? probs.join('\n') : 'OK: no NaN, no out-of-viewBox');
