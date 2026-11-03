import json
data=open('data.json').read()
html=r'''<title>防衛費の中身</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。増 = 朱、減 = 藍、資金繰入 = 斜線の灰 */
:root {
  --bg: #f5f6f4; --surface: #ffffff; --ink: #1b211d; --muted: #5d665f; --line: #d8ddd8;
  --up: #d2542a; --down: #2a6fc9; --zero: #9aa39c; --bar: #4d5b52; --fund: #b7bfb9; --tag: #edf0ec;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121513; --surface: #1a1f1b; --ink: #e6ebe7; --muted: #9ba59e; --line: #2c342e;
  --up: #f07a50; --down: #5b9cf0; --zero: #6b756d; --bar: #a9b8ad; --fund: #4b544d; --tag: #232a25; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121513; --surface: #1a1f1b; --ink: #e6ebe7; --muted: #9ba59e; --line: #2c342e;
  --up: #f07a50; --down: #5b9cf0; --zero: #6b756d; --bar: #a9b8ad; --fund: #4b544d; --tag: #232a25; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.8;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; line-height: 1.35; margin: 0; }
h1 { font-size: clamp(28px, 6vw, 40px); font-weight: 900; }
h2 { font-size: 22px; font-weight: 700; }
h3 { font-size: 16px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.num { font-variant-numeric: tabular-nums; }
.up { color: var(--up); } .down { color: var(--down); }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 24px; align-items: center; }
@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }
.big { font-family: var(--display); font-weight: 900; font-size: clamp(40px, 9vw, 60px); line-height: 1.1; }
.from-to { font-size: 15px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
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
.multiples { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.mini { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mini .name { font-size: 13px; font-weight: 700; }
.mini .delta { font-size: 13px; }
.mini .items { font-size: 11px; color: var(--muted); line-height: 1.5; }
.scroll { overflow-x: auto; }
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
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 280px; z-index: 5; }
</style>

<main>
  <header class="hero">
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <span class="eyebrow">防衛関係費（主要経費別）・一般会計・当初予算 FY2017 → FY2026</span>
      <h1>防衛費は、何に使われるようになったのか</h1>
      <div class="big num up" id="heroDelta"></div>
      <div class="from-to num" id="heroFromTo"></div>
    </div>
    <div class="panel">
      <svg class="chart" id="totalChart" viewBox="0 0 440 240" role="img" aria-label="防衛関係費の当初予算の推移"></svg>
      <div class="legend" style="margin-top:8px"><span><i style="background:var(--bar)"></i>防衛省の所管</span><span><i style="background:var(--fund)"></i>防衛力強化のための資金へ繰入（財務省の所管）</span></div>
    </div>
  </header>

  <section>
    <h2>増えた分の 8 割は「物件費」</h2>
    <p id="useLead"></p>
    <div class="panel scroll"><svg class="chart" id="useChart" role="img" aria-label="使途別の増減"></svg></div>
    <p class="note">使途別の分類コードごとに、目の当初予算額を足した値（資金繰入は「他会計へ繰入」で、FY2026 は 0）。</p>
  </section>

  <section>
    <h2>何を買い、何を直しているか</h2>
    <p id="mokuLead"></p>
    <div class="panel scroll"><svg class="chart" id="mokuChart" role="img" aria-label="目の増減の上位"></svg></div>
    <p class="note">目（予算書の一番細かい単位）の名前ごとに足した値。棒にカーソルを当てると年度ごとの値が出ます。</p>
  </section>

  <section>
    <h2>項のまとまりで見る 10 年</h2>
    <div class="multiples" id="multiples"></div>
    <p class="note">6 つとも同じ目盛り（0〜4兆円）。まとまりは、この LP が項の名前で分けたもの。施設整備は FY2023 に専用の項ができるまで、主に「防衛力基盤整備費」などの中にありました。</p>
  </section>

  <section>
    <h2>FY2023 の 3.38兆円は「資金」への繰入</h2>
    <p>FY2023 の防衛関係費 10.17兆円には、財務省の所管の「防衛力強化のための資金へ繰入」3.38兆円が入っています。防衛省の所管の額は 6.79兆円です。この繰入は、分類コードでは防衛関係費ですが、防衛省の予算ではありません。その後は、当初予算では 0 で、補正予算で繰り入れています。</p>
    <div class="panel scroll"><table>
      <thead><tr><th>年度</th><th>当初予算</th><th>補正の追加</th><th>補正後</th><th>支出済（決算）</th></tr></thead>
      <tbody>
        <tr><td>FY2023「防衛力強化のための資金へ繰入」</td><td>3.381兆円</td><td>+1.039兆円</td><td>4.420兆円</td><td>4.420兆円</td></tr>
        <tr><td>FY2024「防衛力強化資金へ繰入」</td><td>0</td><td>+0.110兆円</td><td>0.110兆円</td><td>0.110兆円</td></tr>
        <tr><td>FY2025「防衛力強化資金へ繰入」</td><td>0</td><td>+0.629兆円</td><td>0.629兆円</td><td>—（決算は未収録）</td></tr>
        <tr><td>FY2026「防衛力強化資金へ繰入」</td><td>0</td><td>—</td><td>—</td><td>—</td></tr>
      </tbody>
    </table></div>
    <p class="note">FY2024 から目の名前が「防衛力強化資金へ繰入」に変わっています。資金から防衛省の予算へ、いつ・いくら使われたか（歳入の側）は、このデータにはありません。</p>
    <span><span class="tag src"></span><span class="tag proc"></span></span>
  </section>

  <section>
    <h2>当初予算から決算まで（防衛省の所管、FY2017〜FY2024）</h2>
    <p id="settleLead"></p>
    <div class="panel scroll"><svg class="chart" id="settleChart" role="img" aria-label="当初予算・補正後・歳出予算現額・支出済の推移"></svg>
      <div class="legend" style="margin-top:8px"><span><i style="background:var(--zero)"></i>当初予算</span><span><i style="background:var(--bar)"></i>歳出予算現額</span><span><i style="background:var(--up)"></i>支出済</span><span>点線 = 補正後</span></div>
    </div>
    <div class="panel scroll"><table id="settleTbl"></table></div>
    <h3>FY2024 に翌年度へ繰り越した額の大きい項</h3>
    <div class="panel scroll"><table id="carryTbl"></table></div>
    <p class="note">歳出予算現額 = 歳出予算額 + 前年度繰越額 + 予備費使用額 + 流用等 + 移替。これが、支出済 + 翌年度繰越 + 不用額 と、全年度で円まで一致することを確かめました。</p>
  </section>

  <section>
    <h2>「防衛省の予算」と「防衛関係費」の違い</h2>
    <ul class="claims">
      <li><strong>防衛関係費は、目に付いた分類コード（主要経費別 35）で集めた額</strong><span>このデータでは、防衛省の所管の目はすべて防衛関係費です。防衛省の外で防衛関係費に入っているのは、財務省の所管の資金繰入だけでした（FY2023〜FY2026）。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>だから、2 つの差は資金繰入の額と同じ</strong><span>FY2023 は 10.17兆円 − 6.79兆円 = 3.38兆円。ほかの年度は、当初予算では同じ額です。</span><span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>数字の表（兆円）</h2>
    <details>
      <summary>項のまとまり・使途別・目（上位）を開く</summary>
      <div class="scroll" style="margin-top:12px"><table id="tbl"></table></div>
    </details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の予算書・補正予算書・決算書（一般会計の項・目の表）。当初予算の版は年度で違い、FY2025 は国会提出時、FY2017〜FY2021 は提出時か成立後かを判定できていません。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が項・目を抽出・構造化し、分類コードを付けたもの。目の当初予算の合計（防衛関係費）は、防衛省の所管の項の合計に資金繰入を足した額と、全年度で一致しました。補正の差引額は、目の合計と項の合計の差が資金繰入の補正（FY2023 1.039兆円・FY2024 0.110兆円・FY2025 0.629兆円）と一致しました。ただし FY2018 は 7.9億円、FY2020 は 39.8億円の差が残り、理由は未確認です。</li>
      <li><span class="tag ai"></span>項のまとまり（6 つ）、増減、割合、文章の解釈は、この探索で計算・判断したものです。政府の公表する防衛関係費の額とは、作り方が違うので一致するとは限りません。照合していません。</li>
      <li>決算は項の単位で示しました。目の単位の決算は、目の値が無い行（年度ごとに 2〜10 目）があり、項の合計と最大 0.07兆円ずれます。理由は未確認です。</li>
      <li>名目の金額です。物価・為替の変化は調整していません。装備品の数量や性能は、このデータにはありません。</li>
      <li>複数年度にまたがる契約（国庫債務負担行為・後年度負担）は、このデータに無いので、将来の支払いの約束は見ていません。艦船の建造費が年度ごとの項（例: 令和6年度甲Ⅴ型警備艦建造費）に分かれているのは、この契約の年度ごとの支払いのためだと推測します。</li>
      <li>特別会計（防衛省の所管は無い）と、他の府省の予算で防衛に関わるもの（海上保安庁など）は含めていません。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>「買う」より「直す・維持する」（航空機修理費・通信維持費・艦船修理費）が大きく増えています。これは意外でしたか。</li>
      <li>FY2022 から翌年度への繰越が増えています（現額の 4〜5% から 10% 前後）。在日米軍の駐留関連や施設整備の繰越を、もう少し掘りますか。</li>
      <li>防衛力強化のための資金の行き先（どの年度の防衛省の予算に入ったか）は、歳入の資料が必要です。追加のデータを探しますか。</li>
      <li>FY2025 の決算（実際に使った額）が公表されたら、補正後 9.51兆円との差を見ますか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC・テーマ 4（2026-11-03）。数値の単位は兆円（千円・円単位の値から計算し、表示で丸め）。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y;
const tri = v => v / 10000; // 億円 → 兆円
const f = (v, d = 2) => v === null || v === undefined ? '—' : tri(v).toFixed(d);
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(tri(v)).toFixed(2);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 290) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const series = r => Y.map((y, i) => `FY${y}: ${f(r.v[i])}兆円`).join('<br>');
const delta = r => (r.v[9] ?? 0) - (r.v[0] ?? 0);

// hero
const t0 = D.total[0], t1 = D.total[9];
document.getElementById('heroDelta').textContent = `+${tri(t1 - t0).toFixed(2)}兆円`;
document.getElementById('heroFromTo').textContent = `${f(t0)}兆円 → ${f(t1)}兆円（+${((t1 / t0 - 1) * 100).toFixed(1)}%）`;
(() => {
  const s = document.getElementById('totalChart'), W = 440, H = 240, L = 34, R = 8, T = 18, B = 24;
  const max = 11, x = i => L + (W - L - R) * (i + 0.5) / Y.length, bw = (W - L - R) / Y.length * 0.62, y = v => T + (H - T - B) * (1 - tri(v) / max);
  const g = el('g', { class: 'grid' }, s);
  for (const v of [0, 2, 4, 6, 8, 10]) { el('line', { x1: L, x2: W - R, y1: y(v * 10000), y2: y(v * 10000) }, g); el('text', { x: L - 6, y: y(v * 10000) + 4, 'text-anchor': 'end' }, s).textContent = v; }
  el('text', { x: 2, y: 10 }, s).textContent = '兆円';
  const defs = el('defs', {}, s); const p = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 6, height: 6, fill: 'var(--fund)' }, p); el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--surface)', 'stroke-width': 2 }, p);
  Y.forEach((yr, i) => {
    const fund = D.fund[i] ?? 0, mod = D.total[i] - fund;
    el('rect', { x: x(i) - bw / 2, y: y(mod), width: bw, height: y(0) - y(mod), rx: 3, fill: 'var(--bar)' }, s);
    if (fund > 0) el('rect', { x: x(i) - bw / 2, y: y(D.total[i]), width: bw, height: y(mod) - y(D.total[i]) - 2, rx: 3, fill: 'url(#hatch)' }, s);
    if (i % 3 === 0 || i === 9 || i === 6) el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, s).textContent = yr;
    if (i === 0 || i === 9 || i === 6) el('text', { x: x(i), y: y(D.total[i]) - 5, 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = f(D.total[i], 1);
    const hit = el('rect', { x: x(i) - bw / 2 - 4, y: T, width: bw + 8, height: H - T - B, fill: 'transparent' }, s);
    hover(hit, `<b>FY${yr}</b><br>防衛関係費 ${f(D.total[i])}兆円${fund > 0 ? `<br>うち資金繰入 ${f(fund)}兆円<br>防衛省の所管 ${f(mod)}兆円` : ''}`);
  });
})();

// 横棒（増減）
function divBars(id, rows, labelW = 170) {
  const s = document.getElementById(id), W = 680, rowH = 26, T = 8, L = labelW, R = 70, H = T + rows.length * rowH + 24;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '540px';
  const ds = rows.map(delta), max = Math.max(0, ...ds), min = Math.min(0, ...ds), x = v => L + (W - L - R) * (v - min) / (max - min), x0 = x(0);
  const step = tri(max - min) > 2 ? 1 : 0.1;
  const g = el('g', { class: 'grid' }, s);
  for (let v = Math.ceil(tri(min) / step) * step; v <= tri(max) + 1e-9; v += step) { const xv = x(v * 10000); el('line', { x1: xv, x2: xv, y1: T, y2: H - 22 }, g); el('text', { x: xv, y: H - 6, 'text-anchor': 'middle' }, s).textContent = Math.abs(v) < 1e-9 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(step < 1 ? 1 : 0)}兆`; }
  rows.forEach((r, i) => {
    const d = ds[i], y = T + i * rowH, up = d >= 0, bx = Math.min(x(d), x0), bw = Math.max(2, Math.abs(x(d) - x0));
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n.length > 13 ? r.n.slice(0, 13) + '…' : r.n;
    el('rect', { x: bx, y: y + 6, width: bw, height: rowH - 10, rx: 3, fill: up ? 'var(--up)' : 'var(--down)' }, s);
    el('text', { x: up ? x(d) + 6 : x0 + 6, y: y + 17, class: 'val' }, s).textContent = sgn(d);
    hover(el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s), `<b>${r.n}</b><br>${sgn(d)}兆円<br>${series(r)}`);
  });
  el('line', { x1: x0, x2: x0, y1: T, y2: H - 22, stroke: 'var(--zero)', 'stroke-width': 1 }, s);
}
const useRows = D.use.filter(r => r.n !== '他会計へ繰入').sort((a, b) => delta(b) - delta(a));
divBars('useChart', useRows, 120);
const btot = t1 - t0, obj = D.use.find(r => r.n === '物件費'), jin = D.use.find(r => r.n === '人件費');
document.getElementById('useLead').textContent = `増えた ${tri(btot).toFixed(2)}兆円のうち、物件費（装備品の購入・修理、燃料、通信の維持など）が ${sgn(delta(obj))}兆円で ${(delta(obj) / btot * 100).toFixed(0)}% を占めます。物件費は ${f(obj.v[0])}兆円から ${f(obj.v[9])}兆円へ、${(obj.v[9] / obj.v[0]).toFixed(1)}倍になりました。人件費は ${f(jin.v[0])}兆円から ${f(jin.v[9])}兆円で、${sgn(delta(jin))}兆円にとどまります。`;
const mokuUp = D.moku.filter(r => r.v[0] !== null && r.v[9] !== null).sort((a, b) => delta(b) - delta(a)).slice(0, 12);
const air = D.moku.find(r => r.n === '航空機購入費');
divBars('mokuChart', [...mokuUp, air], 170);
const m = n => D.moku.find(r => r.n === n);
document.getElementById('mokuLead').textContent = `増えた目の上位は、航空機修理費（${f(m('航空機修理費').v[0])} → ${f(m('航空機修理費').v[9])}兆円）、通信維持費（${f(m('通信維持費').v[0])} → ${f(m('通信維持費').v[9])}兆円）、試作品費（${f(m('試作品費').v[0])} → ${f(m('試作品費').v[9])}兆円）、艦船修理費。新しく買う費用より、修理・維持と開発の費用が大きく伸びています。航空機購入費は年度で大きく振れ、FY2024 の ${f(air.v[7])}兆円から FY2026 は ${f(air.v[9])}兆円です。`;

// 項のまとまり
(() => {
  const host = document.getElementById('multiples');
  for (const r of D.groups) {
    const d = delta(r), box = document.createElement('div'); box.className = 'mini';
    box.innerHTML = `<span class="name">${r.n}</span><span class="delta num ${d >= 0 ? 'up' : 'down'}">${f(r.v[0])} → ${f(r.v[9])}兆円（${sgn(d)}）</span>`;
    const W = 220, H = 70, P = 4, max = 40000, x = i => P + (W - 2 * P) * i / 9, y = v => P + (H - 2 * P) * (1 - v / max);
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${r.n}の推移` });
    el('line', { x1: P, x2: W - P, y1: y(0), y2: y(0), stroke: 'var(--line)', 'stroke-width': 1 }, s);
    el('polyline', { points: r.v.map((v, i) => `${x(i)},${y(v ?? 0)}`).join(' '), fill: 'none', stroke: 'var(--bar)', 'stroke-width': 2 }, s);
    el('circle', { cx: x(9), cy: y(r.v[9] ?? 0), r: 3.5, fill: 'var(--up)' }, s);
    box.appendChild(s);
    const it = document.createElement('span'); it.className = 'items'; it.textContent = '項: ' + (r.items.length > 4 ? r.items.slice(0, 4).join('、') + ` ほか ${r.items.length - 4}` : r.items.join('、')); box.appendChild(it);
    hover(box, `<b>${r.n}</b><br>${series(r)}`); host.appendChild(box);
  }
})();

// 当初から決算
(() => {
  const S = D.settle, s = document.getElementById('settleChart'), W = 680, H = 260, L = 40, R = 16, T = 16, B = 26;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '540px';
  const lo = 4, hi = 10, n = S.length, x = i => L + (W - L - R) * (i + 0.5) / n, y = v => T + (H - T - B) * (1 - (tri(v) - lo) / (hi - lo));
  const g = el('g', { class: 'grid' }, s);
  for (const v of [4, 6, 8, 10]) { el('line', { x1: L, x2: W - R, y1: y(v * 10000), y2: y(v * 10000) }, g); el('text', { x: L - 6, y: y(v * 10000) + 4, 'text-anchor': 'end' }, s).textContent = v; }
  el('text', { x: 4, y: 10 }, s).textContent = '兆円';
  const line = (k, color, dash) => el('polyline', { points: S.map((r, i) => `${x(i)},${y(r[k])}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, ...(dash ? { 'stroke-dasharray': '4 3' } : {}) }, s);
  line('budget', 'var(--zero)'); line('revised', 'var(--bar)', true); line('current', 'var(--bar)'); line('spent', 'var(--up)');
  S.forEach((r, i) => {
    el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, s).textContent = r.y;
    for (const [k, c] of [['budget', 'var(--zero)'], ['current', 'var(--bar)'], ['spent', 'var(--up)']]) el('circle', { cx: x(i), cy: y(r[k]), r: 3.5, fill: c, stroke: 'var(--surface)', 'stroke-width': 1.5 }, s);
    hover(el('rect', { x: x(i) - 30, y: T, width: 60, height: H - T - B, fill: 'transparent' }, s), `<b>FY${r.y}</b><br>当初 ${f(r.budget)}兆円<br>補正後 ${f(r.revised)}兆円（補正 ${sgn(r.supp)}）<br>前年度繰越 ${f(r.carriedIn)}兆円<br>歳出予算現額 ${f(r.current)}兆円<br>支出済 ${f(r.spent)}兆円<br>翌年度繰越 ${f(r.carried)}兆円<br>不用 ${f(r.unused)}兆円`);
  });
  const last = S[n - 1];
  el('text', { x: x(n - 1) - 8, y: y(last.current) - 8, 'text-anchor': 'end', class: 'lbl val' }, s).textContent = `現額 ${f(last.current)}`;
  el('text', { x: x(n - 1) - 8, y: y(last.spent) + 16, 'text-anchor': 'end', class: 'lbl val' }, s).textContent = `支出済 ${f(last.spent)}`;
  const pct = (a, b) => (a / b * 100).toFixed(1);
  document.getElementById('settleLead').textContent = `毎年、補正予算で ${f(Math.min(...S.map(r => r.supp)))}〜${f(Math.max(...S.map(r => r.supp)))}兆円が足され、前年度からの繰越も加わって、使える額（歳出予算現額）は当初より大きくなります。FY2024 は当初 ${f(last.budget)}兆円に対して現額 ${f(last.current)}兆円、支出済 ${f(last.spent)}兆円。翌年度への繰越は、FY2017 の現額の ${pct(S[0].carried, S[0].current)}% から FY2024 は ${pct(last.carried, last.current)}% に増えています。不用額は 1〜2% 程度です。`;
  const rows = [['当初予算', 'budget'], ['補正の差引', 'supp'], ['補正後', 'revised'], ['前年度繰越', 'carriedIn'], ['予備費使用', 'reserve'], ['歳出予算現額', 'current'], ['支出済', 'spent'], ['翌年度繰越', 'carried'], ['不用額', 'unused']];
  document.getElementById('settleTbl').innerHTML = `<thead><tr><th>兆円</th>${S.map(r => `<th>FY${r.y}</th>`).join('')}</tr></thead><tbody>${rows.map(([l, k]) => `<tr><td>${l}</td>${S.map(r => `<td>${f(r[k], 3)}</td>`).join('')}</tr>`).join('')}<tr><td>支出済 / 現額</td>${S.map(r => `<td>${pct(r.spent, r.current)}%</td>`).join('')}</tr><tr><td>翌年度繰越 / 現額</td>${S.map(r => `<td>${pct(r.carried, r.current)}%</td>`).join('')}</tr></tbody>`;
  document.getElementById('carryTbl').innerHTML = `<thead><tr><th>項（組織）</th><th>歳出予算現額</th><th>支出済</th><th>翌年度繰越</th><th>繰越の割合</th><th>不用額</th></tr></thead><tbody>${D.s24.map(r => `<tr><td>${r.n}（${r.org}）</td><td>${f(r.cur, 3)}</td><td>${f(r.spent, 3)}</td><td>${f(r.carried, 3)}</td><td>${pct(r.carried, r.cur)}%</td><td>${f(r.unused, 3)}</td></tr>`).join('')}</tbody>`;
})();

// 表
(() => {
  const head = `<thead><tr><th>兆円</th>${Y.map(y => `<th>FY${y}</th>`).join('')}<th>増減</th></tr></thead>`;
  const row = r => `<tr><td>${r.n}</td>${r.v.map(v => `<td>${f(v)}</td>`).join('')}<td class="${delta(r) >= 0 ? 'up' : 'down'}">${sgn(delta(r))}</td></tr>`;
  const sub = l => `<tr><th>${l}</th>${Y.map(() => '<th></th>').join('')}<th></th></tr>`;
  const topMoku = D.moku.filter(r => r.v[9] !== null).sort((a, b) => (b.v[9] ?? 0) - (a.v[9] ?? 0)).slice(0, 20);
  document.getElementById('tbl').innerHTML = head + '<tbody>' + `<tr><td><b>防衛関係費（合計）</b></td>${D.total.map(v => `<td><b>${f(v)}</b></td>`).join('')}<td class="up"><b>${sgn(t1 - t0)}</b></td></tr>` + `<tr><td>うち資金繰入（財務省）</td>${D.fund.map(v => `<td>${f(v)}</td>`).join('')}<td></td></tr>` + sub('項のまとまり（防衛省の所管）') + D.groups.map(row).join('') + sub('使途別') + [...D.use].sort((a, b) => delta(b) - delta(a)).map(row).join('') + sub('目（FY2026 の額の上位 20）') + topMoku.map(row).join('') + '</tbody>';
})();
</script>
'''
out=html.replace('__DATA__', data)
open('index.html','w').write(out)
open('preview.html','w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+out+'</body></html>')
print(len(out))
