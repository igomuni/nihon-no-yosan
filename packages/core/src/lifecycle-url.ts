/**
 * 予算の推移の画面（`#/lifecycle`）の状態を、URL のハッシュ（`#/lifecycle?view=moku&year=2024&use=1`）に書き出す・読み込む。純粋な関数。仕様: docs/guides/ai-access.md
 *
 * 目的: 画面の状態（タブ・年度・フィルタ・選んだ行）を、URL で共有・再現できるようにする（AI・人が、結果を引用・再現できる）。
 * - 書き出すのは、既定と違う値だけ。URL に何かあるときは、**それが状態のすべて**（書かれていない項目は既定。ブラウザに保存した前回の状態は使わない）。
 * - 読み込むとき、知らないパラメーター・不正な値は無視して、既定にする（落とさない）。並べ替えは、URL に入れない（合計・件数は変わらない）。
 */
import { INITIAL_LIFECYCLE_FILTERS, type LifecycleFilters } from './lifecycle-list.ts';
import { LIFECYCLE_PATTERNS } from './lifecycle-status.ts';
import { INITIAL_RS_FILTERS, type RsFilters } from './rs.ts';

export type LifecycleView = 'list' | 'jikou' | 'moku' | 'rs';
export const LIFECYCLE_VIEWS: readonly LifecycleView[] = ['list', 'jikou', 'moku', 'rs'];

export interface LifecycleUrlState {
  view: LifecycleView;
  /** 年度（西暦）。無ければ null（既定の年度） */
  year: number | null;
  filters: LifecycleFilters;
  rsFilters: RsFilters;
  /** 選んだ行（見ているタブのもの。項は項の id、事項は `${項の id}|${事項名}`、目は `${項の id}|${目の識別}`、RS は予算事業 ID）。無ければ null */
  selected: string | null;
}

/** クエリ文字列の読み書き（core は DOM に頼らない）。同じ名前を繰り返せる */
class Query {
  private readonly pairs: [string, string][] = [];
  static parse(query: string): Query {
    const q = new Query();
    for (const part of query.split('&')) {
      if (part === '') continue;
      const i = part.indexOf('=');
      const dec = (x: string): string => { try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch { return x; } };
      q.pairs.push([dec(i < 0 ? part : part.slice(0, i)), i < 0 ? '' : dec(part.slice(i + 1))]);
    }
    return q;
  }
  set(k: string, v: string): void { const at = this.pairs.findIndex(p => p[0] === k); if (at >= 0) this.pairs[at]![1] = v; else this.pairs.push([k, v]); }
  append(k: string, v: string): void { this.pairs.push([k, v]); }
  get(k: string): string | null { return this.pairs.find(p => p[0] === k)?.[1] ?? null; }
  getAll(k: string): string[] { return this.pairs.filter(p => p[0] === k).map(p => p[1]); }
  toString(): string { return this.pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); }
}

export const INITIAL_LIFECYCLE_URL_STATE: LifecycleUrlState = { view: 'list', year: null, filters: INITIAL_LIFECYCLE_FILTERS, rsFilters: INITIAL_RS_FILTERS, selected: null };

const TEXT_FILTERS = [['org', 'orgRegex', 'org'], ['name', 'nameRegex', 'name'], ['jikou', 'jikouNameRegex', 'jikouName'], ['moku', 'mokuNameRegex', 'mokuName']] as const;
const LIST_FILTERS = [['publisher', 'publishers'], ['group', 'groups'], ['acct', 'accts'], ['major', 'majors'], ['use', 'uses']] as const;

/** ハッシュの後ろ（`?` の次）に付ける文字列。既定と違う値だけ。何も無ければ空 */
export function encodeLifecycleUrl(s: LifecycleUrlState): string {
  const p = new Query();
  if (s.view !== 'list') p.set('view', s.view);
  if (s.year !== null) p.set('year', String(s.year));
  if (s.selected !== null && s.selected !== '') p.set('sel', s.selected);
  if (s.view === 'rs') {
    const f = s.rsFilters;
    for (const m of f.ministries) p.append('ministry', m);
    if (f.bureau !== '') p.set('bureau', f.bureau);
    if (f.bureauRegex) p.set('bureau_re', '1');
    if (f.name !== '') p.set('name', f.name);
    if (f.nameRegex) p.set('name_re', '1');
    if (f.link !== 'all') p.set('link', f.link);
  } else {
    const f = s.filters;
    for (const [param, key] of LIST_FILTERS) for (const v of f[key]) p.append(param, v);
    for (const [param, reKey, key] of TEXT_FILTERS) {
      if (f[key] !== '') p.set(param, f[key]);
      if (f[reKey]) p.set(`${param}_re`, '1');
    }
    if (f.pattern !== 'all') p.set('pattern', f.pattern);
    if (f.links !== 'all') p.set('links', f.links);
  }
  return p.toString();
}

/** `#/lifecycle?...` から状態を読む。`#/lifecycle` に `?` 以降が無いとき（別のページのとき）は null（保存した状態を使う） */
export function decodeLifecycleUrl(hash: string): LifecycleUrlState | null {
  const [path, query] = [hash.split('?')[0], hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''];
  if (path !== '#/lifecycle' || query === '') return null;
  const p = Query.parse(query);
  const view = LIFECYCLE_VIEWS.find(v => v === p.get('view')) ?? 'list';
  const year = /^\d{4}$/.test(p.get('year') ?? '') ? Number(p.get('year')) : null;
  const flag = (k: string): boolean => p.get(k) === '1';
  const filters: LifecycleFilters = { ...INITIAL_LIFECYCLE_FILTERS };
  const rsFilters: RsFilters = { ...INITIAL_RS_FILTERS };
  if (view === 'rs') {
    rsFilters.ministries = p.getAll('ministry');
    rsFilters.bureau = p.get('bureau') ?? '';
    rsFilters.bureauRegex = flag('bureau_re');
    rsFilters.name = p.get('name') ?? '';
    rsFilters.nameRegex = flag('name_re');
    rsFilters.link = (['all', 'linked', 'unlinked'] as const).find(v => v === p.get('link')) ?? 'all';
  } else {
    for (const [param, key] of LIST_FILTERS) filters[key] = p.getAll(param);
    for (const [param, reKey, key] of TEXT_FILTERS) { filters[key] = p.get(param) ?? ''; filters[reKey] = flag(`${param}_re`); }
    filters.pattern = LIFECYCLE_PATTERNS.find(x => x.id === p.get('pattern'))?.id ?? 'all';
    filters.links = p.get('links') === 'unsettled' ? 'unsettled' : 'all';
  }
  const sel = p.get('sel');
  return { view, year, filters, rsFilters, selected: sel === null || sel === '' ? null : sel };
}
