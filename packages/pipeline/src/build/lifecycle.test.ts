import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildLifecycle, requestOnlyFromRequestKou, type LifecycleRequestOnlyRow, type LifecycleSource } from './lifecycle.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

// 入力の置き場は年度と同じ名前のディレクトリ（本番の設定は `LIFECYCLE_SOURCES`）
const YEARS = [2023, 2024];
const SOURCES: LifecycleSource[] = YEARS.map(year => ({ year, budget: String(year), supp: { general: String(year), special: String(year) }, settle: { general: String(year), special: String(year) } }));
const AMT = '令和5年度要求額(千円)の合計';
const SETTLE_HEAD = '歳出予算額(円)の合計,前年度繰越額(円)の合計,予備費使用額(円)の合計,流用等増△減額(円)の合計,予算決定後移替増△減額(円)の合計,歳出予算現額(円)の合計,支出済歳出額(円)の合計,翌年度繰越額(円)の合計,不用額(円)の合計';
const HOSEI_HEAD = '令和5年度成立予算額(千円)の合計,補正要求追加額(千円)の合計,補正要求修正減少額(千円)の合計,補正要求差引額(千円)の合計,改令和5年度予算額(千円)の合計';
const G = '所管,組織,項コード,項名,目の行数';
const S = '所管,特別会計,勘定,項コード,項名,共管所管名,共管組織名,目の行数';

function write(year: number, file: string, text: string): void {
  const dir = path.join(tmp, 'mof-archive', String(year));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
}
for (const y of YEARS) {
  // 一般会計: 項 010（政府案・補正・決算）、020（決算にだけある）。決算 010 の歳出予算額 = 改予算額 × 1000
  write(y, 'kou-general.csv', `${G},${AMT},前年度予算額(千円)の合計\n内閣府,本府,010,共通費,3,100,90\n`);
  write(y, 'kou-general-hosei.csv', `${G},${HOSEI_HEAD}\n内閣府,本府,010,共通費,1,100,10,-4,6,106\n`);
  write(y, 'kou-general-kessan.csv', `${G},${SETTLE_HEAD}\n内閣府,本府,010,共通費,3,106000,0,0,0,0,106000,100000,0,6000\n内閣府,本府,020,新しい項,1,50,0,0,0,0,50,50,0,0\n`);
  // 特別会計: 決算で同じ鍵の行が共管の組織ごとに複数
  write(y, 'kou-special.csv', `${S},${AMT},前年度予算額(千円)の合計\n内閣府,復興,,601,復興費,国,A,1,10,9\n`);
  write(y, 'kou-special-hosei.csv', `${S},${HOSEI_HEAD.replace('補正要求', '補正予定')}\n内閣府,復興,,601,復興費,国,A,1,10,0,0,0,10\n`);
  write(y, 'kou-special-kessan.csv', `${S},${SETTLE_HEAD.replace('流用等', '予算総則の規定による経費増額(円)の合計,流用等')}\n内閣府,復興,,601,復興費,国,甲,1,6000,0,0,0,0,0,6000,6000,0,0\n内閣府,復興,,601,復興費,国,乙,1,4000,0,0,0,0,0,4000,3000,1000,0\n`);
}
const request = new Map([[`${YEARS[0]}|kou-general:1`, { req: 95, reqPrev: 88, merged: false }]]);

describe('buildLifecycle', () => {
  const r = buildLifecycle({ datasetDir: tmp, requestOfMofRow: request, sources: SOURCES });
  const y = YEARS[0]!;

  it('takes the union of the three stages as the 項 and records the stages each 項 is in', () => {
    const general = r.kous.filter(k => k.year === y && k.account === 'general');
    expect(general.map(k => [k.code, k.name, k.seenIn.join(',')])).toEqual([
      ['010', '共通費', 'request,budget,supp,settle'],
      ['020', '新しい項', 'settle'],
    ]);
  });

  it('keeps both the original value (string, unit) and the value in yen, and marks the 項 amounts as derived from the 目', () => {
    const k = r.kous.findIndex(x => x.year === y && x.account === 'general' && x.code === '010');
    const row = r.events.find(e => e[0] === k && e[5] === 'budget_amount')!;
    expect(row.slice(1)).toEqual(['budget', 'submitted', '', '', 'budget_amount', '100', '千円', 100000, 'derived', 'kou-general.csv:1', '目の合計（目の行 3）']);
    const settle = r.events.find(e => e[0] === k && e[5] === 'spent')!;
    expect(settle.slice(6, 9)).toEqual(['100000', '円', 100000]);
    expect(r.events.find(e => e[0] === k && e[5] === 'request_amount')!.slice(6, 10)).toEqual(['95', '千円', 95000, 'original']);
  });

  it('does not make a row for a stage a 項 is not in (no zero filling)', () => {
    const k = r.kous.findIndex(x => x.year === y && x.account === 'general' && x.code === '020');
    expect(new Set(r.events.filter(e => e[0] === k).map(e => e[1]))).toEqual(new Set(['settle']));
  });

  it('splits a 特別会計 settlement by the co-managing organisation instead of adding the rows', () => {
    const k = r.kous.findIndex(x => x.year === y && x.account === 'special');
    expect(r.kous.filter(x => x.year === y && x.account === 'special')).toHaveLength(1);
    const parts = r.events.filter(e => e[0] === k && e[5] === 'appropriation').map(e => [e[4], e[8]]);
    expect(parts).toEqual([['国|甲', 6000], ['国|乙', 4000]]);
  });

  it('counts the identities and the cross-stage equalities', () => {
    const c = (name: string, account: string) => r.checks.find(x => x.year === y && x.account === account && x.name === name);
    expect(c('supp_identity', 'general')).toMatchObject({ ok: 1, ng: 0 });
    expect(c('settle_current', 'general')).toMatchObject({ ok: 2, ng: 0 });
    expect(c('settle_unused', 'general')).toMatchObject({ ok: 2, ng: 0 });
    expect(c('enacted_eq_budget', 'general')).toMatchObject({ ok: 1, ng: 0 });
    expect(c('settle_eq_revised', 'general')).toMatchObject({ ok: 1, ng: 0 });
  });

  it('writes the difference between the 政府案 and the request as a derived value', () => {
    const k = r.kous.findIndex(x => x.year === y && x.account === 'general' && x.code === '010');
    expect(r.events.find(e => e[0] === k && e[5] === 'assessment_gap')!.slice(8, 10)).toEqual([5000, 'derived']);
  });

  describe('with a request-only 項', () => {
    const row = (o: Partial<LifecycleRequestOnlyRow>): LifecycleRequestOnlyRow => ({ y, kind: 'reqOnly', acct: 0, grp: '内閣府', min: '内閣府', sub: '', org: '本府', name: '要求だけの項', req: 70, reqPrev: 60, multiBook: false, ...o });
    const rr = buildLifecycle({ datasetDir: tmp, requestOfMofRow: request, sources: SOURCES, requestOnlyRows: [row({}), row({ kind: 'zero', name: '額0の項', req: 0, reqPrev: 0 }), row({ name: '額が読めない項', req: null })] });

    it('adds the 項 with only the request stage, keeps a request of 0 as a value, and skips a row without an amount', () => {
      const only = rr.kous.filter(k => k.requestOnly !== undefined && k.year === y);
      expect(only.map(k => [k.name, k.code, k.seenIn.join(','), k.requestOnly])).toEqual([['要求だけの項', '', 'request', 'reqOnly'], ['額0の項', '', 'request', 'zero']]);
      const i = rr.kous.findIndex(k => k.name === '額0の項');
      expect(rr.events.filter(e => e[0] === i).map(e => [e[1], e[5], e[8], e[9]])).toEqual([['request', 'request_amount', 0, 'original'], ['request', 'request_prev', 0, 'original']]);
    });

    it('does not change the 項 built from the 予算書', () => {
      expect(rr.kous.filter(k => k.requestOnly === undefined)).toEqual(r.kous);
    });
  });

  describe('years without a 予算書 or a settlement', () => {
    it('builds a year with no 予算書 only from the request documents, and keeps the stages the sources do not have out of the data', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test2-'));
      try {
        fs.mkdirSync(path.join(dir, 'mof-archive', 'v'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'mof-archive', 'v', 'kou-general.csv'), `${G},${AMT},前年度予算額(千円)の合計\n内閣府,本府,010,共通費,3,100,90\n`);
        fs.writeFileSync(path.join(dir, 'mof-archive', 'v', 'kou-special.csv'), `${S},${AMT},前年度予算額(千円)の合計\n`);
        const sources: LifecycleSource[] = [{ year: 2025, budget: 'v', supp: {}, settle: {} }, { year: 2027, budget: null, supp: {}, settle: {} }];
        const rows = requestOnlyFromRequestKou(
          [
            { request_name: '共通費', acct: 'general', ministry: '内閣府', org: '本府', account: '', sub: '', request_amount: '120', previous_amount: '100' },
            { request_name: '共通費', acct: 'general', ministry: '内閣府', org: '本府', account: '', sub: '', request_amount: '90', previous_amount: '100' },
            { request_name: '特会の項', acct: 'special', ministry: '財務省', org: '', account: '年金', sub: '基礎', request_amount: '0', previous_amount: '' },
          ],
          2027,
        );
        const d = buildLifecycle({ datasetDir: dir, requestOfMofRow: new Map(), requestOnlyRows: rows, sources });
        expect(d.kous.map(k => [k.year, k.account, k.name, k.requestOnly ?? '', k.seenIn.join(',')])).toEqual([
          [2025, 'general', '共通費', '', 'budget'],
          [2027, 'general', '共通費', 'noBudget', 'request'],
          [2027, 'special', '特会の項', 'noBudget', 'request'],
        ]);
        // 同じ項が複数の書に載るときは、最も大きい額。読めない前年度予算額は、行を作らない（0 にしない）
        expect(d.events.filter(e => e[1] === 'request').map(e => [e[0], e[5], e[8]])).toEqual([[1, 'request_amount', 120000], [1, 'request_prev', 100000], [2, 'request_amount', 0]]);
        expect(d.events.some(e => e[1] === 'supp' || e[1] === 'settle')).toBe(false);
        // 概算要求だけの年度の前年度予算額（要求書の値）で、前の年度の政府案の額と比べる
        expect(d.links.filter(l => l.from >= 0 && l.to >= 0).map(l => [l.evidence.join(';'), l.amount])).toEqual([['same_name_other_code;prev_amount_eq_budget', 'eq_budget']]);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
