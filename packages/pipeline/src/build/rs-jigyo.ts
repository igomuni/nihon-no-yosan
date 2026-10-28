/**
 * RS の事業の一覧データ（`lifecycle` の画面の RS タブ）を作る。仕様: docs/guides/rs-tab.md
 *
 * 事業: 1-2（事業概要等）から、予算事業 ID ごとに 1 件。同じ ID の行が複数あるとき（主要経費が複数あると行が分かれる）は、事業名・府省庁・局・庁が同じことを確かめ、主要経費を合わせる（違えば止まる）。
 * 額: 2-1（サマリ）の、会計区分が空の合計の行。同じ事業・年度に合計の行が複数あるときは、値のない行を除き、残りが 1 つか、同じ値でなければ止まる。
 * 項へのつなぎ: `rs-link.ts` で結べた行（`linked`）だけ。結べない事業も、事業の一覧には残る。
 */
import type { Rec, RsAmountRow, RsJigyoData, RsLinkEntry } from '@nihon-no-yosan/core';
import type { RsLinkRow } from './rs-link.ts';

/** 2-1 の合計の行の額の列（`RsAmountRow` の並びと同じ） */
const AMOUNT_COLS = ['当初予算(合計)', '補正予算(合計)', '前年度からの繰越し(合計)', '予備費等(合計)', '計(歳出予算現額合計)', '執行額(合計)', '翌年度への繰越し(合計)', '翌年度要求額(合計)'] as const;

/** 円の額。空欄は null。`30000000.0` のような小数点以下が 0 の形は整数に直す。それ以外の小数・文字は止まる */
function yenOf(s: string | undefined, where: string): number | null {
  const t = (s ?? '').replace(/[\s,]/g, '');
  if (t === '') return null;
  const m = /^(-?\d+)(?:\.0+)?$/.exec(t);
  if (!m) throw new Error(`額が整数でない: ${where} 「${s}」`);
  return Number(m[1]);
}

export function buildRsJigyo(overview: readonly Rec[], summary: readonly Rec[], links: readonly RsLinkRow[]): RsJigyoData {
  // 事業
  const byId = new Map<string, { name: string; ministry: string; bureau: string; major: string[] }>();
  for (const r of overview) {
    const id = r['予算事業ID'] ?? '';
    const cur = { name: r['事業名'] ?? '', ministry: r['府省庁'] ?? '', bureau: r['局・庁'] ?? '' };
    const prev = byId.get(id);
    if (!prev) byId.set(id, { ...cur, major: [] });
    else if (prev.name !== cur.name || prev.ministry !== cur.ministry || prev.bureau !== cur.bureau) throw new Error(`同じ予算事業 ID で、事業名・府省庁・局・庁が違う: ${id}`);
    const major = (r['主要経費'] ?? '').trim();
    const e = byId.get(id)!;
    if (major !== '' && !e.major.includes(major)) e.major.push(major);
  }
  const ids = [...byId.keys()].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const idx = new Map(ids.map((id, i) => [id, i]));
  const jigyo = ids.map(id => { const e = byId.get(id)!; return [id, e.name, e.ministry, e.bureau, e.major.join('|')] as [string, string, string, string, string]; });

  // 額（合計の行）
  const rowsOf = new Map<string, Rec[]>();
  for (const r of summary) {
    if ((r['会計区分'] ?? '') !== '') continue;
    const k = `${r['予算事業ID']}|${r['予算年度']}`;
    (rowsOf.get(k) ?? rowsOf.set(k, []).get(k)!).push(r);
  }
  const amounts: RsAmountRow[] = [];
  for (const [k, rs] of rowsOf) {
    const [id, y] = k.split('|') as [string, string];
    const i = idx.get(id);
    if (i === undefined) throw new Error(`2-1 の事業が 1-2 に無い: ${id}`);
    const vals = rs.map(r => AMOUNT_COLS.map(c => yenOf(r[c], `${id} ${y} ${c}`)));
    const filled = vals.filter(v => v.some(x => x !== null));
    const pick = filled.length === 0 ? vals[0]! : filled[0]!;
    if (filled.some(v => v.some((x, c) => x !== pick[c]))) throw new Error(`同じ事業・年度の合計の行が、違う値で複数ある: ${id} ${y}`);
    amounts.push([i, Number(y), ...pick] as RsAmountRow);
  }
  amounts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const years = [...new Set(amounts.map(a => a[1]))].sort((a, b) => a - b);

  // 項へのつなぎ
  const kous: string[] = [];
  const kouIdx = new Map<string, number>();
  const entries: RsLinkEntry[] = [];
  for (const l of links) {
    if (l.status !== 'linked') continue;
    const i = idx.get(l.id);
    if (i === undefined) throw new Error(`2-2 の事業が 1-2 に無い: ${l.id}`);
    let k = kouIdx.get(l.kouId);
    if (k === undefined) { k = kous.length; kous.push(l.kouId); kouIdx.set(l.kouId, k); }
    entries.push([i, l.year, k, l.moku, l.kind, l.yen]);
  }
  return { years, kous, jigyo, amounts, links: entries };
}
