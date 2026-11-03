// DOM の代用でスクリプトを走らせ、NaN・undefined と、SVG の要素が viewBox の外に出ないかを調べる（文字幅は 1 文字 11px の概算）
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
class N { constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this._t = ''; this.innerHTML = ''; this.hidden = false; }
  setAttribute(k, v) { this.attrs[k] = String(v); } appendChild(c) { this.children.push(c); return c; } addEventListener() {}
  set textContent(v) { this._t = String(v); } get textContent() { return this._t; } }
const byId = Object.fromEntries(ids.map(i => [i, new N(i)]));
globalThis.document = { getElementById: i => byId[i], createElementNS: (_, t) => new N(t) };
globalThis.innerWidth = 1200;
new Function(js)();
let bad = [];
for (const [id, n] of Object.entries(byId)) {
  const txt = n._t + n.innerHTML; if (/NaN|undefined|null/.test(txt)) bad.push(`${id}: text ${txt.match(/.{0,30}(NaN|undefined|null).{0,10}/)[0]}`);
  const vb = n.attrs.viewBox?.split(' ').map(Number); if (!vb) continue;
  const walk = e => { for (const c of e.children) { walk(c);
    const a = Object.fromEntries(Object.entries(c.attrs).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
    if (Object.values(c.attrs).some(v => /NaN|undefined/.test(v))) bad.push(`${id}: ${c.tag} attr NaN`);
    let box = null;
    if (c.tag === 'rect') box = [a.x, a.y, a.width, a.height];
    if (c.tag === 'text') { const w = [...c._t].reduce((s, ch) => s + (ch.charCodeAt(0) > 255 ? 11 : 6.5), 0); const x0 = a['text-anchor'] === 'end' ? a.x - w : a['text-anchor'] === 'middle' ? a.x - w / 2 : a.x; box = [x0, a.y - 10, w, 12]; }
    if (c.tag === 'circle') box = [a.cx - a.r, a.cy - a.r, 2 * a.r, 2 * a.r];
    if (box && (box[0] < -1 || box[1] < -1 || box[0] + box[2] > vb[2] + 1 || box[1] + box[3] > vb[3] + 1)) bad.push(`${id}: ${c.tag} 「${c._t}」 外 [${box.map(v => Math.round(v))}] vb ${vb}`);
    if (c.tag === 'rect' && a.height < 0) bad.push(`${id}: rect 負の高さ`);
  } };
  walk(n);
}
console.log(bad.length ? bad.join('\n') : 'OK: NaN・はみ出し なし');
for (const id of ['heroFlow', 'split', 'c21', 'c21t', 'coutText', 'pairText', 'defText', 'invText', 'toFilpText']) console.log(id, '|', (byId[id]._t || byId[id].innerHTML).replace(/<[^>]+>/g, ' '));
