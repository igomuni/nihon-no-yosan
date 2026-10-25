/**
 * 事項（当初予算）の年度をまたぐ対応と継続年数を、CSV で出力する。仕様: docs/guides/mof-history.md
 *
 * 使い方: node packages/pipeline/src/build/jikou-links-cli.ts <基準データのディレクトリ> <過去年度のデータセットのディレクトリ> <出力ディレクトリ>
 * 出力: jikou-nodes.csv（事項と継続年数）、jikou-links.csv（対応）、jikou-links-summary.json（年度の組ごとの件数、継続年数の分布）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildJikouLinkData, jikouNodeId } from './jikou-links.ts';

const [dataset, history, outDir] = process.argv.slice(2);
if (!dataset || !history || !outDir) throw new Error('usage: jikou-links-cli.ts <dataset> <historyDataset> <outDir>');
const d = buildJikouLinkData(dataset, history);
const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n\r]/u.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (header: string[], rows: unknown[][]): string => [header, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'jikou-nodes.csv'), toCsv(
  ['jikou_id', 'year', 'account', 'ministry', 'special_account', 'sub_account', 'org', 'item_code', 'item_name', 'name', 'budget_k', 'prev_k', 'revised_k', 'run_years'],
  d.nodes.map((n, i) => [jikouNodeId(n), n.year, n.account, n.ministry, n.specialAccount, n.subAccount, n.org, n.itemCode, n.itemName, n.name, n.budget ?? '', n.prev ?? '', n.revised ?? '', d.runs[i]]),
));
fs.writeFileSync(path.join(outDir, 'jikou-links.csv'), toCsv(
  ['from_jikou_id', 'to_jikou_id', 'evidence', 'amount', 'status'],
  d.links.map(l => [l.from < 0 ? '' : jikouNodeId(d.nodes[l.from]!), l.to < 0 ? '' : jikouNodeId(d.nodes[l.to]!), l.evidence.join(';'), l.amount, l.status]),
));
// 件数: 年度の組 × 会計 × 状態、同じ鍵・根拠別
const pairs: Record<string, Record<string, number>> = {};
for (const l of d.links) {
  const n = l.to >= 0 ? d.nodes[l.to]! : d.nodes[l.from]!;
  const y1 = l.to >= 0 ? n.year : n.year + 1;
  const key = `${y1 - 1}→${y1}|${n.account}`;
  const p = (pairs[key] ??= {});
  const tag = l.status === 'UNRESOLVED' ? (l.from < 0 ? 'unresolved_to' : 'unresolved_from') : l.evidence.includes('same_key') ? 'same_key' : l.status === 'RESOLVED' ? 'resolved_other' : 'ambiguous';
  p[tag] = (p[tag] ?? 0) + 1;
}
const runDist: Record<string, Record<string, number>> = {};
d.nodes.forEach((n, i) => { const k = `${n.year}|${n.account}`; const m = (runDist[k] ??= {}); m[String(d.runs[i])] = (m[String(d.runs[i])] ?? 0) + 1; });
fs.writeFileSync(path.join(outDir, 'jikou-links-summary.json'), JSON.stringify({ years: d.years, nodes: d.nodes.length, links: d.links.length, revisedCount: d.revisedCount, pairs, runLengthByYear: runDist }, null, 1) + '\n');
console.log(`nodes ${d.nodes.length}, links ${d.links.length}`);
