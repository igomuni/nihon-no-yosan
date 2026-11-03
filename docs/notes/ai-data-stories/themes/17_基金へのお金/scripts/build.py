import json
data=open('page-data.json').read()
html=r'''<title>基金へのお金</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。区分は 3 つ: 基金 = 藍、出資金 = 朱、資金への繰入 = 灰緑。補正の分は斜線 */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --ink: #18202b; --muted: #5b6573; --line: #d9dee5; --tag: #eef1f5;
  --fund: #2a6fc9; --invest: #d2542a; --reserve: #4f8a7a; --zero: #9aa3ae;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440; --tag: #232b36;
  --fund: #5b9cf0; --invest: #f07a50; --reserve: #6fb3a0; --zero: #6b7582; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440; --tag: #232b36;
  --fund: #5b9cf0; --invest: #f07a50; --reserve: #6fb3a0; --zero: #6b7582; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.8;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 52px; }
h1, h2 { font-family: var(--display); text-wrap: balance; line-height: 1.35; margin: 0; }
h1 { font-size: clamp(28px, 6vw, 40px); font-weight: 900; }
h2 { font-size: 22px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
section { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.kpi b { font-family: var(--display); font-size: 24px; font-variant-numeric: tabular-nums; }
.kpi span { font-size: 12px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.chart .val { font-variant-numeric: tabular-nums; }
.grid line { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--muted); }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.claims { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.claims li { display: grid; gap: 4px; }
.note { font-size: 13px; color: var(--muted); }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th.l, td.l { text-align: left; }
td.name { text-align: left; white-space: normal; min-width: 14em; }
thead th { color: var(--muted); font-weight: 400; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--fund); outline-offset: 2px; }
.cls { display: inline-block; font-size: 10px; padding: 0 6px; border-radius: 4px; color: #fff; margin-right: 4px; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 280px; z-index: 5; }
</style>

<main>
  <header style="display:flex;flex-direction:column;gap:10px">
    <span class="eyebrow">一般会計・当初予算と補正予算 FY2017 → FY2026</span>
    <h1>基金・出資・資金へのお金は、どこから、どこへ出ているか</h1>
    <p>予算書の目の名前で「基金」「出資金」「資金へ繰入」と判定できるお金を、10 年分足しました。名前に出ないものは数えていません（下で、その大きさも示します）。</p>
    <div class="kpis" id="kpis"></div>
  </header>

  <section>
    <h2>8 割は補正予算から</h2>
    <p id="leadYear"></p>
    <div class="panel scroll"><svg class="chart" id="yearChart" role="img" aria-label="年度ごとの、区分別の当初と補正"></svg></div>
    <div class="legend"><span><i class="sw" style="background:var(--fund)"></i>基金</span><span><i class="sw" style="background:var(--invest)"></i>出資金</span><span><i class="sw" style="background:var(--reserve)"></i>資金への繰入</span><span>濃い = 当初、斜線 = 補正</span></div>
    <p class="note">補正は「補正後 − 当初」（目ごと）。FY2026 は補正第1号だけで、この 3 区分の目はありません。</p>
  </section>

  <section>
    <h2>基金だけを見ると</h2>
    <p id="leadFund"></p>
    <div class="panel scroll"><svg class="chart" id="fundChart" role="img" aria-label="基金の当初と補正"></svg></div>
    <ul class="claims">
      <li><strong>当初で毎年積むのは、科研費の基金</strong><span>学術研究助成基金補助金（科学研究費助成事業）は、10 年とも当初予算にあり、計 1.18兆円です。当初の基金の 8 割に当たります。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>補正で積む研究開発の基金</strong><span>革新的研究開発推進基金補助金（1.35兆円）、宇宙開発支援基金補助金（0.80兆円、FY2023〜）、創発的研究推進基金補助金（0.33兆円）など。どれも、ほぼ補正だけで積まれています。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>FY2020 の保証の基金</strong><span>経営安定関連保証等基金補助金は、FY2020 の補正で 1.25兆円です。中小企業の資金繰りの保証に関わる基金と、名前から推測します。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>どの府省・どの経費から</h2>
    <div class="panel scroll"><svg class="chart" id="groupChart" role="img" aria-label="府省別の 10 年の計"></svg></div>
    <div class="panel scroll"><svg class="chart" id="majorChart" role="img" aria-label="主要経費別の 10 年の計"></svg></div>
    <ul class="claims">
      <li><strong>財務省の 15.7兆円の多くは、日本政策金融公庫への出資</strong><span>株式会社日本政策金融公庫出資金は、10 年で 11.3兆円（うち補正 10.8兆円）。FY2020 の補正だけで、財務省 8.16兆円・経済産業省 2.08兆円です。防衛力強化のための資金への繰入（FY2023 の当初 3.38兆円と補正）も財務省です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>経済産業省は、ほぼ全額が補正</strong><span>当初 0.03兆円に対し、補正 6.77兆円。中小企業対策費（出資と保証の基金）と、研究開発の基金です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>文部科学省は、当初と補正の両方</strong><span>当初 1.24兆円（うち 1.18兆円が科研費の基金）、補正 3.50兆円（科学技術振興機構への出資、宇宙・研究開発の基金）。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>名前では判定できないお金</h2>
    <p id="leadCand"></p>
    <div class="panel scroll"><svg class="chart" id="candChart" role="img" aria-label="補正で初めて出る大型の補助金・交付金"></svg></div>
    <p class="note">当初予算に無く（政府案が無いか 0）、補正で 0.1兆円以上が足された、名前が「〜補助金」「〜交付金」で終わる目。基金と判定した目は除いています。</p>
    <ul class="claims" id="candClaims"></ul>
  </section>

  <section>
    <h2>行政事業レビューで、どこまで分かるか</h2>
    <ul class="claims">
      <li><strong>当初予算の額は、予算書と一致する</strong><span id="rsMatch"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>補正の額は、一部しか分からない</strong><span id="rsSupp"></span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>基金を受け取る法人</strong><span>基金系の目に結ぶ事業（FY2024・FY2025）の、国が直接払った先（法人番号のある法人）です。額は事業単位で、基金に積んだ額とは限りません。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
    <div class="panel scroll"><svg class="chart" id="recipChart" role="img" aria-label="基金系の事業の支出先"></svg></div>
    <p class="note" id="rsNames"></p>
  </section>

  <section>
    <h2>目ごとの表（億円）</h2>
    <details>
      <summary>基金・出資金・資金への繰入の 48 の目を開く</summary>
      <div class="scroll" style="margin-top:12px"><table id="tbl"></table></div>
    </details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の予算書（目の表）。一般会計の当初予算（FY2025 は国会提出時の版）と補正予算（補正後の額。年度に複数回あるときは、目が個別の行で載る最後の回）。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が抽出・構造化した目のデータ。概算要求書にだけある目は除きました。</li>
      <li><span class="tag ai"></span>判定の規則（目名）: 「特別会計へ繰入」「運営費交付金」「分担金」「拠出金」「給付費負担金」「事務局」「国際交流基金」「年金基金」を含むものは除く。そのうえで「基金」または「造成費補助金・交付金」を含む → 基金、「出資金」を含む → 出資金、「資金へ繰入」を含む → 資金への繰入。国債整理基金特別会計への繰入や、国際交流基金・年金基金のように組織名に「基金」が入るものは数えません。</li>
      <li><span class="tag ai"></span>補正 = 補正後 − 当初（目ごと）。補正の表で「外N目」にまとめられ、個別の行が無い目は、補正の値なし（足していません）。この 3 区分で、そうした目は 118 件（補正の額は 0 と推測。確かめていない）。</li>
      <li>検算: 予算書の目の CSV を直接読み、同じ規則で当初と「全ての回の補正差引額の和」を足しました。10 年度・3 区分とも、上の値と一致しました（差は最大 0.001兆円で、丸めによる）。RS の当初予算の額とも一致します（上の節）。</li>
      <li>出資金は、基金とは性質が違います（政策金融機関・独立行政法人の資本）。この LP では、法人に積むお金として並べて示しています。</li>
      <li>未確認: 基金に積んだお金が、その後いつ・どれだけ使われたか（基金の残高・執行はこのデータに無い）。名前に基金が無い補助金のうち、基金に積まれた額。特別会計からの基金。決算の額との照合。政府が公表する基金の一覧との照合。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>補正で積む研究開発の基金（1.35兆円・0.80兆円など）は、決算でどう見えるか、追いますか。</li>
      <li>名前に基金の無い大型の補助金（エネルギー価格対策、半導体・人工知能など）のうち、基金に回った額を、行政事業レビューの支出先の段からどこまで分けられるか、調べますか。</li>
      <li>日本政策金融公庫への出資（FY2020 の補正で 10.4兆円）は、財政投融資と並べて見ると、コロナ期の資金繰り支援の全体像になりそうです。どちらを先に見たいですか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」、行政事業レビュー見える化サイト（https://rssystem.go.jp）を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（ループ 4 回目）。金額は千円・円の値から計算し、表示で丸めています。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y;
const CL = { fund: ['基金', 'var(--fund)'], invest: ['出資金', 'var(--invest)'], reserve: ['資金への繰入', 'var(--reserve)'] };
const fmt = v => v === null || v === undefined ? '—' : Math.abs(v) >= 10000 ? (v / 10000).toFixed(2) + '兆円' : v.toLocaleString('ja-JP') + '億円';
const tri = v => (v / 10000).toFixed(2);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 290) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
function hatchDefs(svg) {
  const defs = el('defs', {}, svg);
  for (const k of Object.keys(CL)) { const p = el('pattern', { id: 'h-' + svg.id + '-' + k, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs); el('rect', { width: 6, height: 6, fill: CL[k][1], opacity: .25 }, p); el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: CL[k][1], 'stroke-width': 3 }, p); }
}
const niceStep = max => { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p; return 10 * p; };

// 合計
const sum = k => D.year.reduce((s, r) => s + r[k], 0);
const T = { fB: sum('fundB'), fS: sum('fundS'), iB: sum('investB'), iS: sum('investS'), rB: sum('reserveB'), rS: sum('reserveS') };
const all = T.fB + T.fS + T.iB + T.iS + T.rB + T.rS, supp = T.fS + T.iS + T.rS;
document.getElementById('kpis').innerHTML = [
  [fmt(all), '10 年の計（3 区分）'], [`${Math.round(supp / all * 100)}%`, 'そのうち補正予算の分'], [fmt(T.fB + T.fS), '基金（当初 ' + fmt(T.fB) + '）'], [fmt(T.iB + T.iS), '出資金（当初 ' + fmt(T.iB) + '）'], [fmt(T.rB + T.rS), '資金への繰入']
].map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join('');
const y20 = D.year.find(r => r.y === 2020);
document.getElementById('leadYear').textContent = `10 年で ${fmt(all)}のうち、${fmt(supp)}（${Math.round(supp / all * 100)}%）が補正予算から出ています。FY2020 は ${fmt(y20.fundB + y20.fundS + y20.investB + y20.investS)}で、その大半は日本政策金融公庫などへの出資（補正 ${fmt(y20.investS)}）です。FY2023 は防衛力強化のための資金への繰入（当初 3.38兆円）が加わります。`;

// 年度の積み上げ（区分 × 当初・補正）
function stackChart(id, keys, H = 280) {
  const s = document.getElementById(id), W = 680, L = 52, R = 12, Tp = 22, B = 26; s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px'; hatchDefs(s);
  const tot = r => keys.reduce((a, k) => a + Math.max(0, r[k + 'B']) + Math.max(0, r[k + 'S']), 0);
  const max = Math.max(...D.year.map(tot)), step = niceStep(max), top = Math.ceil(max / step) * step;
  const y = v => Tp + (H - Tp - B) * (1 - v / top), cw = (W - L - R) / Y.length, bw = cw * 0.6;
  const g = el('g', { class: 'grid' }, s);
  for (let v = 0; v <= top + 1e-9; v += step) { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = v >= 10000 || step >= 10000 ? (v / 10000).toFixed(step >= 10000 ? 0 : 1) : (v / 10000).toFixed(2); }
  el('text', { x: 4, y: 12 }, s).textContent = '兆円';
  D.year.forEach((r, i) => {
    const x = L + cw * i + (cw - bw) / 2; let base = 0;
    for (const k of keys) for (const part of ['B', 'S']) {
      const v = Math.max(0, r[k + part]); if (!v) continue;
      el('rect', { x, y: y(base + v), width: bw, height: Math.max(0.5, y(base) - y(base + v)), fill: part === 'B' ? CL[k][1] : `url(#h-${id}-${k})` }, s); base += v;
    }
    el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, s).textContent = String(r.y).slice(2);
    if (base > 0) el('text', { x: x + bw / 2, y: Math.max(Tp - 4, y(base) - 5), 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = tri(base);
    hover(el('rect', { x: L + cw * i, y: Tp, width: cw, height: H - Tp - B, fill: 'transparent' }, s), `<b>FY${r.y}</b><br>` + keys.map(k => `${CL[k][0]}: 当初 ${fmt(r[k + 'B'])} / 補正 ${fmt(r[k + 'S'])}`).join('<br>'));
  });
}
stackChart('yearChart', ['fund', 'invest', 'reserve']);
stackChart('fundChart', ['fund'], 230);
document.getElementById('leadFund').textContent = `基金は 10 年で ${fmt(T.fB + T.fS)}。当初は毎年 0.1〜0.2兆円で、補正で ${fmt(T.fS)}が積まれました。補正の多い年は FY2020（${fmt(y20.fundS)}）と FY2022（${fmt(D.year.find(r => r.y === 2022).fundS)}）です。`;

// 横の積み上げ（当初・補正）
function hbar(id, rows, Lw) {
  const s = document.getElementById(id), W = 680, rowH = 26, Tp = 24, L = Lw, R = 80, H = Tp + rows.length * rowH + 6; s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const max = Math.max(...rows.map(r => r.B + r.S)), x = v => L + (W - L - R) * v / max;
  el('rect', { x: L, y: 6, width: 10, height: 10, fill: 'var(--ink)', opacity: .85 }, s); el('text', { x: L + 14, y: 15 }, s).textContent = '当初';
  el('rect', { x: L + 60, y: 6, width: 10, height: 10, fill: 'var(--ink)', opacity: .3 }, s); el('text', { x: L + 74, y: 15 }, s).textContent = '補正';
  rows.forEach((r, i) => {
    const y = Tp + i * rowH;
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n.length > 12 ? r.n.slice(0, 12) + '…' : r.n;
    el('rect', { x: L, y: y + 6, width: Math.max(r.B ? 1 : 0, x(r.B) - L), height: rowH - 10, fill: 'var(--ink)', opacity: .85 }, s);
    el('rect', { x: x(r.B), y: y + 6, width: Math.max(r.S ? 1 : 0, x(r.B + r.S) - x(r.B)), height: rowH - 10, fill: 'var(--ink)', opacity: .3 }, s);
    el('text', { x: x(r.B + r.S) + 6, y: y + 17, class: 'val' }, s).textContent = fmt(r.B + r.S);
    hover(el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s), `<b>${r.n}</b><br>当初 ${fmt(r.B)} / 補正 ${fmt(r.S)}<br>基金 ${fmt(r.fund)}・出資金 ${fmt(r.invest)}・資金への繰入 ${fmt(r.reserve)}`);
  });
}
hbar('groupChart', D.group.filter(r => r.B + r.S >= 100), 110);
hbar('majorChart', D.major.filter(r => r.B + r.S >= 100), 150);

// 判定できない候補
const C = D.cand;
document.getElementById('leadCand').textContent = `当初予算に無く、補正で初めて大きく足された補助金・交付金は、10 年で ${C.n} の目・${fmt(C.sum)}あります。特別定額給付金や臨時交付金のように基金ではないものが多いですが、一部は基金に積まれた可能性があり、名前からは判定できません。`;
(() => {
  const s = document.getElementById('candChart'), W = 680, H = 220, L = 52, R = 12, Tp = 22, B = 26; s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const vals = Y.map(y => C.byYear[y]?.s ?? 0), max = Math.max(...vals), step = niceStep(max), top = Math.ceil(max / step) * step;
  const y = v => Tp + (H - Tp - B) * (1 - v / top), cw = (W - L - R) / Y.length, bw = cw * 0.6;
  const g = el('g', { class: 'grid' }, s);
  for (let v = 0; v <= top + 1e-9; v += step) { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = (v / 10000).toFixed(0); }
  el('text', { x: 4, y: 12 }, s).textContent = '兆円';
  Y.forEach((yr, i) => { const v = vals[i], x = L + cw * i + (cw - bw) / 2; el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, s).textContent = String(yr).slice(2);
    if (!v) return; el('rect', { x, y: y(v), width: bw, height: y(0) - y(v), fill: 'var(--zero)' }, s); el('text', { x: x + bw / 2, y: Math.max(Tp - 4, y(v) - 5), 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = tri(v);
    hover(el('rect', { x: L + cw * i, y: Tp, width: cw, height: H - Tp - B, fill: 'transparent' }, s), `<b>FY${yr}</b><br>${C.byYear[yr].n} の目、${fmt(v)}<br>` + C.top.filter(t => t.y === yr).slice(0, 4).map(t => `${t.n} ${fmt(t.s)}`).join('<br>')); });
})();
document.getElementById('candClaims').innerHTML = `<li><strong>行政事業レビューで「基金」の記載が見つかったもの: ${C.ev.length} の目、${fmt(C.ev.reduce((a, x) => a + x.s, 0))}</strong><span>${C.ev.map(x => `FY${x.y} ${x.n}（${fmt(x.s)}。事業「${x.jig[0]}」の支出ブロック名か役割に「基金」）`).join('、')}。目の額の全部が基金に積まれたとは限りません。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
<li><strong>記載が無かったもの: ${C.noev.length} の目、${fmt(C.noev.reduce((a, x) => a + x.s, 0))}</strong><span>${C.noev.map(x => `FY${x.y} ${x.n}`).join('、')}。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
<li><strong>行政事業レビューに結べないもの: ${C.nolinkN} の目、${fmt(C.nolinkS)}</strong><span>RS の 2025 年度版は予算年度 2021〜2025 で、2021〜2023 年度は項・目の記載が少ない移行データです。FY2020 以前の目と、目の名前の記載が無い事業は結べません。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>`;

// RS
const RS = D.rs, gb = (k, a) => (RS.byCls[k] || {})[a] ?? null;
const yr = y => D.year.find(r => r.y === y);
document.getElementById('rsMatch').textContent = `基金系の目に結ぶ RS の明細の当初予算は、FY2024 が基金 ${fmt(gb('fund|2024', '当初予算'))}・出資金 ${fmt(gb('invest|2024', '当初予算'))}、FY2025 が基金 ${fmt(gb('fund|2025', '当初予算'))}・出資金 ${fmt(gb('invest|2025', '当初予算'))}。予算書の当初（基金 ${fmt(yr(2024).fundB)}・${fmt(yr(2025).fundB)}、出資金 ${fmt(yr(2024).investB)}・${fmt(yr(2025).investB)}）と、億円単位で一致しました。`;
document.getElementById('rsSupp').textContent = `第1次補正予算の行は、FY2025 の基金で ${fmt(gb('fund|2025', '第1次補正予算'))}（予算書は ${fmt(yr(2025).fundS)}）、FY2024 で ${fmt(gb('fund|2024', '第1次補正予算'))}（予算書は ${fmt(yr(2024).fundS)}）。RS の明細に項・目が書かれていない補正の行があるためと推測します。`;
document.getElementById('rsNames').textContent = `事業名に「基金」を含む RS の事業は ${RS.nameIds}、支出ブロック名か役割に「基金」がある事業は ${RS.blkIds}（重なりを除いて、基金系の目に結ぶ事業と合わせ ${RS.overlap.any}）。RS には「基金シート」の区分は入っていません（シート種別はすべてレビューシート）。`;
(() => {
  const rows = RS.recips, s = document.getElementById('recipChart'), W = 680, rowH = 26, Tp = 6, L = 230, R = 80, H = Tp + rows.length * rowH + 6; s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '560px';
  const max = Math.max(...rows.map(r => r.v)), x = v => L + (W - L - R) * v / max;
  rows.forEach((r, i) => { const y = Tp + i * rowH; const short = r.n.replace(/^(国立研究開発法人|独立行政法人|一般社団法人)/, '');
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = short.length > 17 ? short.slice(0, 17) + '…' : short;
    el('rect', { x: L, y: y + 6, width: Math.max(1, x(r.v) - L), height: rowH - 10, rx: 3, fill: 'var(--fund)' }, s);
    el('text', { x: x(r.v) + 6, y: y + 17, class: 'val' }, s).textContent = fmt(r.v);
    hover(el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s), `<b>${r.n}</b><br>${fmt(r.v)}（RS の支出先、FY2024 の執行）`); });
})();

// 表
document.getElementById('tbl').innerHTML = `<thead><tr><th class="l">目</th><th class="l">府省</th><th>当初計</th><th>補正計</th>${Y.map(y => `<th>FY${String(y).slice(2)}</th>`).join('')}</tr></thead><tbody>` +
  D.moku.map(r => `<tr><td class="name"><span class="cls" style="background:${CL[r.cls][1]}">${CL[r.cls][0]}</span>${r.n}</td><td class="l">${r.g}</td><td>${r.B.toLocaleString()}</td><td>${r.S.toLocaleString()}</td>${r.v.map(v => `<td>${v === null ? '—' : v.toLocaleString()}</td>`).join('')}</tr>`).join('') + '</tbody>';
</script>
'''
open('index.html','w').write(html.replace('__DATA__', data))
open('preview.html','w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html.replace('__DATA__', data)+'</body></html>')
print(len(html))
