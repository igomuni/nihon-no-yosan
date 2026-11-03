// DOM の代用で LP のスクリプトを最後まで動かし、SVG の要素が viewBox の内側にあるか、NaN・undefined が無いかを見る（文字の幅は 1 文字 = 11px の近似。全角は 12px）
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const els = new Map(); const svgs = [];
function mk(tag) {
  const e = { tagName: tag, attrs: {}, children: [], style: {}, textContent: '', innerHTML: '', hidden: false,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { c.parent = this; this.children.push(c); return c; }, addEventListener() {} };
  return e;
}
globalThis.document = { getElementById(id) { if (!els.has(id)) { const e = mk(/Chart$/.test(id) ? 'svg' : 'div'); e.id = id; els.set(id, e); if (e.tagName === 'svg') svgs.push(e); } return els.get(id); }, createElementNS(ns, tag) { return mk(tag); } };
globalThis.innerWidth = 1200;
new Function(js)();
let bad = 0;
const all = e => [e, ...e.children.flatMap(all)];
for (const s of svgs) {
  const vb = (s.attrs.viewBox || '').split(' ').map(Number); if (vb.length < 4) { console.log('viewBox なし', s.id); bad++; continue; }
  const [, , W, H] = vb;
  for (const e of all(s).slice(1)) {
    const a = e.attrs; const vals = Object.values(a).join(' ') + ' ' + e.textContent;
    if (/NaN|undefined/.test(vals)) { console.log('NaN/undefined', s.id, e.tagName, a, e.textContent); bad++; }
    const n = k => Number(a[k] ?? 0);
    let box = null;
    if (e.tagName === 'rect') box = [n('x'), n('y'), n('width'), n('height')];
    if (e.tagName === 'line') box = [Math.min(n('x1'), n('x2')), Math.min(n('y1'), n('y2')), Math.abs(n('x2') - n('x1')), Math.abs(n('y2') - n('y1'))];
    if (e.tagName === 'text') { const w = [...String(e.textContent)].reduce((s, c) => s + (c.charCodeAt(0) > 255 ? 12 : 6.5), 0); const anc = a['text-anchor']; const x0 = anc === 'middle' ? n('x') - w / 2 : anc === 'end' ? n('x') - w : n('x'); box = [x0, n('y') - 11, w, 13]; }
    if (box && (box[0] < -1 || box[1] < -1 || box[0] + box[2] > W + 1 || box[1] + box[3] > H + 1)) { console.log('はみ出し', s.id, e.tagName, box.map(v => Math.round(v)), e.textContent); bad++; }
  }
  console.log(s.id, 'viewBox', W, H, '要素', all(s).length - 1);
}
const text = [...els.values()].map(e => e.innerHTML + e.textContent).join(' ');
if (/NaN|undefined/.test(text)) { console.log('本文に NaN/undefined'); bad++; }
console.log(bad ? `問題 ${bad}` : '問題なし');
