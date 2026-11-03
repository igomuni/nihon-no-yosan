data = open('page-data.json').read()
html = r'''<title>使い切れない予算</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。支出 = 墨、繰越 = 藍、不用 = 朱。「続く」は濃く、「偏る」は斜線 */
:root {
  --bg: #f5f7f8; --surface: #ffffff; --ink: #18202b; --muted: #5b6573; --line: #d9dee5;
  --spent: #8d97a5; --carry: #2a6fc9; --carry2: #9dbbe6; --unused: #d2542a; --unused2: #efb197; --tag: #eef1f5;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --spent: #6b7582; --carry: #5b9cf0; --carry2: #2f4f7d; --unused: #f07a50; --unused2: #7a3f2b; --tag: #232b36; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --spent: #6b7582; --carry: #5b9cf0; --carry2: #2f4f7d; --unused: #f07a50; --unused2: #7a3f2b; --tag: #232b36; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.8;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; line-height: 1.35; margin: 0; }
h1 { font-size: clamp(28px, 6vw, 42px); font-weight: 900; }
h2 { font-size: 22px; font-weight: 700; }
h3 { font-size: 16px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.num { font-variant-numeric: tabular-nums; }
.small { font-size: 13px; color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stat b { font-family: var(--display); font-size: 26px; font-weight: 900; font-variant-numeric: tabular-nums; }
.stat span { font-size: 12px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.grid line { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.chip { display: inline-block; font-size: 11px; padding: 0 7px; border-radius: 4px; border: 1px solid var(--line); white-space: nowrap; }
.chip.steady { border-color: var(--carry); color: var(--carry); }
.chip.spike { border-style: dashed; border-color: var(--unused); color: var(--unused); }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; width: 100%; min-width: 600px; }
th, td { padding: 5px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; vertical-align: middle; }
th:first-child, td:first-child { text-align: left; white-space: normal; min-width: 180px; }
thead th { color: var(--muted); font-weight: 400; }
td .g { display: block; font-size: 11px; color: var(--muted); }
.progs { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.prog { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.prog .sum { font-size: 13px; }
.claims { display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; list-style: none; }
.claims li { display: grid; gap: 4px; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--carry); outline-offset: 2px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 260px; z-index: 5; }
</style>

<main>
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="eyebrow">一般会計・決算 FY2017〜FY2024 · 翌年度繰越と不用</span>
    <h1>使い切れない予算は、どこで生まれ、どこへ行ったか</h1>
    <p>決算では、その年度に使えるお金（歳出予算現額）が、支出済・翌年度繰越・不用の 3 つに分かれます。繰越と不用が大きい項を探し、毎年続くものと、コロナ期に偏るものを分けました。繰越が翌年度にどうなったかは、事業のまとまりごとに入りと出を締めて追いました。</p>
    <div class="stats" id="stats"></div>
  </header>

  <section>
    <h2>繰越の山は FY2020〜FY2022、不用の山は FY2022</h2>
    <p id="perLead"></p>
    <div class="panel scroll"><svg class="chart" id="perChart" role="img" aria-label="年度ごとの翌年度繰越と不用（区分別）"></svg>
      <div class="legend" style="margin-top:8px"><span><i style="background:var(--carry)"></i>繰越・毎年続く項</span><span><i style="background:var(--carry2)"></i>繰越・1 年に偏る項</span><span><i style="background:var(--spent)"></i>繰越・その他</span><span><i style="background:var(--unused)"></i>不用・続く</span><span><i style="background:var(--unused2)"></i>不用・偏る</span></div>
    </div>
    <p class="small">「毎年続く」= 8 年のうち 6 年以上で繰越があり、1 つの年度に 8 年分の半分以上が集まっていない項（確定した対応で年度をたどった流れ）。「偏る」= 1 つの年度に半分以上が集まる項。区分はこのページで決めたもの。</p>
  </section>

  <section>
    <h2>繰越の大きい項</h2>
    <p id="topLead"></p>
    <div class="panel scroll"><table id="topTbl"></table></div>
    <p class="small">繰越の 8 年計は、年度末の残高を 8 年分足したもの。同じお金を 2 年続けて繰り越すと 2 回数えます（下の「繰越の行方」では、二重に数えない締め方をしています）。</p>
  </section>

  <section>
    <h2>不用の大きい項</h2>
    <div class="panel scroll"><table id="unTbl"></table></div>
    <p class="small">予備費の項は、使った分が他の項へ移り、残った分が不用になる仕組みです。予備費の項の不用は「使わなかった予備費」です。</p>
  </section>

  <section>
    <h2>繰越の行方: 入りと出を締める</h2>
    <p id="handLead"></p>
    <div class="progs" id="progs"></div>
    <div class="legend"><span><i style="background:var(--spent)"></i>支出済</span><span><i style="background:var(--carry)"></i>翌年度繰越</span><span><i style="background:var(--unused)"></i>不用</span></div>
    <p class="small">各年度の棒は、その年度に使えるお金（現額）の分かれ方。入り = 歳出予算額 + 予備費使用 + 流用 + 移替（まとまりの中の移替は打ち消し合う）。締め = 入り + 期首の繰越 − 支出 − 不用 − 期末の繰越 で、5 つとも 0 円になりました。決算書は、支出済を「今年度の予算から」と「繰越分から」に分けていないので、繰越したお金そのものが使われたかは、期間で締めた結果でしか言えません。</p>
  </section>

  <section>
    <h2>内閣府の繰越率が高い理由</h2>
    <ul class="claims">
      <li><strong id="nkHead"></strong><span id="nkBody"></span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
      <li><strong>お金を持つ府省と、払う府省が違う</strong><span>新型コロナ対応の地方創生臨時交付金の項は、内閣府と総務省に同じ名前であります。内閣府の項は、FY2020〜FY2023 の 4 年とも支出済が 0 円で、毎年度、予備費使用などで受けたお金を総務省へ移し替え（FY2021 は −3.37兆円）、残りを翌年度へ繰り越していました。払っているのは総務省の項です。内閣府だけを見ると「繰越が 100%」に見えますが、2 つの項を合わせると、5 年で 18.3兆円が入り、15.1兆円（82%）が支出、3.3兆円（18%）が不用で、FY2024 末の残りは 0 円です。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>全体の数字</h2>
    <details>
      <summary>繰越の上位 14 項の年度ごとの値（億円）</summary>
      <div class="scroll" style="margin-top:12px"><table id="yrTbl"></table></div>
    </details>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の決算書（一般会計の項・目）。FY2017〜FY2024。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が抽出・構造化した項の決算（歳出予算額・前年度繰越・予備費使用・流用・移替・現額・支出済・翌年度繰越・不用）と、年度をまたぐ項の対応（確定したものだけ）。</li>
      <li><span class="tag ai"></span>「続く／偏る」の区分、8 年計、上位の並べ方、事業のまとまり（同じ項名の内閣府・総務省の項を 1 つにする）、締めの計算は、この探索で行ったものです。</li>
      <li>検算: 8 年計（現額 1,119.6兆円・繰越 108.4兆円・不用 37.5兆円）は、決算の項の CSV を直接足した値と円まで一致。上の 5 つのまとまりの年度ごとの値も CSV から直接取り、繰越の受け渡し（ある年度の翌年度繰越 = 次の年度の前年度繰越）が全て一致。主な項の目の合計は、項の値と一致。</li>
      <li>繰越・不用の理由（工事の遅れ、見込みとの差、制度の終了など）は、このデータにありません。このページは良し悪しを判断していません。</li>
      <li>未確認: 繰越のうち、明許繰越と事故繰越（2 回目の繰越）の区別。支出済のうち、繰越分から払った額。政府が公表する決算の数字との照合。特別会計。FY2025 以降（決算がまだ無い）。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>公共事業の項（社会資本総合整備・河川・道路）は、毎年およそ 3 割を繰り越し、不用はごくわずかです（社会資本総合整備は 8 年で、入りの 94% を支出、不用は 0.6%）。これを「遅れ」と見るか「年度をまたぐ工事の普通の形」と見るか、どちらが気になりますか。</li>
      <li>コロナ期の交付金・給付金の不用（例: 協力要請推進交付金の不用 2.35兆円）は、目の単位でさらに分けられます。どの事業を深掘りしますか。</li>
      <li>物価高騰対応の臨時交付金は、FY2024 末に 1,231億円が残っています。FY2025 の決算が出たら、ここを追いますか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（2026-11-03）。金額は円単位の値から計算し、表示で丸めています。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y;
const cho = v => (v / 10000);
const fT = (v, d = 1) => v === null || v === undefined ? '—' : (v / 10000).toFixed(d) + '兆円';
const fO = v => v === null || v === undefined ? '—' : Math.round(v).toLocaleString('ja-JP');
const fA = v => Math.abs(v) >= 10000 ? fT(v, 2) : Math.round(v).toLocaleString('ja-JP') + '億円';
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 270) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const KIND = { steady: '毎年続く', spike: '1 年に偏る', mixed: 'その他', none: '—' };

// 冒頭の数字
(() => {
  const p20 = D.per.find(p => p.y === 2020), p22 = D.per.find(p => p.y === 2022);
  const c20 = p20.st + p20.sp + p20.mx, u22 = p22.us + p22.up;
  const items = [
    [fT(c20), `FY2020 の翌年度繰越（現額の ${pct(c20, p20.cur)}）`],
    [fT(u22), `FY2022 の不用（現額の ${pct(u22, p22.cur)}）`],
    [`${D.flows.toLocaleString()}`, `決算のある項の流れ。繰越の 8 割は、このうち 41 の流れに集まる`],
    [pct(D.hand.eqSum, D.hand.out), `繰越が翌年度の同じ項に「前年度繰越」として円まで一致して届いた割合`],
  ];
  document.getElementById('stats').innerHTML = items.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
})();

// 年度ごとの繰越・不用
(() => {
  const s = document.getElementById('perChart'), W = 680, H = 280, L = 52, R = 12, T = 14, B = 30;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const max = Math.max(...D.per.map(p => p.st + p.sp + p.mx)) * 1.05, y = v => T + (H - T - B) * (1 - v / max);
  const g = el('g', { class: 'grid' }, s);
  for (let v = 0; v <= max / 10000; v += 10) { el('line', { x1: L, x2: W - R, y1: y(v * 10000), y2: y(v * 10000) }, g); el('text', { x: L - 6, y: y(v * 10000) + 4, 'text-anchor': 'end' }, s).textContent = v === 0 ? '0' : v + '兆'; }
  const colW = (W - L - R) / Y.length, bw = Math.min(26, colW * 0.32);
  D.per.forEach((p, i) => {
    const cx = L + colW * (i + 0.5);
    let base = 0;
    for (const [v, c] of [[p.st, 'var(--carry)'], [p.sp, 'var(--carry2)'], [p.mx, 'var(--spent)']]) { if (v > 0) el('rect', { x: cx - bw - 2, y: y(base + v), width: bw, height: Math.max(1, y(base) - y(base + v)), fill: c }, s); base += v; }
    const cTot = base; base = 0;
    for (const [v, c] of [[p.us, 'var(--unused)'], [p.up, 'var(--unused2)']]) { if (v > 0) el('rect', { x: cx + 2, y: y(base + v), width: bw, height: Math.max(1, y(base) - y(base + v)), fill: c }, s); base += v; }
    const uTot = base;
    el('text', { x: cx - bw / 2 - 2, y: y(cTot) - 4, 'text-anchor': 'middle', class: 'num' }, s).textContent = (cTot / 10000).toFixed(1);
    el('text', { x: cx, y: H - 10, 'text-anchor': 'middle' }, s).textContent = 'FY' + p.y;
    const hit = el('rect', { x: cx - colW / 2, y: T, width: colW, height: H - T - B, fill: 'transparent' }, s);
    hover(hit, `<b>FY${p.y}</b>（現額 ${fT(p.cur)}）<br>翌年度繰越 ${fT(cTot, 2)}（${pct(cTot, p.cur)}）<br>　続く ${fT(p.st, 2)}・偏る ${fT(p.sp, 2)}・その他 ${fT(p.mx, 2)}<br>不用 ${fT(uTot, 2)}（${pct(uTot, p.cur)}）`);
  });
  const p17 = D.per[0], c17 = p17.st + p17.sp + p17.mx;
  document.getElementById('perLead').textContent = `FY2017 の繰越は ${fT(c17)}（現額の ${pct(c17, p17.cur)}）でした。FY2020 は補正で現額が膨らみ、繰越が ${fT(D.per[3].st + D.per[3].sp + D.per[3].mx)} になりました。その半分以上は、1 つの年度に偏る項（コロナ対応の交付金・給付金・出資など）です。毎年続く項の繰越も、FY2017 の ${fT(p17.st)} から FY2020 の ${fT(D.per[3].st)} に増え、FY2024 でも ${fT(D.per[7].st)} あります。`;
})();

// 繰越の上位
(() => {
  const t = document.getElementById('topTbl');
  const spark = r => { const W = 120, H = 26, vals = r.cy.map(v => v ?? 0), mx = Math.max(...vals) || 1; return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">` + vals.map((v, i) => `<rect x="${i * 15 + 1}" y="${H - 2 - (H - 4) * v / mx}" width="11" height="${(H - 4) * v / mx}" fill="${r.cy[i] === null ? 'none' : 'var(--carry)'}"></rect>`).join('') + `</svg>`; };
  t.innerHTML = `<thead><tr><th>項（府省）</th><th>繰越 8 年計</th><th>現額 8 年計</th><th>率</th><th>区分</th><th>FY2017〜2024</th></tr></thead><tbody>` +
    D.top.map(r => `<tr><td>${r.n}<span class="g">${r.g}</span></td><td>${fT(r.c, 2)}</td><td>${fT(r.cur, 2)}</td><td>${pct(r.c, r.cur)}</td><td><span class="chip ${r.k}">${KIND[r.k]}</span></td><td>${spark(r)}</td></tr>`).join('') + '</tbody>';
  const share = D.top.reduce((a, r) => a + r.c, 0);
  document.getElementById('topLead').textContent = `繰越の 8 年計 ${fT(D.total.c)} のうち、上の 14 項で ${fT(share)}（${pct(share, D.total.c)}）です。国土交通省の公共事業（社会資本総合整備・河川・道路）は、毎年 3 割前後を繰り越す「続く」型です。コロナ期の項は多くが「偏る」型ですが、内閣府の新型コロナ対応の臨時交付金は 3 年続けて繰り越して「その他」に、厚生労働省の感染症対策費は 8 年とも繰越がある「続く」型に入ります。`;
  const y = document.getElementById('yrTbl');
  y.innerHTML = `<thead><tr><th>項</th>${Y.map(v => `<th>FY${v}</th>`).join('')}</tr></thead><tbody>` + D.top.map(r => `<tr><td>${r.n}<span class="g">${r.g} · 繰越（上）と不用（下）</span></td>${r.cy.map((v, i) => `<td>${fO(v)}<span class="g">${fO(r.uy[i])}</span></td>`).join('')}</tr>`).join('') + '</tbody>';
})();

// 不用の上位
(() => {
  const t = document.getElementById('unTbl');
  t.innerHTML = `<thead><tr><th>項（府省）</th><th>不用 8 年計</th><th>現額 8 年計</th><th>率</th><th>区分</th></tr></thead><tbody>` +
    D.topU.map(r => `<tr><td>${r.n}${r.res ? ' <span class="chip">予備費</span>' : ''}<span class="g">${r.g}</span></td><td>${fT(r.u, 2)}</td><td>${fT(r.cur, 2)}</td><td>${pct(r.u, r.cur)}</td><td><span class="chip ${r.k}">${KIND[r.k]}</span></td></tr>`).join('') + '</tbody>';
})();

// 繰越の行方
(() => {
  const h = D.hand;
  document.getElementById('handLead').textContent = `FY2017〜FY2023 の繰越 ${fT(h.out)}（${h.n.toLocaleString()} 件の項・年度）のうち、${fT(h.eqSum)}（${pct(h.eqSum, h.out)}）は、翌年度の同じ項の「前年度繰越」と円まで一致しました。翌年度に同じ項が見つからない繰越は ${h.noNext} 件・${fA(h.noNextSum)}（項の組み替えなど）。では、繰り越したお金は最後に使われたのか。5 つの事業のまとまりで、入りと出を締めました。`;
  const host = document.getElementById('progs');
  for (const key of ['covid', 'kanko', 'energy', 'bukka', 'shakai']) {
    const p = D.prog[key];
    const box = document.createElement('div'); box.className = 'prog';
    const tail = p.end > 0 ? `、${p.years[p.years.length - 1].y} 年度末の残り ${fA(p.end)}` : `、残り 0 円`;
    box.innerHTML = `<h3>${p.label}</h3><span class="sum num">入り ${fA(p.new)}${p.start ? `（＋期首の繰越 ${fA(p.start)}）` : ''} → 支出 ${fA(p.spent)}（${pct(p.spent, p.new + p.start)}）・不用 ${fA(p.un)}（${pct(p.un, p.new + p.start)}）${tail}</span>`;
    const W = 320, H = 130, L = 8, R = 8, T = 8, B = 20, mx = Math.max(...p.years.map(x => x.cur)) || 1;
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': p.label + 'の年度ごとの現額の分かれ方' });
    const colW = (W - L - R) / Math.max(p.years.length, 3), bw = Math.min(30, colW * 0.6);
    p.years.forEach((x, i) => {
      const cx = L + colW * (i + 0.5), yv = v => T + (H - T - B) * (1 - v / mx);
      let base = 0;
      for (const [v, c] of [[x.spent, 'var(--spent)'], [x.cout, 'var(--carry)'], [x.un, 'var(--unused)']]) { if (v > 0) el('rect', { x: cx - bw / 2, y: yv(base + v), width: bw, height: Math.max(1, yv(base) - yv(base + v)), fill: c }, s); base += v; }
      el('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, s).textContent = String(x.y).slice(2);
      const hit = el('rect', { x: cx - colW / 2, y: 0, width: colW, height: H, fill: 'transparent' }, s);
      hover(hit, `<b>FY${x.y}</b><br>現額 ${fA(x.cur)}（前年度繰越 ${fA(x.cin)}）<br>支出済 ${fA(x.spent)}<br>翌年度繰越 ${fA(x.cout)}<br>不用 ${fA(x.un)}`);
    });
    box.appendChild(s); host.appendChild(box);
  }
})();

// 内閣府
(() => {
  const n = D.nk, x = D.nkx, rest = { cur: n.cur - x.cur, c: n.c - x.c, u: n.u - x.u };
  document.getElementById('nkHead').textContent = `内閣府の繰越 ${fT(n.c, 2)} のうち ${pct(x.c, n.c)} は、2 つの臨時交付金の項`;
  document.getElementById('nkBody').textContent = `内閣府の 8 年計は、現額 ${fT(n.cur)}・繰越 ${fT(n.c, 2)}（${pct(n.c, n.cur)}）・不用 ${fT(n.u, 2)}（${pct(n.u, n.cur)}）です。新型コロナ対応と物価高騰対応の地方創生臨時交付金の項を除くと、繰越率は ${pct(rest.c, rest.cur)}、不用率は ${pct(rest.u, rest.cur)} です。`;
})();
</script>
'''
open('index.html', 'w').write(html.replace('__DATA__', data))
open('preview.html', 'w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html.replace('__DATA__', data) + '</body></html>')
