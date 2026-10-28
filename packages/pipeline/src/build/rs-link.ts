/**
 * 行政事業レビュー（RS）の事業を、予算書の項・目につなぐ。仕様: docs/guides/rs-link.md
 *
 * RS の「2-2 予算・執行_予算種別・歳出予算項目」は、事業ごと・予算年度ごとに、会計区分・所管・組織（勘定）・項・目と予算額の行を持つ。
 * 項は、所管・組織・項名（特別会計は、会計・項名。複数の勘定があれば勘定）を名前でそろえて、予算書の項（`LifecycleKou`）に結ぶ。目は、結べた項の中の目名で、予算書の目に結ぶ。
 * 結べない行は捨てずに、理由（`status`）を付けて残す。
 */
import { nameKey, type LifecycleKou, type Rec } from '@nihon-no-yosan/core';

/**
 * `linked` = 予算書の項に 1 つ結べた。`noKou` = RS の行に項が無い（空欄）。`unmatched` = 項が書いてあるが、その年度の予算書に同じ項が無い。
 * `ambiguous` = 同じ名前の予算書の項が複数あり、1 つに決められない。
 */
export type RsLinkStatus = 'linked' | 'noKou' | 'unmatched' | 'ambiguous';

export interface RsLinkRow {
  /** 予算事業 ID */
  id: string;
  /** 予算年度 */
  year: number;
  /** 予算種別（当初予算・第1次補正予算・前年度から繰越し・予備費等1 など。空のことがある） */
  kind: string;
  status: RsLinkStatus;
  /** 結べた予算書の項（`LifecycleKou.id`）。`linked` のときだけ */
  kouId: string;
  /** RS の行の目名（空のことがある） */
  moku: string;
  /** 結べた項の中に、同じ目名の予算書の目がある（`linked` で、目名があるときだけ意味を持つ） */
  mokuHit: boolean;
  /** 予算額（歳出予算項目ごと。円）。空欄は null */
  yen: number | null;
}

export interface RsLinkStats {
  /** 予算年度 → 状態 → 行数 */
  rows: Record<number, Record<RsLinkStatus, number>>;
  /** 予算年度 → { その年度に行のある事業の数, うち項に結べた行を持つ事業の数 } */
  jigyo: Record<number, { total: number; linked: number }>;
  /** 項に結べた行のうち、目名のある行の数と、予算書の目に結べた行の数 */
  moku: { named: number; hit: number };
}

const yenOf = (s: string | undefined): number | null => {
  const t = (s ?? '').replace(/[\s,]/g, '');
  return /^-?\d+$/.test(t) ? Number(t) : null;
};

/**
 * `rows` は 2-2 の行。`kous` は予算の一生の表の項、`hasMoku(項の id, 目名の nameKey)` は、その項に同じ目名の目があるか。
 * 概算要求書にだけある項（`requestOnly`）は、予算書の項ではないので、結ばない。
 */
export function buildRsLink(rows: readonly Rec[], kous: readonly LifecycleKou[], hasMoku: (kouId: string, mokuKey: string) => boolean): { rows: RsLinkRow[]; stats: RsLinkStats } {
  // 年度・会計区分ごとの索引。一般会計: 所管|組織|項名、特別会計: 会計|項名（勘定は、複数あるときの絞り込み）
  const general = new Map<string, LifecycleKou[]>();
  const special = new Map<string, LifecycleKou[]>();
  for (const k of kous) {
    if (k.requestOnly) continue;
    const [m, key] = k.account === 'general' ? [general, `${k.year}|${nameKey(k.ministry)}|${nameKey(k.org)}|${nameKey(k.name)}`] : [special, `${k.year}|${nameKey(k.specialAccount)}|${nameKey(k.name)}`];
    (m.get(key) ?? m.set(key, []).get(key)!).push(k);
  }
  const out: RsLinkRow[] = [];
  const stats: RsLinkStats = { rows: {}, jigyo: {}, moku: { named: 0, hit: 0 } };
  const jigyoSeen = new Map<number, Set<string>>();
  const jigyoLinked = new Map<number, Set<string>>();
  for (const r of rows) {
    const year = Number(r['予算年度']);
    const id = r['予算事業ID'] ?? '';
    const name = nameKey(r['項']);
    let status: RsLinkStatus = 'noKou';
    let kouId = '';
    if (name !== '') {
      const special2 = r['会計区分'] === '特別会計';
      const cands = (special2 ? special.get(`${year}|${nameKey(r['会計'])}|${name}`) : general.get(`${year}|${nameKey(r['所管'])}|${nameKey(r['組織・勘定'])}|${name}`)) ?? [];
      const narrowed = special2 && cands.length > 1 ? cands.filter(k => nameKey(k.subAccount) === nameKey(r['勘定'])) : cands;
      if (narrowed.length === 1) { status = 'linked'; kouId = narrowed[0]!.id; }
      else status = cands.length === 0 ? 'unmatched' : 'ambiguous'; // 候補があって 1 つに決められない（勘定で絞れない・勘定が合わないときも）
    }
    const moku = (r['目'] ?? '').trim();
    const mokuHit = status === 'linked' && moku !== '' && hasMoku(kouId, nameKey(moku));
    out.push({ id, year, kind: r['予算種別'] ?? '', status, kouId, moku, mokuHit, yen: yenOf(r['予算額(歳出予算項目ごと)']) });
    const by = (stats.rows[year] ??= { linked: 0, noKou: 0, unmatched: 0, ambiguous: 0 });
    by[status]++;
    (jigyoSeen.get(year) ?? jigyoSeen.set(year, new Set()).get(year)!).add(id);
    if (status === 'linked') (jigyoLinked.get(year) ?? jigyoLinked.set(year, new Set()).get(year)!).add(id);
    if (status === 'linked' && moku !== '') { stats.moku.named++; if (mokuHit) stats.moku.hit++; }
  }
  for (const [year, s] of jigyoSeen) stats.jigyo[year] = { total: s.size, linked: jigyoLinked.get(year)?.size ?? 0 };
  return { rows: out, stats };
}
