/**
 * 公開サイトが配る JSON の、列名の無い配列（タプル）の列の定義。仕様: docs/guides/ai-access.md
 *
 * データ自身に `columns` として添える（`web-data-cli.ts`）。目録（`data/index.json`）にも載る。列の並びは、データの型（`LifecycleMokuNode` など）と同じ。
 * 並びを変えたときは、ここも変える（ビルドが、全行の長さと列の数を照合して、合わなければ止まる）。
 */
import { JIKOU_AMOUNT, JIKOU_EVIDENCE } from './lifecycle-jikou.ts';
import { MOKU_FLAG } from './lifecycle-moku.ts';
import { LIFECYCLE_MEASURES } from './lifecycle.ts';

export interface DataColumn {
  name: string;
  /** `number`・`string`。値が無いことがあるときは `| null` */
  type: string;
  /** 額の単位（千円・円）。額でない列は無し */
  unit?: string;
  description: string;
  /** 取りうる値（文字列の列で、決まっているとき） */
  values?: readonly string[];
  /** 取りうる値の名前（`values` の日本語名） */
  valueLabels?: Record<string, string>;
  /** ビットの列（立てるビットの値） */
  bits?: Record<string, number>;
}

const col = (name: string, type: string, description: string, extra: Partial<DataColumn> = {}): DataColumn => ({ name, type, description, ...extra });

/** ファイルのパス（`data/` から）→ キー → 列。タプルの配列だけ */
export const DATA_COLUMNS: Record<string, Record<string, DataColumn[]>> = {
  'lifecycle/data.json.gz': {
    events: [
      col('kou', 'number', '項の添字（kous の配列の位置）'),
      col('event', 'string', '出来事', { values: ['request', 'budget', 'supp', 'settle', 'derived'], valueLabels: { request: '概算要求', budget: '政府案（当初予算）', supp: '補正（成立と補正後を含む）', settle: '決算', derived: '導出した値' } }),
      col('version', 'string', '版（政府案は提出時 submitted。判定できないときは unconfirmed。空のことがある）'),
      col('seq', 'string', '同じ種類の出来事の順（補正の号など）。原本に号が無いときは空'),
      col('part', 'string', '決算の特別会計で、同じ項が共管の組織ごとに行を分けるときの組織（共管所管名|共管組織名）。それ以外は空'),
      col('measure', 'string', '項目', { values: Object.keys(LIFECYCLE_MEASURES), valueLabels: Object.fromEntries(Object.entries(LIFECYCLE_MEASURES).map(([k, m]) => [k, `${m.label}（原本の単位: ${m.unit}）`])) }),
      col('value', 'string', '原本の値（文字列のまま）。導出の行は、原本の値でなく、導出した値'),
      col('unit', 'string', '原本の単位（千円・円）'),
      col('yen', 'number', '円に直した値（整数）', { unit: '円' }),
      col('state', 'string', '状態', { values: ['original', 'derived'], valueLabels: { original: '原本の値', derived: '導出した値（項の金額は目の合計）' } }),
      col('source', 'string', '入力ファイル名と行。導出の場合は、元の行'),
      col('note', 'string', '導出の場合は、導出の元（目の合計 など）'),
    ],
  },
  'lifecycle/jikou.json.gz': {
    nodes: [
      col('kou', 'number', '項の添字（kous の配列の位置）'),
      col('year', 'number', '年度（西暦）'),
      col('name', 'string', '事項名'),
      col('budget', 'number | null', '政府案（当初予算）の額', { unit: '千円' }),
      col('prev', 'number | null', '予算書の前年度予算額', { unit: '千円' }),
      col('revised', 'number | null', '補正後の額（補正の事項の記録がある事項だけ）', { unit: '千円' }),
      col('suppNet', 'number | null', '補正の差引額', { unit: '千円' }),
      col('request', 'number | null', '概算要求の要求額', { unit: '千円' }),
      col('major', 'string', '主要経費別の分類コード（予算書の事項の表の列。概算要求にだけある事項は、要求書の事項コードの後ろ半分。読めなければ空）。名前は lifecycle/codes.json.gz'),
    ],
    links: [
      col('from', 'number', '前の年度の事項（nodes の添字）'),
      col('to', 'number', '次の年度の事項（nodes の添字）'),
      col('evidence', 'number', '対応の根拠（ビット）', { bits: Object.fromEntries(JIKOU_EVIDENCE.map((e, i) => [e, 1 << i])) }),
      col('amount', 'number', '額の確認（下の values の添字）', { values: JIKOU_AMOUNT }),
    ],
  },
  'lifecycle/moku.json.gz': {
    nodes: [
      col('kou', 'number', '項の添字（kous の配列の位置）'),
      col('year', 'number', '年度（西暦）'),
      col('name', 'string', '目名'),
      col('codes', 'string', '分類コード（`|` でつなぐ。一般会計は 主要経費別|目的別|財政法|経済性質別|使途別、特別会計は 主要経費別|目的別|経済性質別|使途別。概算要求書にだけある目は、読めないと空）'),
      col('part', 'string', '決算の共管別の行の共管（共管所管名|共管組織名。同じ共管が重なると #番号）。それ以外は空'),
      col('budget', 'number | null', '政府案（当初予算）の額', { unit: '千円' }),
      col('revised', 'number | null', '補正後の額（補正に目の個別の行があるときだけ。「外N目」にまとめられた目は値なし）', { unit: '千円' }),
      col('suppNet', 'number | null', '補正の差引額', { unit: '千円' }),
      col('current', 'number | null', '歳出予算現額（決算。原本は円なので千円に直した値で、小数がありうる）', { unit: '千円' }),
      col('spent', 'number | null', '支出済歳出額（決算）', { unit: '千円' }),
      col('carried', 'number | null', '翌年度繰越額（決算）', { unit: '千円' }),
      col('unused', 'number | null', '不用額（決算）', { unit: '千円' }),
      col('request', 'number | null', '概算要求の要求額', { unit: '千円' }),
      col('flags', 'number', '状態（ビット）', { bits: { ...MOKU_FLAG } }),
      col('carriedIn', 'number | null', '前年度繰越額（決算）', { unit: '千円' }),
    ],
    requestCoverage: [
      col('kou', 'number', '項の添字（kous の配列の位置）'),
      col('coverage', 'string', '概算要求の目の取れ方', { values: ['full', 'partial', 'none', 'noReq'], valueLabels: { full: '全部の目で、概算要求と予算書の両方がある', partial: '概算要求か予算書の片方にしか無い目がある', none: '概算要求の目が 1 つも無い', noReq: '概算要求書の明細が読めていない' } }),
    ],
  },
  'rs/jigyo.json.gz': {
    jigyo: [
      col('id', 'string', '予算事業 ID'),
      col('name', 'string', '事業名'),
      col('ministry', 'string', '府省庁'),
      col('bureau', 'string', '局・庁'),
      col('major', 'string', '主要経費（複数は `|` でつなぐ。空のことがある）'),
    ],
    amounts: [
      col('jigyo', 'number', '事業の添字（jigyo の配列の位置）'),
      col('year', 'number', '予算年度（西暦）'),
      col('initial', 'number | null', '当初予算', { unit: '円' }),
      col('supp', 'number | null', '補正予算', { unit: '円' }),
      col('carryIn', 'number | null', '前年度からの繰越し', { unit: '円' }),
      col('reserve', 'number | null', '予備費等', { unit: '円' }),
      col('current', 'number | null', '歳出予算現額', { unit: '円' }),
      col('spent', 'number | null', '執行額', { unit: '円' }),
      col('carryOut', 'number | null', '翌年度への繰越し', { unit: '円' }),
      col('request', 'number | null', '翌年度要求額', { unit: '円' }),
    ],
    links: [
      col('jigyo', 'number', '事業の添字（jigyo の配列の位置）'),
      col('year', 'number', '予算年度（西暦）'),
      col('kou', 'number', '項の添字（このファイルの kous の配列の位置）'),
      col('moku', 'string', 'RS の歳出予算項目の目名（空のことがある）'),
      col('kind', 'string', '予算種別（当初予算・第1次補正予算・前年度から繰越し・予備費等1 など。空のことがある）'),
      col('yen', 'number | null', '予算額（歳出予算項目ごと）', { unit: '円' }),
    ],
  },
};
