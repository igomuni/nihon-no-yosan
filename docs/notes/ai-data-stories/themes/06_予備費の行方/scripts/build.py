import json
data=open('page-data.json').read()
html=r'''<title>予備費の行方</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
/* layout: 1 本の読み物の列（最大 760px）。使った = 濃い色、使わなかった = 同じ色の斜線。通常の予備費 = 藍、特別な予備費 = 朱 */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --ink: #18202b; --muted: #5b6573; --line: #d9dee5;
  --normal: #2a6fc9; --special: #d2542a; --zero: #9aa3ae; --tag: #eef1f5;
  --display: "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --normal: #5b9cf0; --special: #f07a50; --zero: #6b7582; --tag: #232b36; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c3440;
  --normal: #5b9cf0; --special: #f07a50; --zero: #6b7582; --tag: #232b36; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.8;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }
h1, h2 { font-family: var(--display); text-wrap: balance; line-height: 1.35; margin: 0; }
h1 { font-size: clamp(28px, 6vw, 42px); font-weight: 900; }
h2 { font-size: 22px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.note { font-size: 13px; color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 520px) { .stats { grid-template-columns: 1fr; } }
.stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stat .v { font-family: var(--display); font-weight: 900; font-size: clamp(30px, 7vw, 44px); line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat .k { font-size: 13px; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
.scroll { overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--body); font-size: 11px; }
.chart .lbl { fill: var(--ink); font-size: 12px; }
.chart .val { font-variant-numeric: tabular-nums; }
.grid line { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 14px; height: 10px; border-radius: 2px; display: inline-block; }
.tag { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--tag); color: var(--muted); margin-right: 6px; white-space: nowrap; }
.tag.src::before { content: "原資料"; } .tag.proc::before { content: "加工"; } .tag.ai::before { content: "AIの計算・解釈"; }
.claims { display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; list-style: none; }
.claims li { display: grid; gap: 4px; }
table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; width: 100%; }
th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th.l, td.l { text-align: left; white-space: normal; min-width: 10em; }
thead th { color: var(--muted); font-weight: 400; }
tr.sp td.l { color: var(--special); } tr.nm td.l { color: var(--normal); }
td.zero { color: var(--special); font-weight: 700; }
.notes { padding-left: 1.2em; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.questions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.questions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
summary { cursor: pointer; font-weight: 700; }
summary:focus-visible { outline: 2px solid var(--normal); outline-offset: 2px; }
footer { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; line-height: 1.5; max-width: 280px; z-index: 5; }
</style>

<main>
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="eyebrow">一般会計・決算　FY2017 → FY2024</span>
    <h1>予備費は、どこに、いくら使われたか</h1>
    <div class="stats">
      <div class="stat"><span class="v" id="sBudget"></span><span class="k">8 年で計上した予備費（補正後）</span></div>
      <div class="stat"><span class="v" id="sUsed" style="color:var(--special)"></span><span class="k">決算で使われた額（予備費使用額）</span></div>
      <div class="stat"><span class="v" id="sUnused"></span><span class="k">使われずに残った額（不用額）</span></div>
    </div>
    <p id="lead"></p>
  </header>

  <section>
    <h2>年度ごとの計上と使用</h2>
    <div class="legend">
      <span><i class="sw" style="background:var(--normal)"></i>通常の予備費・使用</span>
      <span><i class="sw" style="background:var(--special)"></i>特別な予備費・使用</span>
      <span><i class="sw" style="background:repeating-linear-gradient(45deg,var(--zero) 0 2px,transparent 2px 5px);border:1px solid var(--zero)"></i>使われずに残った</span>
    </div>
    <div class="panel scroll"><svg class="chart" id="yearChart" viewBox="0 0 680 300" style="min-width:520px" role="img" aria-label="年度ごとの予備費の計上と使用"></svg></div>
    <p class="note">棒の高さは、決算の歳出予算額（補正後の計上額）。棒にカーソルを当てると、予備費の項ごとの内訳が出ます。</p>
  </section>

  <section>
    <h2>予備費の項ごとの経過</h2>
    <div class="panel scroll"><table id="resTable"></table></div>
    <ul class="claims">
      <li><strong>特別な予備費は、補正で作られ、補正で増減する</strong><span>FY2020 の新型コロナウイルス感染症対策予備費は、当初予算に無く、補正で 9.65兆円になりました（補正が複数回あり、データは最後の回の額）。FY2022 は当初 5.0兆円が補正で 9.86兆円に増え、項名も「…及び原油価格・物価高騰対策予備費」に変わりました。FY2023 は当初 4.0兆円が、補正で 2.0兆円に減らされています。</span><span><span class="tag src"></span><span class="tag proc"></span></span></li>
      <li><strong>ウクライナ情勢経済緊急対応予備費は、2 年とも使われていない</strong><span>FY2022 に補正で 1.0兆円、FY2023 は当初 1.0兆円（補正で 0.5兆円に減額）。決算の予備費使用額は、2 年とも 0 円でした。</span><span><span class="tag src"></span></span></li>
      <li><strong>通常の予備費は、増えて、よく使われている</strong><span id="normalNote"></span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
    </ul>
  </section>

  <section>
    <h2>どこへ使われたか</h2>
    <p id="whereLead"></p>
    <div class="panel scroll"><svg class="chart" id="groupChart" role="img" aria-label="府省別の予備費使用額（8 年合計）"></svg></div>
    <div class="panel scroll"><svg class="chart" id="majorChart" role="img" aria-label="主要経費別の予備費使用額（8 年合計）"></svg></div>
    <p class="note">予備費を受け取った目の分類コード（主要経費別）で分けています。府省は予算書の所管（内閣府の外局は、それぞれの府省）。</p>
    <details>
      <summary>受け取った額の大きい項（8 年合計の上位 12）</summary>
      <div class="scroll" style="margin-top:12px"><table id="kouTable"></table></div>
    </details>
  </section>

  <section>
    <h2>使った先で、そのお金は使われたか</h2>
    <ul class="claims">
      <li><strong>地方創生臨時交付金は、内閣府から総務省へ移し替えて配る</strong><span>FY2020 に予備費から 3.38兆円を受けた「新型コロナウイルス感染症対応地方創生臨時交付金」は、内閣府の側では支出 0 円でした。予算決定後の移替で 1.63兆円が総務省へ移り、もとの予算 1.12兆円と合わせて残った 2.87兆円は、全額が翌年度へ繰り越されています。FY2022 も予備費 2.40兆円を受けましたが、内閣府のこの目は支出 0 円で、移替のあと 1.68兆円を繰り越し、0.12兆円が不用でした（目全体の値）。</span><span><span class="tag src"></span><span class="tag ai"></span></span></li>
      <li><strong>予備費だけで財源ができた目は、ごく一部</strong><span id="onlyNote"></span><span><span class="tag proc"></span><span class="tag ai"></span></span></li>
    </ul>
    <div class="panel scroll"><table id="mokuTable"></table></div>
    <p class="note">目の現額・支出・繰越・不用は、その目全体の値です。予備費の分だけの値ではありません。</p>
  </section>

  <section>
    <h2>この数字の作り方と、確かめられないこと</h2>
    <ul class="notes">
      <li><span class="tag src"></span>財務省「予算書・決算書データベース」の決算（一般会計の目・項）の「予備費使用額」。予備費の項はマイナス、使った目はプラスで載っています。当初予算額は予算書（政府案）から。</li>
      <li><span class="tag proc"></span>nihon-no-yosan が抽出・構造化した CSV（FY2017〜FY2022 は過去年度のデータセット、FY2023・FY2024 は基準データ）。</li>
      <li><span class="tag ai"></span>年度ごとに、使った側（プラス）を足した額と、予備費の項（マイナス）の額は、8 年とも円まで一致しました。項の決算の CSV で足し直しても同じでした。予備費の項では、歳出予算額 − 使用額 = 現額 = 不用額 が成り立っています（支出・繰越は 0）。テーマ「予算の一生」の FY2020 9.43兆円・FY2022 7.61兆円とも一致します。</li>
      <li>1 つの年度に予備費の項が 2 つ以上あるとき（FY2020〜FY2023）、どの目が、どの予備費から出たかは、このデータでは分けられません。府省別・経費別の金額は、その年度の予備費全体からの使用額です。</li>
      <li>目の現額には、当初予算・補正・前年度繰越・移替も入っているので、予備費の分だけが、支出されたか・繰り越されたか・不用になったかは分けられません（予備費だけで財源ができた目を除く）。</li>
      <li>予備費の使用の理由・閣議決定の日付は、このデータにありません。補正の回ごとの額は、項ごとに最後の回の額です。特別会計の予備費は扱っていません。</li>
      <li>名目額。政府が公表する予備費の使用実績とは照合していません。</li>
    </ul>
  </section>

  <section>
    <h2>次に、聞かせてください</h2>
    <ol class="questions">
      <li>地方創生臨時交付金のように、移し替えと繰越を重ねたお金は、最後にどこで支出されたか。総務省側と翌年度をつないで追いますか。</li>
      <li>予備費を受けた項の中で、当初予算・補正と比べて、予備費の比重が大きいのはどこか。気になる府省はありますか。</li>
      <li>使われなかった特別な予備費（FY2020〜FY2023 で計 6.0兆円）を、補正で積んだ額と比べてみますか。</li>
    </ol>
  </section>

  <footer>
    <span>出典：財務省「予算書・決算書データベース」を加工して作成。国や各府省が作成した加工していない情報ではありません。</span>
    <span>nihon-no-yosan の AI Data Stories PoC（2026-11-03）。金額は円の値から計算し、兆円・億円に丸めて表示。</span>
  </footer>
</main>
<div id="tip" hidden></div>

<script>
const D = __DATA__;
const Y = D.Y;
const tri = v => v / 10000; // 億円 → 兆円
const f = (v, d = 2) => v === null || v === undefined ? '—' : tri(v).toFixed(d);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const tip = document.getElementById('tip');
function hover(node, html) {
  node.addEventListener('pointermove', e => { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 290) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; });
  node.addEventListener('pointerleave', () => { tip.hidden = true; });
}
const sum = (a, g) => a.reduce((p, x) => p + (g(x) ?? 0), 0);
const allRes = D.years.flatMap(y => y.reserves.map(r => ({ ...r, y: y.y })));
const B = sum(allRes, r => r.budget), U = sum(allRes, r => r.used), N = sum(allRes, r => r.unused);
document.getElementById('sBudget').textContent = f(B, 1) + '兆円';
document.getElementById('sUsed').textContent = f(U, 1) + '兆円';
document.getElementById('sUnused').textContent = f(N, 1) + '兆円';
const covid = D.years.filter(y => y.y >= 2020 && y.y <= 2022).reduce((p, y) => p + y.used, 0);
document.getElementById('lead').textContent = `使われた ${f(U, 1)}兆円のうち ${f(covid, 1)}兆円（${(covid / U * 100).toFixed(0)}%）が FY2020〜FY2022 の 3 年に集中しています。FY2019 までは、毎年 0.09〜0.47兆円でした。`;

// 年度ごとの積み上げ棒
(() => {
  const s = document.getElementById('yearChart'), W = 680, H = 300, L = 44, R = 12, T = 22, Bm = 26;
  const defs = el('defs', {}, s); const pat = el('pattern', { id: 'hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs); el('rect', { width: 2, height: 5, fill: 'var(--zero)' }, pat);
  const max = Math.max(...D.years.map(y => sum(y.reserves, r => r.budget)));
  const top = Math.ceil(tri(max) / 2) * 2, y = v => T + (H - T - Bm) * (1 - tri(v) / top), cw = (W - L - R) / Y.length, bw = Math.min(46, cw * 0.6);
  const g = el('g', { class: 'grid' }, s);
  for (let v = 0; v <= top; v += 2) { el('line', { x1: L, x2: W - R, y1: y(v * 10000), y2: y(v * 10000) }, g); el('text', { x: L - 6, y: y(v * 10000) + 4, 'text-anchor': 'end' }, s).textContent = v; }
  el('text', { x: L - 6, y: 12, 'text-anchor': 'end' }, s).textContent = '兆円';
  D.years.forEach((yr, i) => {
    const x = L + cw * i + (cw - bw) / 2; let acc = 0;
    const seg = (v, fill, stroke) => { if (!v) return; const y0 = y(acc), y1 = y(acc + v); el('rect', { x, y: y1, width: bw, height: Math.max(0.5, y0 - y1), fill, stroke: stroke || 'none', 'stroke-width': 1 }, s); acc += v; };
    const nm = yr.reserves.filter(r => r.normal), sp = yr.reserves.filter(r => !r.normal);
    seg(sum(nm, r => r.used), 'var(--normal)'); seg(sum(sp, r => r.used), 'var(--special)');
    seg(sum(nm, r => r.unused), 'url(#hatch)', 'var(--normal)'); seg(sum(sp, r => r.unused), 'url(#hatch)', 'var(--special)');
    const tot = sum(yr.reserves, r => r.budget);
    el('text', { x: x + bw / 2, y: y(tot) - 6, 'text-anchor': 'middle', class: 'lbl val' }, s).textContent = f(tot, tot >= 10000 ? 1 : 2);
    el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, s).textContent = yr.y;
    const hit = el('rect', { x: L + cw * i, y: T, width: cw, height: H - T - Bm, fill: 'transparent' }, s);
    hover(hit, `<b>FY${yr.y}</b> 計上 ${f(tot)}兆円 / 使用 ${f(yr.used)}兆円<br>` + yr.reserves.map(r => `${r.name}: 計上 ${f(r.budget)}・使用 ${f(r.used)}・不用 ${f(r.unused)}`).join('<br>'));
  });
})();

// 予備費の項の表
(() => {
  const rows = allRes.map(r => {
    const rate = r.budget ? (r.used / r.budget * 100).toFixed(0) + '%' : '—';
    const renamed = r.initialName && r.initialName !== r.name ? `<br><span class="note">当初の項名: ${r.initialName}</span>` : '';
    return `<tr class="${r.normal ? 'nm' : 'sp'}"><td>FY${r.y}</td><td class="l">${r.name}${renamed}</td><td>${f(r.initial)}</td><td>${f(r.budget)}</td><td${r.used === 0 ? ' class="zero"' : ''}>${f(r.used)}</td><td>${f(r.unused)}</td><td>${rate}</td></tr>`;
  }).join('');
  document.getElementById('resTable').innerHTML = `<thead><tr><th class="l" style="min-width:0">年度</th><th class="l">予備費の項</th><th>当初</th><th>計上（補正後）</th><th>使用</th><th>不用</th><th>使用率</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td></td><td class="l"><b>8 年の合計</b></td><td></td><td><b>${f(B)}</b></td><td><b>${f(U)}</b></td><td><b>${f(N)}</b></td><td><b>${(U / B * 100).toFixed(0)}%</b></td></tr></tfoot>`;
  document.querySelector('#resTable thead th').style.textAlign = 'left';
  const nm = allRes.filter(r => r.normal);
  document.getElementById('normalNote').textContent = `通常の予備費は、FY2017 の計上 ${f(nm[0].budget)}兆円（使用 ${f(nm[0].used)}兆円、${(nm[0].used / nm[0].budget * 100).toFixed(0)}%）から、FY2024 は計上 ${f(nm[7].budget)}兆円（使用 ${f(nm[7].used)}兆円、${(nm[7].used / nm[7].budget * 100).toFixed(0)}%）。FY2019 は ${(nm[2].used / nm[2].budget * 100).toFixed(0)}%、FY2021 は ${(nm[4].used / nm[4].budget * 100).toFixed(0)}% を使っています。`;
})();

// 横棒（8 年合計）
function hbars(id, rows, label) {
  const s = document.getElementById(id), W = 680, rowH = 26, T = 8, L = 170, R = 70, H = T + rows.length * rowH + 24;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.minWidth = '520px';
  const max = Math.max(...rows.map(r => r.total)), x = v => L + (W - L - R) * v / max;
  const g = el('g', { class: 'grid' }, s);
  const step = tri(max) > 6 ? 2 : 1;
  for (let v = 0; v <= tri(max); v += step) { el('line', { x1: x(v * 10000), x2: x(v * 10000), y1: T, y2: H - 22 }, g); el('text', { x: x(v * 10000), y: H - 6, 'text-anchor': 'middle' }, s).textContent = v === 0 ? '0' : `${v}兆`; }
  rows.forEach((r, i) => {
    const y = T + i * rowH;
    el('text', { x: L - 8, y: y + 17, 'text-anchor': 'end', class: 'lbl' }, s).textContent = r.n.length > 12 ? r.n.slice(0, 12) + '…' : r.n;
    el('rect', { x: L, y: y + 6, width: Math.max(2, x(r.total) - L), height: rowH - 10, rx: 3, fill: 'var(--special)' }, s);
    el('text', { x: x(r.total) + 6, y: y + 17, class: 'val' }, s).textContent = f(r.total);
    const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, s);
    hover(hit, `<b>${r.n}</b> 8 年計 ${f(r.total)}兆円<br>` + Y.map((yy, j) => r.v[j] ? `FY${yy}: ${f(r.v[j])}` : null).filter(Boolean).join('<br>'));
  });
}
const g8 = D.groups.filter(r => r.total >= 300);
hbars('groupChart', g8);
hbars('majorChart', D.majors.filter(r => r.total >= 300));
const top3 = D.groups.slice(0, 3), top3sum = sum(top3, r => r.total);
document.getElementById('whereLead').textContent = `8 年の使用額の ${(top3sum / U * 100).toFixed(0)}% が、${top3.map(r => `${r.n}（${f(r.total, 1)}兆円）`).join('・')}の 3 府省です。経費では、感染症対策を含む保健衛生対策費、生活扶助等社会福祉費、中小企業対策費と、分類が「その他の事項経費」の交付金など（地方創生臨時交付金を含む）が大きくなっています。`;

// 項の表
document.getElementById('kouTable').innerHTML = `<thead><tr><th class="l">府省 / 項</th><th>8 年計</th>${Y.map(y => `<th>FY${y}</th>`).join('')}</tr></thead><tbody>` + D.kous.map(k => `<tr><td class="l">${k.group}<br><b>${k.kou}</b><br><span class="note">${k.mokus.map(m => m[0]).join('、')}</span></td><td><b>${f(k.total)}</b></td>${k.v.map(v => `<td>${v ? f(v) : '—'}</td>`).join('')}</tr>`).join('') + '</tbody>';

// 目の表と、予備費だけの目
document.getElementById('mokuTable').innerHTML = `<thead><tr><th>年度</th><th class="l">府省 / 目</th><th>予備費</th><th>目の現額</th><th>支出</th><th>翌年度繰越</th><th>不用</th></tr></thead><tbody>` + D.topMokus.slice(0, 8).map(m => `<tr><td>FY${m.y}</td><td class="l">${m.group} ${m.kou}<br><b>${m.moku}</b></td><td><b>${f(m.v)}</b></td><td>${f(m.current)}</td><td>${f(m.spent)}</td><td>${f(m.carried)}</td><td>${f(m.unused)}</td></tr>`).join('') + '</tbody>';
const only = D.years.reduce((p, y) => p + y.onlyRes.res, 0), onlyCnt = D.years.reduce((p, y) => p + y.onlyRes.cnt, 0), allCnt = D.years.reduce((p, y) => p + y.onlyRes.all, 0);
const o20 = D.years.find(y => y.y === 2020).onlyRes;
document.getElementById('onlyNote').textContent = `予備費を受けた目（年度ごとに数えて）${allCnt} 件のうち、ほかの財源が無く予備費だけで現額ができた目は ${onlyCnt} 件、${f(only)}兆円（使用額の ${(only / U * 100).toFixed(1)}%）です。FY2020 は 9.43兆円のうち ${f(o20.res, 3)}兆円だけでした。残りは、補正などでもともと予算のある目に足されていて、予備費の分がいくら支出されたかは分けられません。`;
</script>
'''
open('index.html','w').write(html.replace('__DATA__', data))
open('preview.html','w').write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html.replace('__DATA__', data)+'</body></html>')
