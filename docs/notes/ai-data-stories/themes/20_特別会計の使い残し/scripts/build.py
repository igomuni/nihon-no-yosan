import json
data = open('page-data.json').read()
html = r'''<title>特別会計の使い残し</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。決算の 3 つの行き先: 支出 = 墨、繰越 = 藍、不用 = 朱 */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --ink: #18202b; --muted: #5b6573; --line: #d9dee5;
  --spent: #3b4656; --carry: #2a6fc9; --unused: #d2542a; --soft: #c9d0d9; --tag: #eef1f5;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --spent: #8e9bb0; --carry: #5b9cf0; --unused: #f07a50; --soft: #3a4452; --tag: #232b36; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --spent: #8e9bb0; --carry: #5b9cf0; --unused: #f07a50; --soft: #3a4452; --tag: #232b36; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.8;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }
h1, h2 { font-family: var(--display); text-wrap: balance; line-height: 1.35; margin: 0; }
h1 { font-size: clamp(28px, 6vw, 40px); font-weight: 900; }
h2 { font-size: 22px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.num { font-variant-numeric: tabular-nums; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.kpi b { font-family: var(--display); font-size: 26px; font-variant-numeric: tabular-nums; }
.kpi span { font-size: 12px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.chart .val { font-variant-numeric: tabular-nums; }
.grid line { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.claims { display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; list-style: none; }
.claims li { display: grid; gap: 4px; }
.multiples { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
@media (max-width: 420px) { .multiples { grid-template-columns: 1fr; } }
.mini { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mini .name { font-size: 13px; font-weight: 700; }
.mini .note { font-size: 12px; color: var(--muted); }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th.l, td.l { text-align: left; white-space: normal; min-width: 9em; }
thead th { color: var(--muted); font-weight: 400; }
td.u { color: var(--unused); } td.c { color: var(--carry); }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--carry); outline-offset: 2px; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 280px; z-index: 5; }
</style>

<main>
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="eyebrow">特別会計・決算 FY2017〜FY2024（8 年度）</span>
    <h1>特別会計は、使えるお金のどれだけを使い残したか</h1>
    <p>決算では、その年度に使えるお金（歳出予算現額）が、支出・翌年度への繰越・不用の 3 つに分かれます。特別会計 13 会計の 8 年分を、一般会計と並べました。</p>
    <div class="kpis" id="kpis"></div>
  </header>

  <section>
    <h2>不用は一般会計の 4 倍、繰越は 3 分の 1</h2>
    <p id="leadCompare"></p>
    <div class="panel scroll"><svg class="chart" id="shareChart" role="img" aria-label="会計ごとの、使えるお金の行き先の割合（8 年計）"></svg></div>
    <div class="legend"><span><i style="background:var(--spent)"></i>支出</span><span><i style="background:var(--carry)"></i>翌年度へ繰越</span><span><i style="background:var(--unused)"></i>不用</span></div>
    <p style="font-size:13px;color:var(--muted)">棒は 8 年の合計の割合。右の数字は、不用額（兆円）と、当初予算に対する支出の割合。不用率の高い順。</p>
  </section>

  <section>
    <h2>不用の 9 割は、5 つの会計</h2>
    <p id="leadUnused"></p>
    <div class="panel scroll"><svg class="chart" id="unChart" role="img" aria-label="会計ごとの不用額（8 年計）"></svg></div>
    <ul class="claims">
      <li><strong>繰り越さずに、不用にする</strong><span>年金・財政投融資・外国為替資金・地震再保険は、8 年の翌年度繰越がほぼ 0 です（年金は 0.32兆円、うち子ども・子育て支援勘定 0.32兆円）。使わなかった分は、翌年度に回さず不用になっています。3 回目の「財政投融資の山」と同じ形です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>繰り越して使う会計もある</strong><span>東日本大震災復興は繰越率 19.0%、自動車安全は 14.8% です。どちらも公共事業（復旧・空港整備）の項が繰越の中心で、一般会計の公共事業と同じ形です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>大きな不用の 4 つの目</h2>
    <p>どの会計も、特定の目に不用が集まっています。線は使えるお金（歳出予算現額）、棒は支出。棒と線の間が、繰越と不用です。</p>
    <div class="multiples" id="multiples"></div>
    <ul class="claims">
      <li><strong>原子力損害賠償支援勘定の「国債整理基金特別会計へ繰入」</strong><span>8 年で使えるお金 94.9兆円のうち、支出 65.1兆円、不用 29.9兆円（31.5%）。使えるお金は 12.6兆円（FY2017）から 10.9兆円（FY2023）に毎年減り、支出は 7.2兆円から 8.6兆円に毎年増えています。この繰入の中身（何の国債の償還か）は、目の名前からは分かりません。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>基礎年金給付費の不用が、毎年増えている</strong><span>不用は 0.87兆円（FY2017）から 4.56兆円（FY2024）に増え、FY2024 は使えるお金 30.0兆円の 15.2% です。使えるお金は 23.3兆円 → 30.0兆円、支出は 22.4兆円 → 25.5兆円です。見積もりと実績の差が広がっている理由は、このデータにありません。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>国債の償還は、毎年 3.07兆円ずつ繰り越す</strong><span>国債整理基金の債務償還費の翌年度繰越は、8 年とも 3.05〜3.09兆円です（2 回目の「国債費の中身」と同じ値）。不用は年 3.7〜6.8兆円で、使えるお金の 1.6〜3.7% です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>地震再保険と外国為替資金は、使わないことが多い</strong><span>地震再保険の再保険金は、8 年で使えるお金 1.20兆円のうち支出 0.25兆円です。FY2021（0.13兆円）と FY2022（0.07兆円）以外は、年 0.01兆円以下でした。外国為替資金は、国債整理基金への繰入（毎年 0.43〜0.51兆円）の支出が FY2023 まで 0 円、予備費（毎年 0.30兆円）は全額が不用です。支払いが起きたときに備えて置いておく予算だと推測しますが、データでは確かめられません。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>不用・繰越が大きい項</h2>
    <details open>
      <summary>不用額の上位 15 項（8 年計、兆円）</summary>
      <div class="scroll" style="margin-top:12px"><table id="unTbl"></table></div>
    </details>
    <details>
      <summary>翌年度繰越の上位 10 項（年度ごと、兆円）</summary>
      <div class="scroll" style="margin-top:12px"><table id="caTbl"></table></div>
    </details>
  </section>

  <section>
    <h2>会計ごとの全数値（兆円）</h2>
    <details>
      <summary>13 会計と一般会計の 8 年計、年度ごとの不用</summary>
      <div class="scroll" style="margin-top:12px"><table id="accTbl"></table></div>
    </details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の決算書（特別会計の項・目の表、FY2017〜FY2024）と、予算書（当初予算・補正予算）。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が表を抽出・構造化したもの（data/dataset の kou-special-kessan.csv・moku-special-kessan.csv など）。決算の共管別の行は、同じ項に足しました。</li>
      <li><span class="tag ai"></span>会計・勘定・項ごとの合計、割合、上位の並べ替え、文章の解釈は、この探索で計算したものです。政府の公表値とは照合していません。</li>
      <li>検算: 全 2,249 項・年度で、決算の 2 つの恒等式（現額 = 歳出予算額 + 前年度繰越 + 予備費 + 予算総則の増額 + 流用 + 移替、現額 = 支出 + 翌年度繰越 + 不用）が円まで成り立ちました。会計ごとの補正後（予算書）と決算の歳出予算額は、8 年・全会計で一致しました（FY2022 の機構名の変更は、同じ項コードで合わせました）。翌年度繰越と次の年度の前年度繰越は、91 組すべて一致しました。年度ごとの合計は、画面用の目のデータから足した値とも一致しました。</li>
      <li>特別会計の間・一般会計との繰入（二重に数えるお金）を含んだままの合計です。割合（不用率・繰越率）は会計ごとに見てください。会計を足した額は、国の支出の規模ではありません。</li>
      <li>不用や繰越の理由、不用になったお金の行き先（積立金・剰余金など）は、このデータにありません。良し悪しの評価はしていません。</li>
      <li>FY2025 以降の決算と、FY2025 にできた子ども・子育て支援特別会計は、まだ決算がありません。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>基礎年金給付費の不用（FY2024 は 4.56兆円）は、予算の見積もりの何が実績とずれているのか。当初予算と補正、受給者に払う目の内訳まで降りますか。</li>
      <li>原子力損害賠償支援勘定の繰入（毎年 7〜9兆円の支出）は、一般会計・国債整理基金の側でどう見えるか、追いますか。</li>
      <li>不用になったお金は、翌年度の特別会計の歳入（剰余金）に戻るはずですが、歳入のデータはまだありません。どのデータがあれば確かめられると思いますか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（ループ 4 回目）。金額の単位は兆円（円の値から計算し、表示で丸め）。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y;
const tri = v => v / 10000; // 億円 → 兆円
const f = (v, d = 2) => (v === null || v === undefined) ? '—' : tri(v).toFixed(d);
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 290) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const sum = (k) => D.acc.reduce((s, a) => s + (a[k] ?? 0), 0);
const S = { cur: sum('cur'), sp: sum('sp'), ca: sum('ca'), un: sum('un'), init: sum('init') };
const G = D.gen;

// KPI
document.getElementById('kpis').innerHTML = [
  [f(S.cur, 1) + '兆円', '特別会計の使えるお金（8 年計）'],
  [f(S.un, 1) + '兆円', `不用（${pct(S.un, S.cur)}）。一般会計は ${f(G.un, 1)}兆円（${pct(G.un, G.cur)}）`],
  [f(S.ca, 1) + '兆円', `翌年度繰越（${pct(S.ca, S.cur)}）。一般会計は ${f(G.ca, 1)}兆円（${pct(G.ca, G.cur)}）`],
].map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join('');
document.getElementById('leadCompare').textContent = `8 年で、特別会計の不用は ${f(S.un, 1)}兆円で、一般会計（${f(G.un, 1)}兆円）の ${(S.un / G.un).toFixed(1)} 倍です。翌年度繰越は ${f(S.ca, 1)}兆円で、一般会計（${f(G.ca, 1)}兆円）の ${(S.ca / G.ca * 100).toFixed(0)}% です。不用の割合は会計で大きく違い、地震再保険・外国為替資金では使えるお金の 7〜8 割が不用でした。`;

// 割合の帯（不用率の高い順）+ 一般会計
(() => {
  const rows = [...D.acc].sort((a, b) => b.un / b.cur - a.un / a.cur);
  rows.push({ n: '（参考）一般会計', cur: G.cur, sp: G.sp, ca: G.ca, un: G.un, init: null, gen: true });
  const s = document.getElementById('shareChart'), W = 680, rowH = 26, T = 22, L = 160, R = 150, H = T + rows.length * rowH + 6;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '560px';
  const bw = W - L - R, x = p => L + bw * p;
  el('text', { x: W - R + 10, y: 14 }, s).textContent = '不用額';
  el('text', { x: W - 8, y: 14, 'text-anchor': 'end' }, s).textContent = '支出/当初';
  rows.forEach((r, i) => {
    const y = T + i * rowH; let p = 0;
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n.length > 11 ? r.n.slice(0, 11) + '…' : r.n;
    for (const [k, c] of [['sp', 'var(--spent)'], ['ca', 'var(--carry)'], ['un', 'var(--unused)']]) {
      const w = r[k] / r.cur; if (w <= 0) continue;
      el('rect', { x: x(p) + (p ? 1 : 0), y: y + 6, width: Math.max(0.5, bw * w - (p ? 1 : 0)), height: rowH - 10, fill: c, rx: 2 }, s); p += w;
    }
    const ur = r.un / r.cur;
    el('text', { x: W - R + 10, y: y + 17, class: 'val lbl' }, s).textContent = `${f(r.un)}（${(ur * 100).toFixed(1)}%）`;
    el('text', { x: W - 8, y: y + 17, 'text-anchor': 'end', class: 'val' }, s).textContent = r.init ? pct(r.sp, r.init) : '—';
    const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s);
    hover(hit, `<b>${r.n}</b>（8 年計）<br>使えるお金 ${f(r.cur)}兆円${r.init ? `<br>当初 ${f(r.init)}兆円` : ''}<br>支出 ${f(r.sp)}兆円（${pct(r.sp, r.cur)}）<br>翌年度繰越 ${f(r.ca)}兆円（${pct(r.ca, r.cur)}）<br>不用 ${f(r.un)}兆円（${pct(r.un, r.cur)}）`);
  });
})();

// 不用額の棒
(() => {
  const rows = [...D.acc].sort((a, b) => b.un - a.un).filter(r => r.un >= 500);
  const top5 = rows.slice(0, 5).reduce((s, r) => s + r.un, 0);
  document.getElementById('leadUnused').textContent = `不用 ${f(S.un, 1)}兆円のうち ${f(top5, 1)}兆円（${pct(top5, S.un)}）が、${rows.slice(0, 5).map(r => r.n).join('・')}の 5 会計です。規模の大きい国債整理基金・年金は、不用の割合は小さくても額が大きくなります。`;
  const s = document.getElementById('unChart'), W = 680, rowH = 26, T = 6, L = 160, R = 110, H = T + rows.length * rowH + 22;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const max = Math.max(...rows.map(r => r.un)), x = v => L + (W - L - R) * v / max;
  const g = el('g', { class: 'grid' }, s), step = max > 300000 ? 100000 : 50000;
  for (let v = 0; v <= max; v += step) { el('line', { x1: x(v), x2: x(v), y1: T, y2: H - 18 }, g); el('text', { x: x(v), y: H - 4, 'text-anchor': 'middle' }, s).textContent = `${tri(v)}兆`; }
  rows.forEach((r, i) => {
    const y = T + i * rowH;
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n.length > 11 ? r.n.slice(0, 11) + '…' : r.n;
    el('rect', { x: L, y: y + 6, width: Math.max(2, x(r.un) - L), height: rowH - 10, rx: 3, fill: 'var(--unused)' }, s);
    el('text', { x: x(r.un) + 6, y: y + 17, class: 'val' }, s).textContent = `${f(r.un)}兆円`;
    hover(el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s), `<b>${r.n}</b><br>` + Y.map(yy => `FY${yy}: 不用 ${f(r.y[yy][4])}兆円`).join('<br>'));
  });
})();

// 4 つの目の小さなグラフ（現額 = 線、支出 = 棒）
(() => {
  const host = document.getElementById('multiples');
  for (const r of D.series) {
    const box = document.createElement('div'); box.className = 'mini';
    const tu = r.un.reduce((a, b) => a + b, 0), tc = r.cur.reduce((a, b) => a + b, 0);
    box.innerHTML = `<span class="name">${r.n}</span><span class="note num">8 年: 使えるお金 ${f(tc)}兆円、不用 ${f(tu)}兆円（${pct(tu, tc)}）</span>`;
    const W = 320, H = 140, L = 34, R = 8, T = 16, B = 18;
    const max = Math.max(...r.cur, ...r.sp) * 1.05, x = i => L + (W - L - R) * (i + 0.5) / Y.length, y = v => T + (H - T - B) * (1 - v / max), bw = (W - L - R) / Y.length * 0.55;
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': r.n });
    const g = el('g', { class: 'grid' }, s);
    const nice = [0.5, 1, 2, 5, 10, 20, 50, 100].map(v => v * 10000).find(v => max / v <= 4) || 1e6;
    for (let v = 0; v <= max; v += nice) { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); el('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end' }, s).textContent = tri(v); }
    r.sp.forEach((v, i) => el('rect', { x: x(i) - bw / 2, y: y(v), width: bw, height: Math.max(0, y(0) - y(v)), fill: 'var(--spent)', rx: 2 }, s));
    el('polyline', { points: r.cur.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: 'var(--unused)', 'stroke-width': 2 }, s);
    r.cur.forEach((v, i) => el('circle', { cx: x(i), cy: y(v), r: 3, fill: 'var(--unused)' }, s));
    [0, 7].forEach(i => el('text', { x: x(i), y: H - 4, 'text-anchor': 'middle' }, s).textContent = Y[i]);
    el('text', { x: L, y: 10 }, s).textContent = '兆円';
    box.appendChild(s);
    hover(box, `<b>${r.n}</b><br>` + Y.map((yy, i) => `FY${yy}: 現額 ${f(r.cur[i])} / 支出 ${f(r.sp[i])} / 繰越 ${f(r.ca[i])} / 不用 ${f(r.un[i])}`).join('<br>'));
    host.appendChild(box);
  }
})();

// 表
document.getElementById('unTbl').innerHTML = '<thead><tr><th class="l">会計・勘定</th><th class="l">項</th><th>使えるお金</th><th>不用</th><th>不用率</th></tr></thead><tbody>' +
  D.topUn.map(r => `<tr><td class="l">${r.a}${r.s ? '・' + r.s : ''}</td><td class="l">${r.n}</td><td>${f(r.cur)}</td><td class="u">${f(r.un)}</td><td>${pct(r.un, r.cur)}</td></tr>`).join('') + '</tbody>';
document.getElementById('caTbl').innerHTML = '<thead><tr><th class="l">会計・勘定</th><th class="l">項</th>' + Y.map(y => `<th>FY${y}</th>`).join('') + '<th>8 年計</th></tr></thead><tbody>' +
  D.topCa.map(r => `<tr><td class="l">${r.a}${r.s ? '・' + r.s : ''}</td><td class="l">${r.n}</td>${r.by.map(v => `<td>${f(v)}</td>`).join('')}<td class="c">${f(r.ca)}</td></tr>`).join('') + '</tbody>';
document.getElementById('accTbl').innerHTML = '<thead><tr><th class="l">会計</th><th>当初</th><th>使えるお金</th><th>支出</th><th>繰越</th><th>不用</th>' + Y.map(y => `<th>不用 FY${y}</th>`).join('') + '</tr></thead><tbody>' +
  [...D.acc].sort((a, b) => b.cur - a.cur).map(r => `<tr><td class="l">${r.n}</td><td>${f(r.init)}</td><td>${f(r.cur)}</td><td>${f(r.sp)}</td><td class="c">${f(r.ca)}</td><td class="u">${f(r.un)}</td>${Y.map(y => `<td>${f(r.y[y][4])}</td>`).join('')}</tr>`).join('') +
  `<tr><td class="l"><b>特別会計の計</b></td><td>${f(S.init)}</td><td>${f(S.cur)}</td><td>${f(S.sp)}</td><td class="c">${f(S.ca)}</td><td class="u">${f(S.un)}</td>${Y.map(() => '<td></td>').join('')}</tr>` +
  `<tr><td class="l">（参考）一般会計</td><td>—</td><td>${f(G.cur)}</td><td>${f(G.sp)}</td><td class="c">${f(G.ca)}</td><td class="u">${f(G.un)}</td>${Y.map(() => '<td></td>').join('')}</tr></tbody>`;
</script>
'''
open('index.html', 'w').write(html.replace('__DATA__', data))
open('preview.html', 'w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html.replace('__DATA__', data) + '</body></html>')
print('ok', len(html))
