/**
 * 予算の一生の画面の「事項」タブ用のデータ（`lifecycle/jikou.json.gz`）。仕様: docs/guides/lifecycle-jikou.md
 *
 * 事項（当初予算。`jikou-links.ts`）を、予算の一生の表の項（`LifecycleKou`）にぶら下げる。項の鍵は、年度・会計・所管（特別会計は特別会計）・組織（特別会計は勘定）・項コード・項名を `nameKey` でそろえたもの。
 * 確定した（`RESOLVED`）対応だけを持つ。項に結べない事項は捨てず、数えて返す。
 */
import { JIKOU_AMOUNT, jikouEvidenceMask, nameKey, type JikouLink, type JikouNode, type LifecycleJikouData, type LifecycleJikouLink, type LifecycleJikouNode, type LifecycleKou } from '@nihon-no-yosan/core';

const kouKey = (year: number, account: string, a: string, b: string, code: string, name: string): string => [year, account, nameKey(a), nameKey(b), code, nameKey(name)].join('|');
const keyOfKou = (k: LifecycleKou): string => (k.account === 'general' ? kouKey(k.year, k.account, k.ministry, k.org, k.code, k.name) : kouKey(k.year, k.account, k.specialAccount, k.subAccount, k.code, k.name));
const keyOfNode = (n: JikouNode): string => (n.account === 'general' ? kouKey(n.year, n.account, n.ministry, n.org, n.itemCode, n.itemName) : kouKey(n.year, n.account, n.specialAccount, n.subAccount, n.itemCode, n.itemName));

export interface LifecycleJikouBuild {
  data: LifecycleJikouData;
  /** 項に結べなかった事項の数（年度ごと） */
  unmatched: Record<number, number>;
}

export function buildLifecycleJikou(input: { years: readonly number[]; nodes: readonly JikouNode[]; links: readonly JikouLink[] }, kous: readonly LifecycleKou[]): LifecycleJikouBuild {
  const idByKey = new Map<string, string>();
  for (const k of kous) {
    if (k.requestOnly) continue; // 概算要求のみの項は、予算書の事項が無い
    const key = keyOfKou(k);
    if (idByKey.has(key)) throw new Error(`項の鍵が重なる: ${key}`);
    idByKey.set(key, k.id);
  }
  // 事項のある項だけを `kous` に入れる（添字は最初に使われた順）
  const kouIds: string[] = [];
  const indexOfId = new Map<string, number>();
  const unmatched: Record<number, number> = {};
  const nodes: LifecycleJikouNode[] = [];
  const remap = new Map<number, number>();
  input.nodes.forEach((n, i) => {
    const id = idByKey.get(keyOfNode(n));
    if (id === undefined) { unmatched[n.year] = (unmatched[n.year] ?? 0) + 1; return; }
    let k = indexOfId.get(id);
    if (k === undefined) { k = kouIds.length; kouIds.push(id); indexOfId.set(id, k); }
    remap.set(i, nodes.length);
    nodes.push([k, n.year, n.name, n.budget, n.prev, n.revised ?? null, n.suppNet ?? null]);
  });
  const links: LifecycleJikouLink[] = [];
  for (const l of input.links) {
    if (l.status !== 'RESOLVED' || l.from < 0 || l.to < 0) continue;
    const a = remap.get(l.from), b = remap.get(l.to);
    if (a === undefined || b === undefined) continue;
    links.push([a, b, jikouEvidenceMask(l.evidence), JIKOU_AMOUNT.indexOf(l.amount)]);
  }
  return { data: { years: [...input.years], kous: kouIds, nodes, links }, unmatched };
}
