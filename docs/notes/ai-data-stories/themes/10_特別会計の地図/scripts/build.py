import json
data=open('page-data.json',encoding='utf-8').read()
html=r'''<title>特別会計の地図</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。総額 → 二重計上 → 会計ごと → 通り道 → 国債 → FY2021 の順。増 = 朱、減 = 藍、除いた繰入 = 灰の濃淡 */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --ink: #18202b; --muted: #5b6573; --line: #d9dee5;
  --up: #d2542a; --down: #2a6fc9; --zero: #9aa3ae; --tag: #eef1f5;
  --net: #18202b; --x1: #8f99a8; --x2: #b4bcc8; --x3: #d3d9e1;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --up: #f07a50; --down: #5b9cf0; --zero: #6b7582; --tag: #232b36;
  --net: #e8ecf1; --x1: #7d8796; --x2: #5c6573; --x3: #3d4550; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --up: #f07a50; --down: #5b9cf0; --zero: #6b7582; --tag: #232b36;
  --net: #e8ecf1; --x1: #7d8796; --x2: #5c6573; --x3: #3d4550; color-scheme: dark }
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
.hero { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stat .k { font-size: 12px; color: var(--muted); }
.stat .v { font-family: var(--display); font-weight: 900; font-size: 30px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.stat .s { font-size: 12px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.chart .val { font-variant-numeric: tabular-nums; }
.grid line { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.claims { display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; list-style: none; }
.claims li { display: grid; gap: 4px; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 560px) { .pair { grid-template-columns: 1fr; } }
.mini { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mini .name { font-size: 13px; font-weight: 700; }
.mini .delta { font-size: 13px; }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; position: sticky; left: 0; background: var(--surface); }
thead th { color: var(--muted); font-weight: 400; }
.bar { display: inline-block; height: 8px; border-radius: 2px; background: var(--x1); vertical-align: middle; margin-left: 6px; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--down); outline-offset: 2px; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
.small { font-size: 13px; color: var(--muted); }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 260px; z-index: 5; }
</style>

<main>
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="eyebrow">特別会計・当初予算（政府案）FY2017 → FY2026</span>
    <h1>特別会計は一般会計の 3.6 倍。足した 564兆円の約 3 割は、会計の間の受け渡し</h1>
    <div class="hero">
      <div class="stat"><span class="k">特別会計の合計（FY2026）</span><span class="v num" id="hSp"></span><span class="s num" id="hSpS"></span></div>
      <div class="stat"><span class="k">一般会計と足した単純合計</span><span class="v num" id="hGross"></span><span class="s">二重に数えた分を含む</span></div>
      <div class="stat"><span class="k">名前で見つけた繰入を除くと（試算）</span><span class="v num up" id="hNet"></span><span class="s num" id="hNetS"></span></div>
    </div>
  </header>

  <section>
    <h2>単純合計のうち、約 3 割は繰入</h2>
    <p id="dupLead"></p>
    <div class="panel scroll"><svg class="chart" id="stack" viewBox="0 0 680 300" style="min-width:520px" role="img" aria-label="単純合計の内訳（試算純計と除いた繰入）の年度推移"></svg></div>
    <div class="legend"><span><i style="background:var(--net)"></i>試算純計</span><span><i style="background:var(--x1)"></i>一般会計 → 特別会計</span><span><i style="background:var(--x2)"></i>特別会計 → 他の会計</span><span><i style="background:var(--x3)"></i>同じ特別会計の勘定の間</span></div>
    <ul class="claims">
      <li><strong>検算: 名前で見つけた繰入と、使途別「他会計へ繰入」が一致</strong><span>一般会計では、目の名前で見つけた特別会計への繰入が、使途別の分類「他会計へ繰入」の合計と、10 年度のうち 9 年度で一致しました（FY2026 は 69.66兆円）。合わない FY2023 の差 3.38兆円は、「防衛力強化のための資金へ繰入」です。資金への繰入で、特別会計への繰入ではないので、除いていません。特別会計でも、名前で分けた繰入と、除かなかった「資金への繰入」の和が、他会計へ繰入の合計と全年度で一致しました。</span><span><span class="tag src"></span><span class="tag proc"></span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>どの特別会計が大きく、どこが増えたか</h2>
    <div class="panel scroll"><svg class="chart" id="acc" role="img" aria-label="特別会計ごとの政府案（FY2026）と、FY2017 からの増減"></svg></div>
    <p class="small">棒は FY2026 の政府案（兆円）。右の数字は FY2017 からの増減。カーソルを当てると年度ごとの値が出ます。</p>
    <ul class="claims">
      <li><strong>国債整理基金が全体の半分（224.8兆円）</strong><span>国債の償還と利払いの会計です。FY2017 の 196.6兆円から +28.2兆円。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>年金 +13.4兆円、子ども・子育て支援が新設（FY2025、5.8兆円）</strong><span>年金特別会計の 102.9兆円のうち 26.3兆円は、勘定の間の繰入（基礎年金勘定への繰入など）です。これを除くと、66.9兆円 → 76.7兆円（+9.8兆円）です。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
      <li><strong>減ったのは、東日本大震災復興（2.7 → 0.6兆円）と交付税及び譲与税配付金（52.1 → 51.1兆円）</strong><span>交付税特会の地方交付税交付金そのものは 16.7兆円 → 20.2兆円に増えています。減ったのは、国債整理基金への繰入（32.7 → 26.8兆円）です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>お金の通り道</h2>
    <p>名前で見つけた繰入のうち、大きいもの（FY2017 か FY2026 に 0.3兆円以上）です。行き先の多くは国債整理基金です。</p>
    <div class="panel scroll"><table id="flows"></table></div>
    <p class="small">「年金 → 年金」「労働保険 → 労働保険」などは、同じ特別会計の勘定の間の繰入です。</p>
  </section>

  <section>
    <h2>国債整理基金: 償還と利子を分けると</h2>
    <p>国債整理基金の支出は、目の単位で「債務償還費」と「利子及割引料」に分かれています。一般会計の国債費（繰入の 1 本）では見えなかった内訳です。</p>
    <div class="pair" id="debt"></div>
    <ul class="claims">
      <li><strong>利子は 10.9兆円 → 16.6兆円（+5.7兆円）</strong><span>FY2020〜FY2023 は 10兆円前後で横ばいでした。FY2024 から 11.6、12.9、16.6兆円と増えています。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>償還は 200兆円前後。その多くは借り換え（推測）</strong><span>国債整理基金への繰入は、一般会計・交付税特会・エネルギー特会などから計 88.0兆円です（FY2026）。償還と利子の 224.5兆円との差は、借換債など国債整理基金自身の収入で賄うと推測します。歳入のデータが無いので、借り換えの額は確かめられません。</span><span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>FY2021 の山（493.7兆円）は、2 つの特別会計</h2>
    <div class="panel scroll"><table id="y21"></table></div>
    <ul class="claims">
      <li><strong>国債整理基金 +53.8兆円は、債務償還費</strong><span>債務償還費が 182.8兆円 → 236.5兆円。利子は 10.0 → 10.2兆円で、ほとんど変わっていません。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>財政投融資 +47.5兆円は、財政融資資金への繰入と国債整理基金への繰入</strong><span>財政融資資金への繰入が 12.0兆円 → 45.0兆円、国債整理基金への繰入が 12.1 → 26.6兆円。財政融資資金への繰入は「資金」への繰入なので、試算純計では除いていません。新型コロナ対策の財政融資が背景にあると推測しますが、このデータには理由が書かれていません。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
      <li><strong>FY2023 の防衛財源</strong><span>FY2023 は、外国為替資金特会（1.20兆円）と財政投融資特会（0.64兆円）から、一般会計へ「防衛力強化」の繰入がありました。特別会計 → 一般会計の繰入が目立つのは、この年だけです。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>全年度の表（兆円）</h2>
    <details>
      <summary>特別会計 14 会計の推移と、純計の試算の内訳を開く</summary>
      <div class="scroll" style="margin-top:12px"><table id="tbl"></table></div>
    </details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の予算書（項・目の表）。一般会計と特別会計の当初予算（政府案）。FY2025 は国会提出時の版。FY2017〜FY2021 は、提出時か成立後かを判定できていません。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が項・目の行を抽出・構造化したもの。特別会計の目の合計は、全年度で項の合計と一致しました。</li>
      <li><span class="tag ai"></span>繰入の見つけ方: 目の名前に「繰入」を含み、「〇〇特別会計」「一般会計」「〇〇勘定」へと読めるものを、会計の間の繰入として除きました。「財政融資資金へ繰入」「防衛力強化のための資金へ繰入」「育児休業給付資金へ繰入」など、資金への繰入は除いていません（FY2026 は計 13.2兆円）。</li>
      <li><span class="tag ai"></span>「試算純計」は、単純合計から名前で見つけた繰入を引いただけの値です。国債整理基金の借り換えの分、名前に「繰入」の無い会計間の受け渡し、歳入の側は扱っていません。政府が公表する特別会計の歳出純計とは、作り方が違い、照合していません。</li>
      <li>特別会計は、補正予算・決算を含めていません。会計ごとに数え、所管（府省）では分けていません（複数の府省が所管する会計があるため）。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>国債の利子は、FY2024 から急に増えています。金利の影響なのか、残高の影響なのか、決算の利子の額でも追いますか。</li>
      <li>年金特別会計と子ども・子育て支援特別会計の、勘定ごとのお金の流れを見たいですか。</li>
      <li>FY2021 の財政投融資の 45兆円が、決算でどう使われたかを追いますか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（2026-11-03）。数値の単位は兆円（円単位の値から計算し、表示で丸め）。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y, I = Y.length - 1;
const tri = v => v / 10000; // 億円 → 兆円
const f = (v, d = 1) => v === null || v === undefined ? '—' : tri(v).toFixed(d);
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(tri(v)).toFixed(d);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 270) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const N = D.net[I];
document.getElementById('hSp').textContent = `${f(D.sp[I])}兆円`;
document.getElementById('hSpS').textContent = `一般会計 ${f(D.gen[I])}兆円の ${(D.sp[I] / D.gen[I]).toFixed(1)} 倍`;
document.getElementById('hGross').textContent = `${f(N.gross)}兆円`;
document.getElementById('hNet').textContent = `${f(N.net)}兆円`;
document.getElementById('hNetS').textContent = `除いた繰入 ${f(N.ded)}兆円`;
document.getElementById('dupLead').textContent = `一般会計と特別会計を足すと ${f(N.gross)}兆円（FY2026）。このうち ${f(N.ded)}兆円（${(N.ded / N.gross * 100).toFixed(0)}%）は、会計の間の繰入として、目の名前で見つけたものです。内訳は、一般会計 → 特別会計 ${f(N.g2s)}兆円、特別会計 → 他の会計 ${f(N.s2s + N.s2g)}兆円、同じ特別会計の勘定の間 ${f(N.intra)}兆円。`;

// 単純合計の積み上げ
(() => {
  const s = document.getElementById('stack'), W = 680, H = 300, L = 44, R = 12, T = 14, B = 26;
  const max = 650000, cw = (W - L - R) / Y.length, bw = cw * 0.62, y = v => T + (H - T - B) * (1 - v / max);
  const g = el('g', { class: 'grid' }, s);
  for (let v = 0; v <= 600; v += 100) { el('line', { x1: L, x2: W - R, y1: y(v * 1e4), y2: y(v * 1e4) }, g); el('text', { x: L - 6, y: y(v * 1e4) + 4, 'text-anchor': 'end' }, s).textContent = v; }
  el('text', { x: 4, y: 10 }, s).textContent = '兆円';
  D.net.forEach((n, i) => {
    const x = L + cw * i + (cw - bw) / 2; let base = 0;
    for (const [k, c] of [['net', 'var(--net)'], ['g2s', 'var(--x1)'], ['s2x', 'var(--x2)'], ['intra', 'var(--x3)']]) {
      const v = k === 's2x' ? n.s2s + n.s2g : n[k]; const y0 = y(base), y1 = y(base + v);
      el('rect', { x, y: y1 + (base ? 1 : 0), width: bw, height: Math.max(0, y0 - y1 - (base ? 1 : 0)), fill: c, rx: k === 'intra' ? 3 : 0 }, s); base += v;
    }
    el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, s).textContent = String(Y[i]).slice(2);
    if (i === 0 || i === 4 || i === I) el('text', { x: x + bw / 2, y: y(n.gross) - 5, 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = f(n.gross, 0);
    const hit = el('rect', { x: L + cw * i, y: T, width: cw, height: H - T - B, fill: 'transparent' }, s);
    hover(hit, `<b>FY${Y[i]}</b><br>単純合計 ${f(n.gross)}兆円<br>試算純計 ${f(n.net)}兆円<br>一般→特別 ${f(n.g2s)}兆円<br>特別→他の会計 ${f(n.s2s + n.s2g)}兆円<br>勘定の間 ${f(n.intra)}兆円<br>（除かなかった資金への繰入 ${f(n.other)}兆円）`);
  });
})();

// 会計ごと
(() => {
  const rows = [...D.acc].sort((a, b) => (b.v[I] ?? 0) - (a.v[I] ?? 0));
  const s = document.getElementById('acc'), W = 680, rowH = 26, T = 6, L = 170, R = 120, H = T + rows.length * rowH + 6;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const max = Math.max(...rows.map(r => r.v[I] ?? 0)), x = v => L + (W - L - R) * v / max;
  rows.forEach((r, i) => {
    const y = T + i * rowH, v = r.v[I] ?? 0, d = (r.v[I] ?? 0) - (r.v[0] ?? 0);
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n;
    el('rect', { x: L, y: y + 6, width: Math.max(2, x(v) - L), height: rowH - 10, rx: 3, fill: 'var(--x1)' }, s);
    el('text', { x: x(v) + 6, y: y + 17, class: 'val lbl' }, s).textContent = f(v);
    const t = el('text', { x: W - 4, y: y + 17, 'text-anchor': 'end', class: 'val' }, s); t.textContent = r.v[0] === null ? '新設' : sgn(d); t.style.fill = d > 0 ? 'var(--up)' : d < 0 ? 'var(--down)' : 'var(--muted)';
    const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s);
    hover(hit, `<b>${r.n}特別会計</b><br>` + Y.map((yy, j) => `FY${yy}: ${f(r.v[j], 2)}兆円`).join('<br>'));
  });
})();

// 通り道の表
(() => {
  const rows = [...D.flows].sort((a, b) => (b.v[I] ?? 0) - (a.v[I] ?? 0)); const max = Math.max(...rows.map(r => r.v[I] ?? 0));
  document.getElementById('flows').innerHTML = `<thead><tr><th>繰入（出す側 → 受ける側）</th><th>FY2017</th><th>FY2021</th><th>FY2026</th><th></th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r.k.replace('→', ' → ')}</td><td>${f(r.v[0], 2)}</td><td>${f(r.v[4], 2)}</td><td>${f(r.v[I], 2)}</td><td style="text-align:left"><span class="bar" style="width:${Math.round(120 * (r.v[I] ?? 0) / max)}px"></span></td></tr>`).join('') + '</tbody>';
})();

// 国債整理基金
(() => {
  const host = document.getElementById('debt');
  for (const [k, name] of [['償還', '債務償還費'], ['利子', '利子及割引料']]) {
    const v = D.debt[k], d = v[I] - v[0];
    const box = document.createElement('div'); box.className = 'mini';
    box.innerHTML = `<span class="name">${name}</span><span class="delta num ${d >= 0 ? 'up' : 'down'}">${f(v[0])} → ${f(v[I])}兆円（${sgn(d)}）</span>`;
    const W = 300, H = 110, P = 10, lo = 0, hi = Math.max(...v) * 1.1;
    const x = i => P + (W - 2 * P) * i / I, y = t => P + (H - 2 * P - 14) * (1 - (t - lo) / (hi - lo));
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${name}の推移` });
    el('line', { x1: P, x2: W - P, y1: y(0), y2: y(0), stroke: 'var(--line)' }, s);
    el('polyline', { points: v.map((t, i) => `${x(i)},${y(t)}`).join(' '), fill: 'none', stroke: 'var(--up)', 'stroke-width': 2 }, s);
    v.forEach((t, i) => { el('circle', { cx: x(i), cy: y(t), r: i === I ? 3.5 : 2.5, fill: 'var(--up)' }, s); const h = el('circle', { cx: x(i), cy: y(t), r: 10, fill: 'transparent' }, s); hover(h, `${name} FY${Y[i]}: ${f(t, 2)}兆円`); });
    for (const i of [0, 4, I]) el('text', { x: x(i), y: H - 2, 'text-anchor': i === 0 ? 'start' : i === I ? 'end' : 'middle' }, s).textContent = Y[i];
    box.appendChild(s); host.appendChild(box);
  }
})();

// FY2021 の表
(() => {
  const j = Y.indexOf(2020), k = Y.indexOf(2021);
  const rows = D.acc.map(r => ({ n: r.n, a: r.v[j], b: r.v[k], d: (r.v[k] ?? 0) - (r.v[j] ?? 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);
  document.getElementById('y21').innerHTML = `<thead><tr><th>特別会計</th><th>FY2020</th><th>FY2021</th><th>増減</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r.n}</td><td>${f(r.a)}</td><td>${f(r.b)}</td><td class="${r.d >= 0 ? 'up' : 'down'}">${sgn(r.d)}</td></tr>`).join('') +
    `<tr><td><b>特別会計の合計</b></td><td><b>${f(D.sp[j])}</b></td><td><b>${f(D.sp[k])}</b></td><td class="up"><b>${sgn(D.sp[k] - D.sp[j])}</b></td></tr></tbody>`;
})();

// 全年度の表
(() => {
  const head = `<thead><tr><th></th>${Y.map(y => `<th>FY${y}</th>`).join('')}</tr></thead>`;
  const row = (n, v, b) => `<tr><td>${b ? `<b>${n}</b>` : n}</td>${v.map(x => `<td>${b ? `<b>${f(x)}</b>` : f(x)}</td>`).join('')}</tr>`;
  const acc = [...D.acc].sort((a, b) => (b.v[I] ?? 0) - (a.v[I] ?? 0)).map(r => row(r.n, r.v)).join('');
  const net = [['一般会計', D.gen], ['特別会計', D.sp], ['単純合計', D.net.map(n => n.gross)], ['除いた繰入: 一般→特別', D.net.map(n => n.g2s)], ['除いた繰入: 特別→他の会計', D.net.map(n => n.s2s + n.s2g)], ['除いた繰入: 勘定の間', D.net.map(n => n.intra)], ['除かなかった資金への繰入', D.net.map(n => n.other)]].map(([n, v]) => row(n, v)).join('') + row('試算純計', D.net.map(n => n.net), true);
  document.getElementById('tbl').innerHTML = head + '<tbody>' + acc + `<tr><td colspan="${Y.length + 1}"></td></tr>` + net + '</tbody>';
})();
</script>
'''
open('index.html','w',encoding='utf-8').write(html.replace('__DATA__',data))
open('preview.html','w',encoding='utf-8').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html.replace('__DATA__',data)+'</body></html>')
