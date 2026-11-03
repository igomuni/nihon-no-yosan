// index.html のスクリプトを、最小の DOM の代用で動かし、NaN・undefined と、SVG の要素が viewBox の外に出ていないか（文字幅は概算）を調べる
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const nodes = {};
class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this._text = ''; this.innerHTML = ''; this.hidden = true; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  addEventListener() {}
  insertAdjacentHTML(_, h) { this.innerHTML += h; }
  set textContent(t) { this._text = String(t); } get textContent() { return this._text; }
}
const document = { getElementById: id => (nodes[id] ??= new El('div#' + id)), createElementNS: (_, t) => new El(t) };
new Function('document', 'innerWidth', js)(document, 1200);
const problems = [];
const charW = s => [...s].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 12 : 6.6), 0);
for (const [id, n] of Object.entries(nodes)) {
  const all = JSON.stringify({ t: n._text, h: n.innerHTML });
  if (/NaN|undefined/.test(all)) problems.push(`${id}: NaN/undefined in text`);
  if (!n.attrs.viewBox) continue;
  const [, , W, H] = n.attrs.viewBox.split(' ').map(Number);
  const walk = e => { for (const c of e.children) { check(c); walk(c); } };
  const check = c => {
    const a = c.attrs;
    if (Object.values(a).some(v => /NaN|undefined/.test(v))) problems.push(`${id}: NaN attr ${c.tag}`);
    if (c.tag === 'rect') { const x = +a.x, y = +a.y, w = +a.width, h = +a.height; if (x < -1 || y < -1 || x + w > W + 1 || y + h > H + 1) problems.push(`${id}: rect out ${[x, y, w, h].map(Math.round)}`); }
    if (c.tag === 'text') { const w = charW(c._text), x = +a.x, y = +a.y; const anc = a['text-anchor'] || 'start'; const x0 = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x; if (x0 < -1 || x0 + w > W + 1 || y < 8 || y > H + 1) problems.push(`${id}: text out "${c._text}" x0=${Math.round(x0)} w=${Math.round(w)} y=${y} W=${W}`); }
  };
  walk(n);
}
console.log(problems.length ? problems.join('\n') : 'ok: no problems');
