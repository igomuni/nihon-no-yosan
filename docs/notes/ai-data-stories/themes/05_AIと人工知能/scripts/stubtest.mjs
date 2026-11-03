import { readFileSync } from 'node:fs';
const t = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const js = t.split('<script>')[1].split('</script>')[0];
let count = 0; const texts = [];
const mk = () => { const e = { attrs: {}, children: [], style: {}, hidden: false, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, setAttribute(k, v) { if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('NaN attr ' + k); if (/NaN|undefined/.test(String(v))) throw new Error('bad attr ' + k + '=' + v); this.attrs[k] = v; }, appendChild(c) { this.children.push(c); count++; }, addEventListener() {}, set textContent(v) { texts.push(v); }, }; return e; };
globalThis.document = { getElementById: () => mk(), createElementNS: () => mk() };
globalThis.innerWidth = 1000;
new Function(js)();
console.log('ok, svg nodes', count, 'texts sample', texts.slice(0, 12).join(' | '));
