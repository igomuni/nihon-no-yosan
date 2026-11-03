import json
D='/private/tmp/claude-501/-Users-igomuni-orca-nihon-no-yosan/bda0c6c0-76a7-4c25-b0a2-eb9a335e4e0e/scratchpad/poc/r2d-personnel/'
data=open(D+'data.json').read()
html=r'''<title>人件費の10年</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。給与明細のように、基本給・諸手当・退職手当を行で並べる。増 = 朱、減 = 藍 */
:root {
  --bg: #f6f7f8; --surface: #ffffff; --ink: #1a1f27; --muted: #5d6672; --line: #d9dde3;
  --up: #c9532c; --down: #2a6fc9; --zero: #9aa2ad; --bar: #3d4a5c; --soft: #b9c2cf; --tag: #eef0f4;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121519; --surface: #1a1f26; --ink: #e7eaee; --muted: #9aa3ae; --line: #2c333d;
  --up: #ef7a52; --down: #5b9cf0; --zero: #6b7480; --bar: #aab6c6; --soft: #4a5566; --tag: #232a33; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121519; --surface: #1a1f26; --ink: #e7eaee; --muted: #9aa3ae; --line: #2c333d;
  --up: #ef7a52; --down: #5b9cf0; --zero: #6b7480; --bar: #aab6c6; --soft: #4a5566; --tag: #232a33; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.8;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }
h1, h2 { font-family: var(--display); text-wrap: balance; line-height: 1.35; margin: 0; }
h1 { font-size: clamp(28px, 6vw, 42px); font-weight: 900; }
h2 { font-size: 22px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.num { font-variant-numeric: tabular-nums; }
.up { color: var(--up); } .down { color: var(--down); }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 24px; align-items: center; }
@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }
.big { font-family: var(--display); font-weight: 900; font-size: clamp(40px, 9vw, 60px); line-height: 1.1; }
.sub { font-size: 14px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.chart .val { font-variant-numeric: tabular-nums; }
.grid line { stroke: var(--line); stroke-width: 1; }
.note { font-size: 13px; color: var(--muted); }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.claims { display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; list-style: none; }
.claims li { display: grid; gap: 4px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; }
.kpi b { font-family: var(--display); font-size: 22px; font-variant-numeric: tabular-nums; }
.kpi span { font-size: 12px; color: var(--muted); }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; position: sticky; left: 0; background: var(--surface); }
thead th { color: var(--muted); font-weight: 400; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--down); outline-offset: 2px; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 260px; z-index: 5; }
</style>

<main>
  <header class="hero">
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <span class="eyebrow">使途別「人件費」· 一般会計の当初予算 · FY2017 → FY2026</span>
      <h1>国の人件費は、10年でどれだけ増えたか</h1>
      <div class="big num up" id="heroDelta"></div>
      <div class="sub num" id="heroSub"></div>
    </div>
    <div class="panel"><svg class="chart" id="heroChart" viewBox="0 0 420 230" role="img" aria-label="一般会計の人件費の推移"></svg></div>
  </header>

  <section>
    <h2>予算全体ほどは増えていない</h2>
    <div class="kpis" id="kpis"></div>
    <p id="shareText"></p>
    <div class="panel"><svg class="chart" id="shareChart" viewBox="0 0 680 150" role="img" aria-label="一般会計に占める人件費の割合"></svg></div>
  </section>

  <section>
    <h2>増えた分の半分は防衛省</h2>
    <p id="minText"></p>
    <div class="panel scroll"><svg class="chart" id="minChart" role="img" aria-label="府省別の人件費の増減"></svg></div>
    <ul class="claims">
      <li><strong>防衛省の比重は 4 割強のまま</strong><span id="defText"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>外務省は現地の職員の給与が増えた</strong><span>外務省は 0.103 → 0.156兆円（+0.053兆円）。目「現地補助員給与」が 0.014 → 0.029兆円と倍になりました。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>新しくできた組織</strong><span>デジタル庁の人件費は、FY2021 の 30億円から FY2026 の 140億円になりました。こども家庭庁は FY2026 で 50億円です。どちらも、前の組織から移った分を含みます（どこから移ったかは、このデータでは分けていません）。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>給与明細で見ると</h2>
    <p>人件費の目（給与の費目）ごとの増減です。基本給より諸手当の伸びが大きく、退職手当は減っています。</p>
    <div class="panel scroll"><svg class="chart" id="nameChart" role="img" aria-label="人件費の目ごとの増減"></svg></div>
    <p class="note">目の名前は、予算書のままです。自衛官の給与も「職員基本給」「職員諸手当」の目に入っています（防衛省の内訳は下の表）。</p>
  </section>

  <section>
    <h2>FY2026 は 1 年で 0.17兆円増えた</h2>
    <p id="y26Text"></p>
    <div class="panel scroll"><table id="y26Table"></table></div>
  </section>

  <section>
    <h2>特別会計の人件費は小さい</h2>
    <p id="speText"></p>
    <div class="panel scroll"><table id="acctTable"></table></div>
    <p class="note">一般会計から特別会計への繰入は、使途別では「他会計へ繰入」に分類され、人件費には入りません。そのため、2 つを足しても二重には数えていません。</p>
  </section>

  <section>
    <h2>決算では、どれだけ使われたか</h2>
    <p id="settleText"></p>
    <div class="panel scroll"><svg class="chart" id="settleChart" role="img" aria-label="人件費の決算（不用額と翌年度繰越）"></svg></div>
    <ul class="claims">
      <li><strong>FY2023 から、退職手当の繰越が出てきた</strong><span id="carText"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>FY2024 は、成立した予算が当初より 0.11兆円多い</strong><span id="supText"></span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
    </ul>
    <details>
      <summary>府省別の不用（FY2017〜FY2024 の 8 年合計）を開く</summary>
      <div class="scroll" style="margin-top:12px"><table id="unTable"></table></div>
    </details>
  </section>

  <section>
    <h2>全部の数字</h2>
    <details>
      <summary>府省別・目別・防衛省の目別・決算の表を開く</summary>
      <div class="scroll" style="margin-top:12px;display:flex;flex-direction:column;gap:16px"><table id="tMin"></table><table id="tName"></table><table id="tDef"></table><table id="tSettle"></table></div>
    </details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の予算書・決算書（目の表）。当初予算は政府案。FY2025 は国会提出時の版。FY2017〜FY2021 は、提出時か成立後かを判定できていません。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が目の行を抽出・構造化し、分類コードを付けたもの。人件費は、目の使途別分類コードが「1」の行です（一般会計は 5 つ目、特別会計は 4 つ目のコード）。</li>
      <li><span class="tag ai"></span>年度・府省・目ごとの合計、増減、割合、文章の解釈は、この探索で計算したものです。予算書の目の CSV を直接読んで足した合計とも、全年度で千円まで一致しました。決算は、目の CSV で「現額 = 歳出予算額 + 前年度繰越 + 予備費使用 + 流用等 + 移替」「現額 = 支出済 + 翌年度繰越 + 不用」が、全年度で円まで成り立つことを確かめました。</li>
      <li>人数のデータは無いので、一人当たりの給与は分かりません。給与改定・定員の増減・年齢構成のどれが効いたかは、このデータからは分かりません。</li>
      <li>委託費・補助金の中で払われる人件費や、独立行政法人・地方公共団体の人件費は入っていません。名目の金額で、物価の調整はしていません。</li>
      <li>当初予算と、成立した予算（決算の「歳出予算額」）の差は、補正予算などによるものと考えられますが、目ごとの補正の記録とは照合していません。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>人件費の伸び（+11%）は、予算全体（+25%）より小さいと感じましたか、大きいと感じましたか。</li>
      <li>FY2024 の当初と成立の差（+0.11兆円）や、FY2026 の伸びが、給与改定によるものかを確かめたいですか。補正予算の目の表と突き合わせられます。</li>
      <li>委託費・補助金の中の人件費（外の組織で働く人の給与）にも、目を向けますか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（2026-11-03）。単位は兆円・億円（千円・円の値から計算し、表示で丸め）。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y, S = D.S;
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const cho = v => v / 10000; // 億円 → 兆円
const fc = (v, d = 3) => v === null || v === undefined ? '—' : cho(v).toFixed(d);
const fo = v => v === null || v === undefined ? '—' : Math.round(v).toLocaleString('ja-JP');
const sg = (v, d = 3) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(cho(v)).toFixed(d);
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 270) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const last = Y.length - 1;
const g0 = D.gen[0], g1 = D.gen[last], a0 = D.all[0], a1 = D.all[last];
const dl = r => (r.v[last] ?? 0) - (r.v[0] ?? 0);
const seriesTip = r => Y.map((y, i) => `FY${y}: ${fc(r.v[i])}兆円`).join('<br>');

document.getElementById('heroDelta').textContent = `+${cho(g1 - g0).toFixed(2)}兆円`;
document.getElementById('heroSub').textContent = `${fc(g0, 2)}兆円 → ${fc(g1, 2)}兆円（+${((g1 / g0 - 1) * 100).toFixed(1)}%）`;

// ヒーロー: 年度ごとの棒（0 から）
(() => {
  const s = document.getElementById('heroChart'), W = 420, H = 230, L = 36, R = 8, T = 22, B = 24;
  const max = 5, bw = (W - L - R) / Y.length;
  const y = v => T + (H - T - B) * (1 - cho(v) / max);
  const g = el('g', { class: 'grid' }, s);
  for (const v of [0, 1, 2, 3, 4, 5]) { el('line', { x1: L, x2: W - R, y1: y(v * 10000), y2: y(v * 10000) }, g); el('text', { x: L - 6, y: y(v * 10000) + 4, 'text-anchor': 'end' }, s).textContent = v; }
  el('text', { x: L, y: 12 }, s).textContent = '兆円';
  D.gen.forEach((v, i) => {
    const x = L + bw * i + bw * 0.18, w = bw * 0.64;
    el('rect', { x, y: y(v), width: w, height: y(0) - y(v), rx: 3, fill: i === last ? 'var(--up)' : 'var(--bar)' }, s);
    if (i === 0 || i === last) el('text', { x: x + w / 2, y: y(v) - 6, 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = fc(v, 2);
    if (i % 3 === 0 || i === last) el('text', { x: x + w / 2, y: H - 6, 'text-anchor': 'middle' }, s).textContent = Y[i];
    const hit = el('rect', { x: L + bw * i, y: T, width: bw, height: H - T - B, fill: 'transparent' }, s);
    hover(hit, `FY${Y[i]}<br>人件費 ${fc(v)}兆円<br>一般会計の ${(v / D.all[i] * 100).toFixed(2)}%`);
  });
})();

// KPI と割合
(() => {
  const k = document.getElementById('kpis');
  const items = [[`+${((g1 / g0 - 1) * 100).toFixed(1)}%`, '人件費（一般会計）の伸び'], [`+${((a1 / a0 - 1) * 100).toFixed(1)}%`, '一般会計全体の伸び'], [`${(g0 / a0 * 100).toFixed(2)}% → ${(g1 / a1 * 100).toFixed(2)}%`, '一般会計に占める割合']];
  k.innerHTML = items.map(([b, s]) => `<div class="kpi"><b class="num">${b}</b><span>${s}</span></div>`).join('');
  document.getElementById('shareText').textContent = `一般会計は 25% 増えましたが、人件費は 11% の増加です。割合は ${(g0 / a0 * 100).toFixed(2)}% から ${(g1 / a1 * 100).toFixed(2)}% に下がりました。FY2023 が一番低い ${(D.gen[6] / D.all[6] * 100).toFixed(2)}% なのは、この年の一般会計が、防衛力強化のための資金への繰入（3.38兆円）などで膨らんだためです。`;
  const s = document.getElementById('shareChart'), W = 680, H = 150, L = 40, R = 40, T = 20, B = 24, lo = 3.5, hi = 4.75;
  const x = i => L + (W - L - R) * i / last, y = p => T + (H - T - B) * (1 - (p - lo) / (hi - lo));
  const sh = D.gen.map((v, i) => v / D.all[i] * 100);
  const g = el('g', { class: 'grid' }, s);
  for (const p of [3.5, 4.0, 4.5]) { el('line', { x1: L, x2: W - R, y1: y(p), y2: y(p) }, g); el('text', { x: L - 6, y: y(p) + 4, 'text-anchor': 'end' }, s).textContent = p.toFixed(1) + '%'; }
  el('polyline', { points: sh.map((p, i) => `${x(i)},${y(p)}`).join(' '), fill: 'none', stroke: 'var(--bar)', 'stroke-width': 2 }, s);
  sh.forEach((p, i) => {
    el('circle', { cx: x(i), cy: y(p), r: i === last || i === 0 ? 4.5 : 3, fill: i === last ? 'var(--up)' : 'var(--bar)', stroke: 'var(--surface)', 'stroke-width': 1.5 }, s);
    if (i === 0 || i === last || i === 6) el('text', { x: x(i), y: y(p) - 9, 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = p.toFixed(2) + '%';
    el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, s).textContent = String(Y[i]).slice(2);
    hover(el('circle', { cx: x(i), cy: y(p), r: 14, fill: 'transparent' }, s), `FY${Y[i]}: ${p.toFixed(2)}%`);
  });
})();

// 横棒（増減）
function divBars(id, rows, labelW, opts = {}) {
  const s = document.getElementById(id), W = 680, rowH = 26, T = 8, L = labelW, R = 96, H = T + rows.length * rowH + 24;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = (opts.minW || 540) + 'px';
  const vals = rows.map(dl), max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const x = v => L + (W - L - R) * (v - min) / (max - min || 1), x0 = x(0);
  const g = el('g', { class: 'grid' }, s);
  const step = opts.step || 500;
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) { el('line', { x1: x(v), x2: x(v), y1: T, y2: H - 22 }, g); el('text', { x: x(v), y: H - 6, 'text-anchor': 'middle' }, s).textContent = v === 0 ? '0' : (v > 0 ? '+' : '−') + Math.abs(cho(v)).toFixed(2); }
  rows.forEach((r, i) => {
    const d = dl(r), yy = T + i * rowH, up = d >= 0, bx = Math.min(x(d), x0), bw = Math.max(2, Math.abs(x(d) - x0));
    el('text', { x: L - 8, y: yy + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n.length > 13 ? r.n.slice(0, 13) + '…' : r.n;
    el('rect', { x: bx, y: yy + 6, width: bw, height: rowH - 10, rx: 3, fill: up ? 'var(--up)' : 'var(--down)' }, s);
    el('text', { x: Math.max(x(d), x0) + 6, y: yy + 17, class: 'val' }, s).textContent = sg(d) + '兆円';
    hover(el('rect', { x: 0, y: yy, width: W, height: rowH, fill: 'transparent' }, s), `<b>${r.n}</b><br>${sg(d)}兆円<br>${seriesTip(r)}`);
  });
  el('line', { x1: x0, x2: x0, y1: T, y2: H - 22, stroke: 'var(--zero)', 'stroke-width': 1 }, s);
}
// 府省
(() => {
  const rows = D.min.filter(r => Math.abs(dl(r)) >= 50).sort((a, b) => dl(b) - dl(a));
  divBars('minChart', rows, 120);
  const def = D.min.find(r => r.n === '防衛省'), dd = dl(def), tot = g1 - g0;
  document.getElementById('minText').textContent = `一般会計の人件費の増加 ${cho(tot).toFixed(3)}兆円のうち、防衛省が ${cho(dd).toFixed(3)}兆円（${(dd / tot * 100).toFixed(0)}%）。次が法務省・外務省・国土交通省・財務省です。減ったのは農林水産省（${sg(dl(D.min.find(r => r.n === '農林水産省')))}兆円）などです。`;
  const share = i => def.v[i] / D.gen[i] * 100;
  document.getElementById('defText').textContent = `防衛省の人件費は ${fc(def.v[0])} → ${fc(def.v[last])}兆円。一般会計の人件費に占める割合は ${share(0).toFixed(1)}% → ${share(last).toFixed(1)}% で、10 年間 41〜44% の間です。目で見ると、職員基本給 ${fc(D.def.find(r => r.n === '職員基本給').v[0])} → ${fc(D.def.find(r => r.n === '職員基本給').v[last])}兆円、職員諸手当 ${fc(D.def.find(r => r.n === '職員諸手当').v[0])} → ${fc(D.def.find(r => r.n === '職員諸手当').v[last])}兆円、在日米軍の駐留軍等労働者の給与（特別協定）${fc(D.def.find(r => r.n === '駐留軍等労働者特別協定給与').v[0])} → ${fc(D.def.find(r => r.n === '駐留軍等労働者特別協定給与').v[last])}兆円。`;
})();
// 目
(() => {
  const rows = D.name.filter(r => Math.abs(dl(r)) >= 50).sort((a, b) => dl(b) - dl(a));
  divBars('nameChart', rows, 170);
})();
// FY2026
(() => {
  const i5 = last - 1, d26 = g1 - D.gen[i5];
  const top = (arr, n) => arr.map(r => ({ n: r.n, a: r.v[i5], b: r.v[last], d: (r.v[last] ?? 0) - (r.v[i5] ?? 0) })).sort((p, q) => Math.abs(q.d) - Math.abs(p.d)).slice(0, n);
  const nm = top(D.name, 5), mn = top(D.min, 5);
  document.getElementById('y26Text').textContent = `FY2025 の ${fc(D.gen[i5])}兆円から、FY2026 は ${fc(g1)}兆円（${sg(d26)}兆円、+${((g1 / D.gen[i5] - 1) * 100).toFixed(1)}%）。10 年の増加の ${(d26 / (g1 - g0) * 100).toFixed(0)}% が、この 1 年に集まっています。目では職員基本給・職員諸手当・退職手当、府省では防衛省・法務省・国土交通省が大きく増えました。`;
  const row = r => `<tr><td>${r.n}</td><td>${fo(r.a)}</td><td>${fo(r.b)}</td><td class="${r.d >= 0 ? 'up' : 'down'}">${r.d >= 0 ? '+' : '−'}${fo(Math.abs(r.d))}</td></tr>`;
  document.getElementById('y26Table').innerHTML = `<thead><tr><th>目（億円）</th><th>FY2025</th><th>FY2026</th><th>増減</th></tr></thead><tbody>${nm.map(row).join('')}</tbody><thead><tr><th>府省（億円）</th><th></th><th></th><th></th></tr></thead><tbody>${mn.map(row).join('')}</tbody>`;
})();
// 特別会計
(() => {
  const s0 = D.spe[0], s1 = D.spe[last];
  document.getElementById('speText').textContent = `特別会計（人件費のある ${D.acct.length} の会計）の人件費は、${fo(s0)}億円 → ${fo(s1)}億円です。一般会計と合わせると ${fc(g0 + s0, 2)} → ${fc(g1 + s1, 2)}兆円で、一般会計が 96% を占めます。特別会計の中では、労働保険・自動車安全・特許の 3 つで大半です。`;
  const rows = [...D.acct].sort((a, b) => (b.v[last] ?? 0) - (a.v[last] ?? 0));
  document.getElementById('acctTable').innerHTML = `<thead><tr><th>特別会計（億円）</th><th>FY2017</th><th>FY2026</th><th>増減</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.n}</td><td>${fo(r.v[0])}</td><td>${fo(r.v[last])}</td><td>${r.v[0] === null || r.v[last] === null ? '—' : (dl(r) >= 0 ? '+' : '−') + fo(Math.abs(dl(r)))}</td></tr>`).join('')}<tr><td><b>計</b></td><td><b>${fo(s0)}</b></td><td><b>${fo(s1)}</b></td><td><b>+${fo(s1 - s0)}</b></td></tr></tbody>`;
})();
// 決算
(() => {
  const st = D.settle;
  const rate = r => r.un / r.cur * 100;
  document.getElementById('settleText').textContent = `一般会計の人件費は、決算でも予算のほとんどが使われています。不用（使われずに残った額）は、歳出予算現額の ${Math.min(...st.map(rate)).toFixed(2)}〜${Math.max(...st.map(rate)).toFixed(2)}%（年 ${fo(Math.min(...st.map(r => r.un)))}〜${fo(Math.max(...st.map(r => r.un)))}億円）です。`;
  const s = document.getElementById('settleChart'), W = 680, H = 210, L = 44, R = 12, T = 24, B = 26;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const max = 800, bw = (W - L - R) / st.length, y = v => T + (H - T - B) * (1 - v / max);
  const g = el('g', { class: 'grid' }, s);
  for (const v of [0, 200, 400, 600, 800]) { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = v; }
  el('text', { x: L, y: 12 }, s).textContent = '億円';
  st.forEach((r, i) => {
    const x = L + bw * i + bw * 0.22, w = bw * 0.56;
    el('rect', { x, y: y(r.un), width: w, height: y(0) - y(r.un), fill: 'var(--soft)' }, s);
    el('rect', { x, y: y(r.un + r.car), width: w, height: y(r.un) - y(r.un + r.car) - (r.car > 0 ? 2 : 0), fill: 'var(--up)' }, s);
    el('text', { x: x + w / 2, y: y(r.un + r.car) - 6, 'text-anchor': 'middle', class: 'val' }, s).textContent = fo(r.un + r.car);
    el('text', { x: x + w / 2, y: H - 8, 'text-anchor': 'middle' }, s).textContent = r.y;
    hover(el('rect', { x: L + bw * i, y: T, width: bw, height: H - T - B, fill: 'transparent' }, s), `FY${r.y}<br>現額 ${fo(r.cur)}億円<br>支出済 ${fo(r.spent)}億円<br>翌年度繰越 ${fo(r.car)}億円<br>不用 ${fo(r.un)}億円（${rate(r).toFixed(2)}%）`);
  });
  const lg = el('g', {}, s);
  el('rect', { x: W - 230, y: 6, width: 10, height: 10, fill: 'var(--soft)' }, lg); el('text', { x: W - 216, y: 15 }, lg).textContent = '不用';
  el('rect', { x: W - 170, y: 6, width: 10, height: 10, fill: 'var(--up)' }, lg); el('text', { x: W - 156, y: 15 }, lg).textContent = '翌年度繰越';
  const c = D.carried.find(r => r.n === '退職手当');
  document.getElementById('carText').textContent = `FY2017〜FY2022 は、人件費の翌年度繰越が毎年 37〜52億円でした。FY2023 は ${fo(st[6].car)}億円、FY2024 は ${fo(st[7].car)}億円です。そのうち退職手当が、FY2023 は ${fo(c.y23)}億円、FY2024 は ${fo(c.y24)}億円でした。繰り越した理由は、このデータには書かれていません。`;
  const r24 = st[7], r20 = st[3];
  document.getElementById('supText').textContent = `決算の「歳出予算額」（成立した予算。補正を含む）は、FY2024 が ${fo(r24.ann)}億円で、当初予算 ${fo(r24.tou)}億円より ${fo(r24.ann - r24.tou)}億円多くなっています。FY2017〜FY2022 は逆に、当初より 200〜600億円少ない年が続きました（FY2020 は −${fo(Math.abs(r20.ann - r20.tou))}億円）。給与改定などの補正による可能性がありますが、補正の目の記録とは照合していません（推測）。`;
  const un = D.minUnused.filter(r => (r.cur ?? 0) >= 1000);
  document.getElementById('unTable').innerHTML = `<thead><tr><th>府省（億円）</th><th>現額</th><th>不用</th><th>不用の割合</th></tr></thead><tbody>${un.map(r => `<tr><td>${r.n}</td><td>${fo(r.cur)}</td><td>${fo(r.un)}</td><td>${(r.un / r.cur * 100).toFixed(2)}%</td></tr>`).join('')}</tbody>`;
})();
// 全部の表
(() => {
  const head = t => `<thead><tr><th>${t}（兆円）</th>${Y.map(y => `<th>FY${y}</th>`).join('')}<th>増減</th></tr></thead>`;
  const row = r => `<tr><td>${r.n}</td>${r.v.map(v => `<td>${fc(v)}</td>`).join('')}<td>${r.v[0] === null || r.v[last] === null ? '—' : sg(dl(r))}</td></tr>`;
  const sorted = a => [...a].sort((p, q) => (q.v[last] ?? 0) - (p.v[last] ?? 0));
  document.getElementById('tMin').innerHTML = head('府省') + '<tbody>' + sorted(D.min).map(row).join('') + `<tr><td><b>一般会計の人件費</b></td>${D.gen.map(v => `<td><b>${fc(v)}</b></td>`).join('')}<td><b>${sg(g1 - g0)}</b></td></tr></tbody>`;
  document.getElementById('tName').innerHTML = head('目') + '<tbody>' + sorted(D.name).filter(r => Math.max(...r.v.map(v => v ?? 0)) >= 10).map(row).join('') + '</tbody>';
  document.getElementById('tDef').innerHTML = head('防衛省の目') + '<tbody>' + sorted(D.def).map(row).join('') + '</tbody>';
  document.getElementById('tSettle').innerHTML = `<thead><tr><th>決算（億円）</th>${S.map(y => `<th>FY${y}</th>`).join('')}</tr></thead><tbody>` + [['当初予算', 'tou'], ['歳出予算額', 'ann'], ['前年度繰越', 'carIn'], ['予備費使用', 'res'], ['流用等', 'ryu'], ['歳出予算現額', 'cur'], ['支出済', 'spent'], ['翌年度繰越', 'car'], ['不用', 'un']].map(([l, k]) => `<tr><td>${l}</td>${D.settle.map(r => `<td>${fo(r[k])}</td>`).join('')}</tr>`).join('') + '</tbody>';
})();
</script>
'''
open(D+'index.html','w').write(html.replace('__DATA__', data))
open(D+'preview.html','w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html.replace('__DATA__', data)+'</body></html>')
