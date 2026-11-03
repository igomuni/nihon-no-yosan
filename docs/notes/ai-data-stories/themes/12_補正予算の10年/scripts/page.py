import json
data=open('page-data.json').read()
html=r'''<title>補正予算の10年</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。年度の棒は、上に「足した額」、下に「減らした額」 */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --ink: #18202b; --muted: #5b6573; --line: #d9dee5; --tag: #eef1f5;
  --up: #d2542a; --down: #2a6fc9; --zero: #9aa3ae;
  --c-public: #2a78d6; --c-defense: #1f8f6a; --c-local: #8f6fe0; --c-reserve: #eda100; --c-debt: #5b6573; --c-covid: #d6457a; --c-rest: #b8c0cc;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440; --tag: #232b36;
  --up: #f07a50; --down: #5b9cf0; --zero: #6b7582;
  --c-public: #4a90e8; --c-defense: #36a882; --c-local: #a58bf0; --c-reserve: #e0a020; --c-debt: #8b95a3; --c-covid: #e06a95; --c-rest: #4a5462; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440; --tag: #232b36;
  --up: #f07a50; --down: #5b9cf0; --zero: #6b7582;
  --c-public: #4a90e8; --c-defense: #36a882; --c-local: #a58bf0; --c-reserve: #e0a020; --c-debt: #8b95a3; --c-covid: #e06a95; --c-rest: #4a5462; color-scheme: dark }
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
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tile .v { font-family: var(--display); font-weight: 900; font-size: 26px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tile .k { font-size: 12px; color: var(--muted); line-height: 1.5; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.chart .val { font-variant-numeric: tabular-nums; }
.grid line { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--muted); margin-top: 8px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.note { font-size: 13px; color: var(--muted); }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.claims { display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; list-style: none; }
.claims li { display: grid; gap: 4px; }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th.l, td.l { text-align: left; }
td.name { text-align: left; white-space: normal; min-width: 12em; }
thead th { color: var(--muted); font-weight: 400; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--down); outline-offset: 2px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.col { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.col ol { margin: 0; padding-left: 1.2em; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
.col li b { font-variant-numeric: tabular-nums; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 280px; z-index: 5; }
</style>

<main>
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="eyebrow">一般会計・補正予算 FY2017 → FY2026（FY2026 は第1号まで）</span>
    <h1>補正予算は、毎年なにに足されてきたか</h1>
    <p>当初予算のあとに国会で決める補正予算を、10 年分、事項と目の単位で足し上げました。上に足した額、下に減らした額を並べます。</p>
    <div class="tiles" id="tiles"></div>
  </header>

  <section>
    <h2>コロナで一桁変わり、そのあとも戻っていない</h2>
    <p id="leadYears"></p>
    <div class="panel scroll"><svg class="chart" id="allChart" role="img" aria-label="年度ごとの補正の追加と減少（全年度）"></svg><div class="legend" id="lg1"></div></div>
    <p class="note">棒の上は補正で足した額（追加額）、0 より下は減らした額（修正減少額）、数字は差し引き。年度に補正が 2〜3 回ある年は、全部の回を足しています。棒にカーソルを当てると内訳が出ます。</p>
  </section>

  <section>
    <h2>コロナ期を除いて、縮尺を変えて見る</h2>
    <div class="panel scroll"><svg class="chart" id="calmChart" role="img" aria-label="FY2020〜FY2022 を除いた年度の補正の追加と減少"></svg><div class="legend" id="lg2"></div></div>
    <ul class="claims">
      <li><strong>公共事業は毎年 1.0〜2.5兆円</strong><span id="pubText"></span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
      <li><strong>防衛関係費も毎年足されている</strong><span id="defText"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>コロナのあとも残った大きな補正</strong><span id="postText"></span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>減らされるのは、ほぼ毎年「国債の利払い」</h2>
    <p id="debtLead"></p>
    <div class="panel scroll"><svg class="chart" id="debtChart" role="img" aria-label="国債費の補正（利払いの減額と剰余金の繰入）"></svg>
      <div class="legend"><span><i style="background:var(--down)"></i>利払いの財源（減額）</span><span><i style="background:var(--up)"></i>決算上の剰余金の繰入（追加）</span><span><i style="background:var(--zero)"></i>その他の償還財源など</span></div></div>
    <ul class="claims">
      <li><strong>ほかに減らされたもの</strong><span id="otherRed"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>コロナ期（FY2020〜FY2022）に足された事項</h2>
    <p id="covidLead"></p>
    <div class="cols" id="covidCols"></div>
    <p class="note">事項は、予算書の補正の表の「事項」。複数の回に出る事項は、追加と減少を回ごとに足しています。</p>
  </section>

  <section>
    <h2>毎年のように足される経費</h2>
    <p>主要経費別の分類で、補正による差し引きの 10 年の動きです。「追加の年数」は、FY2017〜FY2025 の 9 年のうち追加額があった年数です。</p>
    <div class="panel scroll"><table id="majorTbl"></table></div>
    <details><summary>残りの経費</summary><div class="scroll" style="margin-top:12px"><table id="majorTbl2"></table></div></details>
  </section>

  <section>
    <h2>補正の回と、FY2026</h2>
    <div class="panel scroll"><table id="roundTbl"></table></div>
    <ul class="claims">
      <li><strong>FY2026 は、まだ第1号だけ</strong><span id="fy26"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>府省ごとに見ると</h2>
    <details><summary>府省別の補正の差し引き（上位 16、兆円）</summary><div class="scroll" style="margin-top:12px"><table id="groupTbl"></table></div></details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の一般会計の補正予算の表（項・事項・目）。各行の「補正要求追加額」「補正要求修正減少額」「補正要求差引額」を使いました。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が回ごとに抽出・構造化した CSV（第 2 回・第 3 回は別のファイル）。このサイトの画面は項ごとに最後の回の改予算額を使いますが、このページは追加・減少を回ごとに全部足しています。</li>
      <li><span class="tag proc"></span>検算: 年度ごとの差引額の合計は、項・事項・目の 3 つの表で千円まで一致しました。回をまたぐ項は、次の回の成立額が前の回の改予算額と全部一致しました。FY2017〜FY2024 は「当初予算＋差引額の合計」が、決算書の歳出予算額と千円まで一致しました（8 年で 176.28兆円）。</li>
      <li><span class="tag ai"></span>経費の色分け（公共事業 = 主要経費別 41〜47 と 49、地方交付税など = 31・32、予備費 = 93・94・96・98、中小企業・保健衛生 = 60・07）は、この探索で決めたまとめ方です。分類コードの名前は、その年度の補正のコード表（無い年度は決算・当初のコード表）から引きました。</li>
      <li><span class="tag ai"></span>「コロナ」「感染症」を名前に含む事項の額は、名前だけで数えた下限です。名前に含まない対策（給付金・中小企業支援など）は入りません。</li>
      <li>補正の理由・閣議決定の内容は、このデータにありません。科学技術振興費などの補正が基金への積み立てかどうかは確かめていません（推測しない）。FY2026 の第2号以降が今後あるかは未確認です。FY2017〜FY2021 の当初予算は、国会提出時か成立後かを判定できていません。特別会計の補正は含めていません。金額は名目です。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ul class="questions">
      <li>コロナ後も年 13〜18兆円の補正が続いています。この「新しい普通」の中身（物価高騰の臨時交付金、エネルギー価格対策、研究開発）を、事業の単位まで追いますか。</li>
      <li>毎年の公共事業の補正（1.0〜2.5兆円）は、決算で翌年度に繰り越される割合が高い経費です。補正の分がいつ使われたかを、繰越と合わせて見ますか。</li>
      <li>国債の利払いは、補正でほぼ毎年 1兆円前後減らされています。当初予算の見積もりの置き方と、実際の利払いを比べてみますか。</li>
    </ul>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（ループ 3 回目、2026-11-03）。単位は兆円（千円単位の値を億円に丸めて計算し、表示で丸め）。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y, YR = Object.fromEntries(D.years.map(r => [r.y, r]));
const tri = v => v / 10000; // 億円 → 兆円
const f = (v, d = 2) => v === null || v === undefined ? '—' : tri(v).toFixed(d);
const sgn = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(tri(v)).toFixed(d);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 290) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const CATS = D.cats, COLOR = k => `var(--c-${k})`;
const sum = a => a.reduce((s, v) => s + v, 0);
// 目盛り: データの範囲から、きりのよい間隔を選ぶ（兆円）
function niceStep(range) { const raw = range / 5; const p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p; return 10 * p; }

// タイル
(() => {
  const net = sum(D.years.map(r => r.net)), covid = sum([2020, 2021, 2022].map(y => YR[y].net));
  const pre = [2017, 2018, 2019].map(y => YR[y].net), post = [2023, 2024, 2025].map(y => YR[y].net);
  const tiles = [
    [`${f(net, 1)}兆円`, '10 年の補正の差し引き（追加 ' + f(sum(D.years.map(r => r.add)), 1) + '兆円、減少 ' + f(-sum(D.years.map(r => r.red)), 1) + '兆円）'],
    [`${f(covid, 1)}兆円`, `うち FY2020〜FY2022 の 3 年（${(covid / net * 100).toFixed(0)}%）`],
    [`${f(Math.min(...pre), 1)}〜${f(Math.max(...pre), 1)}兆円`, 'コロナ前（FY2017〜FY2019）の年の補正'],
    [`${f(Math.min(...post), 1)}〜${f(Math.max(...post), 1)}兆円`, 'コロナ後（FY2023〜FY2025）の年の補正'],
  ];
  document.getElementById('tiles').innerHTML = tiles.map(([v, k], i) => `<div class="tile"><span class="v${i === 1 ? ' up' : ''}">${v}</span><span class="k">${k}</span></div>`).join('');
  document.getElementById('leadYears').textContent = `補正の差し引きは、FY2019 まで年 ${f(Math.min(...pre), 1)}〜${f(Math.max(...pre), 1)}兆円でした。FY2020 は 3 回の補正で ${f(YR[2020].net, 1)}兆円（当初予算 102.7兆円の 7 割）、FY2021 は ${f(YR[2021].net, 1)}兆円、FY2022 は ${f(YR[2022].net, 1)}兆円です。FY2023〜FY2025 も ${f(Math.min(...post), 1)}〜${f(Math.max(...post), 1)}兆円で、コロナ前の 4〜5 倍の規模が続いています。`;
})();

// 年度の積み上げ（上 = 追加、下 = 減少）
function drawStack(id, lgId, years) {
  const s = document.getElementById(id), W = 680, H = 300, L = 46, R = 12, T = 22, B = 26;
  const ups = years.map(y => sum(CATS.map(([k]) => YR[y].catAdd[k]))), downs = years.map(y => sum(CATS.map(([k]) => YR[y].catRed[k])));
  const step = niceStep(tri(Math.max(...ups) - Math.min(0, ...downs)));
  const top = Math.ceil(tri(Math.max(...ups)) / step) * step, bot = Math.floor(tri(Math.min(0, ...downs)) / step) * step;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const y = v => T + (H - T - B) * (top - v) / (top - bot), cw = (W - L - R) / years.length, bw = Math.min(42, cw * 0.6);
  const g = el('g', { class: 'grid' }, s);
  for (let v = bot; v <= top + 1e-9; v += step) { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = +v.toFixed(2); }
  el('text', { x: 4, y: 12 }, s).textContent = '兆円';
  years.forEach((yy, i) => {
    const r = YR[yy], x = L + cw * i + (cw - bw) / 2; let up = 0, dn = 0;
    for (const [k] of CATS) {
      const a = tri(r.catAdd[k]); if (a > 0) { el('rect', { x, y: y(up + a), width: bw, height: Math.max(0.5, y(up) - y(up + a) - (up > 0 ? 1 : 0)), fill: COLOR(k) }, s); up += a; }
    }
    for (const [k] of CATS) {
      const a = tri(r.catRed[k]); if (a < 0) { el('rect', { x, y: y(dn) + (dn < 0 ? 1 : 0), width: bw, height: Math.max(0.5, y(dn + a) - y(dn) - (dn < 0 ? 1 : 0)), fill: COLOR(k), opacity: 0.75 }, s); dn += a; }
    }
    el('text', { x: x + bw / 2, y: Math.max(T - 6, y(up) - 6) + 0, 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = sgn(r.net, 1).replace('+', '');
    el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, s).textContent = String(yy).slice(2) + (yy === 2026 ? '*' : '');
    const hit = el('rect', { x: L + cw * i, y: T, width: cw, height: H - T - B, fill: 'transparent' }, s);
    hover(hit, `<b>FY${yy}</b>（補正 ${r.rounds.length} 回）<br>追加 ${f(r.add)} / 減少 ${f(r.red)} / 差引 ${sgn(r.net)}兆円<br>` + CATS.filter(([k]) => r.catAdd[k] || r.catRed[k]).map(([k, n]) => `${n}: +${f(r.catAdd[k])} / ${f(r.catRed[k])}`).join('<br>'));
  });
  el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: 'var(--zero)', 'stroke-width': 1 }, s);
  document.getElementById(lgId).innerHTML = CATS.map(([k, n]) => `<span><i style="background:${COLOR(k)}"></i>${n}</span>`).join('') + '<span>* FY2026 は第1号だけ</span>';
}
drawStack('allChart', 'lg1', Y);
drawStack('calmChart', 'lg2', Y.filter(y => y < 2020 || y > 2022));

// 文
(() => {
  const pub = Y.slice(0, 9).map(y => YR[y].catAdd.public), def = Y.slice(0, 9).map(y => YR[y].catAdd.defense);
  document.getElementById('pubText').textContent = `主要経費別の公共事業（道路・治山治水・社会資本総合整備・災害復旧など）への追加は、FY2017 の ${f(pub[0])}兆円から FY2025 の ${f(pub[8])}兆円まで、9 年とも毎年あります。減らされることはほぼありません（9 年の減少の計 ${f(sum(Y.map(y => YR[y].catRed.public)))}兆円）。`;
  document.getElementById('defText').textContent = `防衛関係費への追加は、FY2017〜FY2022 は年 ${f(Math.min(...def.slice(0, 6)))}〜${f(Math.max(...def.slice(0, 6)))}兆円、FY2023 は ${f(def[6])}兆円（うち財務省の所管の「防衛力強化のための資金へ繰入」1.04兆円）、FY2025 は ${f(def[8])}兆円（同じく資金への繰入 0.63兆円を含む）でした。`;
  const t = y => D.top[y].add.slice(0, 3).map(r => `${r.j.replace(/に必要な経費$/, '')}（${f(r.a)}兆円）`).join('、');
  document.getElementById('postText').textContent = `FY2023〜FY2025 の追加の上位は、FY2023: ${t(2023)}。FY2024: ${t(2024)}。FY2025: ${t(2025)}。物価高騰対応の臨時交付金とエネルギー価格対策が、毎年続いています。`;
})();

// 国債費
(() => {
  const ys = D.debt.filter(r => r.y <= 2025);
  const ints = ys.map(r => r.interest), surs = ys.map(r => r.surplus);
  document.getElementById('debtLead').textContent = `一般会計の補正の減少額（10 年で ${f(-sum(D.years.map(r => r.red)), 1)}兆円）のうち、${f(-sum(D.years.map(r => r.catRed.debt)), 1)}兆円が国債費です。中身は、利払いの財源の減額で、FY2017〜FY2025 の 9 年とも ${f(-Math.max(...ints))}〜${f(-Math.min(...ints))}兆円減らしています。一方で、前の年度の決算で出た剰余金を国債の償還に回す繰入（FY2019・FY2020 は無し）が、最大 ${f(Math.max(...surs))}兆円（FY2021）足されています。`;
  const s = document.getElementById('debtChart'), W = 680, H = 240, L = 46, R = 12, T = 20, B = 26;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const hi = Math.max(...ys.map(r => tri(r.surplus + Math.max(0, r.other)))), lo = Math.min(...ys.map(r => tri(r.interest + Math.min(0, r.other))));
  const step = niceStep(hi - lo), top = Math.ceil(hi / step) * step, bot = Math.floor(lo / step) * step;
  const y = v => T + (H - T - B) * (top - v) / (top - bot), cw = (W - L - R) / ys.length, bw = Math.min(30, cw * 0.32);
  const g = el('g', { class: 'grid' }, s);
  for (let v = bot; v <= top + 1e-9; v += step) { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = +v.toFixed(2); }
  el('text', { x: 4, y: 12 }, s).textContent = '兆円';
  ys.forEach((r, i) => {
    const cx = L + cw * i + cw / 2;
    const bar = (x, v, fill) => { const a = tri(v); if (!a) return; el('rect', { x, y: a > 0 ? y(a) : y(0), width: bw, height: Math.max(0.5, Math.abs(y(a) - y(0))), rx: 2, fill }, s); };
    bar(cx - bw - 1, r.interest + Math.min(0, r.other), 'var(--down)');
    bar(cx + 1, r.surplus, 'var(--up)');
    if (r.other > 0) el('rect', { x: cx + 1, y: y(tri(r.surplus + r.other)), width: bw, height: Math.max(0.5, y(tri(r.surplus)) - y(tri(r.surplus + r.other))), fill: 'var(--zero)' }, s);
    el('text', { x: cx - bw / 2 - 1, y: Math.min(H - B - 2, y(tri(r.interest + Math.min(0, r.other))) + 12), 'text-anchor': 'middle', class: 'val' }, s).textContent = f(r.interest + Math.min(0, r.other), 1);
    if (r.surplus + Math.max(0, r.other) > 0) el('text', { x: cx + bw / 2 + 1, y: y(tri(r.surplus + Math.max(0, r.other))) - 4, 'text-anchor': 'middle', class: 'val' }, s).textContent = f(r.surplus + Math.max(0, r.other), 1);
    el('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, s).textContent = String(r.y).slice(2);
    hover(el('rect', { x: L + cw * i, y: T, width: cw, height: H - T - B, fill: 'transparent' }, s), `<b>FY${r.y} 国債費の補正</b><br>利払いの財源 ${sgn(r.interest)}兆円<br>剰余金の繰入 ${sgn(r.surplus)}兆円<br>その他 ${sgn(r.other)}兆円`);
  });
  el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: 'var(--zero)', 'stroke-width': 1 }, s);
  // ほかの減少
  document.getElementById('otherRed').textContent = `予備費: FY2020 の第3回でコロナ予備費を ${f(-YR[2020].catRed.reserve)}兆円、FY2023 にコロナ等の予備費（その年は「原油価格・物価高騰対策及び賃上げ促進環境整備対応予備費」）を 2.00兆円、ウクライナ情勢経済緊急対応予備費を 0.50兆円減らしました。地方交付税交付金: FY2019 に ${f(-YR[2019].catRed.local)}兆円、FY2020 に ${f(-YR[2020].catRed.local)}兆円の減額があります（同じ年に追加もある）。それ以外の減少は、年 0.03〜0.39兆円の小さい額が多くの事項に分かれています（毎年 280〜360 の事項）。`;
})();

// コロナ期
(() => {
  const named = [2020, 2021, 2022].map(y => YR[y].covidNamed[0]);
  document.getElementById('covidLead').textContent = `3 年の追加は計 ${f(sum([2020, 2021, 2022].map(y => YR[y].add)), 1)}兆円。名前に「コロナ」「感染症」を含む事項だけで ${f(sum(named), 1)}兆円です。名前に含まない給付金・中小企業支援・政策金融などが、それ以上にあります。`;
  document.getElementById('covidCols').innerHTML = [2020, 2021, 2022].map(y => `<div class="col"><h3>FY${y}（補正 ${YR[y].rounds.length} 回、差引 ${f(YR[y].net, 1)}兆円）</h3><ol>${D.top[y].add.slice(0, 6).map(r => `<li>${r.j.replace(/に必要な経費$/, '')} <span class="note">${r.g}</span> <b>${f(r.a)}</b>${r.r ? ` <span class="note">（減 ${f(r.r)}）</span>` : ''}</li>`).join('')}</ol></div>`).join('');
})();

// 主要経費の表
(() => {
  const spark = r => {
    const vals = r.net.map(v => v ?? 0), mx = Math.max(...vals.map(Math.abs)) || 1, W = 120, H = 28, bw = W / vals.length;
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="年度ごとの差し引き">` + vals.map((v, i) => { const h = Math.max(v ? 1 : 0, Math.abs(v) / mx * (H / 2 - 1)); return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(v >= 0 ? H / 2 - h : H / 2).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${v >= 0 ? 'var(--up)' : 'var(--down)'}"><title>FY${Y[i]} ${sgn(v)}兆円</title></rect>`; }).join('') + `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--line)"/></svg>`;
  };
  const nm = r => (r.c in D.reserveNames && ['93', '94', '96'].includes(r.c)) ? `${r.n}<span class="note">（${Object.entries(D.reserveNames[r.c]).map(([y, n]) => `FY${y}: ${n}`).join('、')}）</span>` : r.n;
  const head = '<thead><tr><th class="l">主要経費別</th><th>追加の年数</th><th>10 年の追加</th><th>10 年の減少</th><th>うちコロナ期以外の追加</th><th class="l">FY2017〜FY2026 の差し引き</th></tr></thead>';
  const row = r => `<tr><td class="name">${nm(r)}</td><td>${r.yrs} / 9</td><td>${f(r.add)}</td><td>${f(r.red)}</td><td>${f(r.normal)}</td><td class="l">${spark(r)}</td></tr>`;
  const main = D.majors.filter(r => r.add >= 5000), rest = D.majors.filter(r => r.add < 5000);
  document.getElementById('majorTbl').innerHTML = head + '<tbody>' + main.map(row).join('') + '</tbody>';
  document.getElementById('majorTbl2').innerHTML = head + '<tbody>' + rest.map(row).join('') + '</tbody>';
})();

// 回の表と FY2026
(() => {
  const mx = Math.max(...D.years.map(r => r.rounds.length));
  document.getElementById('roundTbl').innerHTML = `<thead><tr><th class="l">年度</th>${Array.from({ length: mx }, (_, i) => `<th>第${i + 1}回</th>`).join('')}<th>追加</th><th>減少</th><th>差引</th></tr></thead><tbody>` +
    D.years.map(r => `<tr><td class="l">FY${r.y}</td>${Array.from({ length: mx }, (_, i) => `<td>${r.rounds[i] === undefined ? '' : sgn(r.rounds[i])}</td>`).join('')}<td>${f(r.add)}</td><td>${f(r.red)}</td><td>${sgn(r.net)}</td></tr>`).join('') + '</tbody>';
  const t = D.top[2026].add.map(r => `${r.j.replace(/に必要な経費$/, '')}（${f(r.a)}兆円）`).join('、');
  document.getElementById('fy26').textContent = `FY2026 の補正予算（第1号）は ${f(YR[2026].net)}兆円で、載っている項は 55 です。中身は ${t} だけでした。データを取り込んだ時点の資料で、第2号以降が出ていれば、取り込み直すと変わります。`;
})();

// 府省の表
(() => {
  document.getElementById('groupTbl').innerHTML = `<thead><tr><th class="l">府省</th>${Y.map(y => `<th>FY${y}</th>`).join('')}<th>計</th></tr></thead><tbody>` +
    D.groups.map(r => `<tr><td class="l">${r.g}</td>${r.net.map(v => `<td>${v === null ? '' : f(v)}</td>`).join('')}<td><b>${f(r.sum)}</b></td></tr>`).join('') + '</tbody>';
})();
</script>
'''
open('index.html','w').write(html.replace('__DATA__', data))
open('preview.html','w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html.replace('__DATA__', data)+'</body></html>')
print(len(html))
