/**
 * RS の支出先の CSV（5-1・5-2・5-3・5-4）で、個人名の可能性がある名前を伏せる。仕様: docs/guides/rs-spend.md
 *
 * 規則: 法人番号が空、または 9 だけの行の支出先名は、次のどれかに当たるものだけ残し、ほかは置き換える。
 *   (1) 集計を示す語を含む  (2) 府省庁・都道府県の名前と完全に一致する  (3) 外国の組織を示す英語の語を含む
 *   (4) 組織・集計を示す語で終わる  (5) 同じ名前が、法人番号のある行にも出てくる
 * 置き換えた名前は、ほかの自由記述の列にも出てくれば、その部分を置き換える（3 字以上で、出現が 20 回未満のものだけ）。
 * 法人番号がない行の所在地は、置き換える。
 */
import type { Rec } from './csv.ts';

/** 置き換えた箇所に入れる文字 */
export const REDACT_MARK = '非表示（個人名の可能性あり）';

export type SpendKey = '5-1' | '5-2' | '5-3' | '5-4';
export const SPEND_KEYS: readonly SpendKey[] = ['5-1', '5-2', '5-3', '5-4'];

/** 支出先名・法人番号・所在地の列（5-2 は名前の列がない） */
const NAME_COLS: Partial<Record<SpendKey, { name: string; corp: string; addr: string[] }>> = {
  '5-1': { name: '支出先名', corp: '法人番号', addr: ['所在地'] },
  '5-3': { name: '支出先名', corp: '法人番号', addr: [] },
  '5-4': { name: '契約先名(国庫債務負担行為等による契約)', corp: '契約先の法人番号(国庫債務負担行為等による契約)', addr: ['契約先の所在地(国庫債務負担行為等による契約)'] },
};

/** 名前が書かれうる自由記述の列 */
const FREE_COLS: Record<SpendKey, string[]> = {
  '5-1': ['支出先ブロック名', '事業を行う上での役割', '契約概要', '具体的な契約方式等', 'その他の契約', '一者応札・一者応募又は競争性のない随意契約となった理由及び改善策(支出額10億円以上)', 'その他支出先'],
  '5-2': ['支出元の支出先ブロック名', '支出先の支出先ブロック名', '資金の流れの補足情報', '国自らが支出する間接経費の項目'],
  '5-3': ['契約概要', '費目', '使途'],
  '5-4': ['契約概要(契約名)(国庫債務負担行為等による契約)', 'その他の契約', 'その他の契約(国庫債務負担行為等による契約)', '具体的な契約方式等(国庫債務負担行為等による契約)', '一者応札・一者応募又は競争性のない随意契約となった理由及び改善策(契約額10億円以上)(国庫債務負担行為等による契約)'],
};

/** 集計を示す語 */
const AGGREGATE = /受給者|被保険者|患者|生徒|学生|児童|世帯|国民|職員|従業員|労働者|事業者|利用者|申請者|対象者|その他|まとめ|各種|多数|個人$|個人（|個人\(/;
/** 組織・集計を示す語で終わる（かっこで終わるものも） */
const ORG_END = /(等|ほか|など|局|省|庁|機関|借入金|返済|経費|事業所|事務所|支局|支店|営業所|出張所|本部|本社|工場|団体|法人|会社|大学|学校|病院|機構|協会|組合|連合|政府|軍|共同体|連盟|企業体|JV)[)）]?$/;
/** 外国の組織を示す英語の語（語として単独で出てくるもの。前後が文字・数字・_ のときは当たらない） */
const FOREIGN_ORG = /(?<![\p{L}\p{N}_])(Inc|Ltd|Corp|Corporation|LLC|Co|Company|University|Bank|Organization|Organisation|Association|Foundation|Institute|Ministry|Agency|Programme|Program|Fund|Council|Union|Nations|Commission|GmbH|Limited)(?![\p{L}\p{N}_])/iu;
const PREFECTURES = new Set(
  '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' '),
);

/** 自由記述の列に 20 回以上出る名前は、「ほか」「旅費」のような一般の語とみなして、自由記述の置き換えに使わない */
export const GENERIC_FREQUENCY = 20;
/** 自由記述の置き換えに使う名前の最小の長さ */
export const FREE_MIN_LENGTH = 3;

/** 法人番号がない（空、または 9 だけ） */
export function hasNoCorpNumber(corp: string | undefined): boolean {
  const t = (corp ?? '').trim();
  return t === '' || /^9+$/.test(t);
}

export interface SpendRedactReport {
  marker: string;
  maskedDistinctNames: number;
  freeTextNamesExcludedAsGeneric: number;
  freeTextNamesUsed: number;
  corpNamesKeptByRule5: number;
  keptDistinctNamesWithoutCorpNumber: number;
  keptRowsWithoutCorpNumber: number;
  stat: Record<string, { rows: number; nameMaskedRows: number; addrMasked: number; freeCellsChanged: number; freeReplacements: number }>;
}

export interface SpendRedaction {
  /** 5-1・5-2・5-3・5-4 の行を、伏せた行にする（元の行は変えない） */
  tables: Record<SpendKey, Rec[]>;
  report: SpendRedactReport;
  /** 法人番号がなく、置き換えずに残した名前と行数（多い順。確認用） */
  keptNames: [string, number][];
}

/** 4 つの表を読み、伏せる名前を決めて、伏せた表を返す */
export function redactSpend(input: Record<SpendKey, readonly Rec[]>): SpendRedaction {
  const trim = (s: string | undefined): string => (s ?? '').trim();
  const ministries = new Set<string>();
  for (const k of SPEND_KEYS) for (const r of input[k]) if (r['府省庁']) ministries.add(trim(r['府省庁']));

  const corpNames = new Set<string>();
  for (const k of ['5-1', '5-3', '5-4'] as const) {
    const c = NAME_COLS[k]!;
    for (const r of input[k]) {
      const n = trim(r[c.name]);
      if (n && !hasNoCorpNumber(r[c.corp])) corpNames.add(n);
    }
  }
  const keep = (n: string): boolean =>
    AGGREGATE.test(n) || ministries.has(n) || PREFECTURES.has(n) || FOREIGN_ORG.test(n) || ORG_END.test(n) || corpNames.has(n);

  const masked = new Set<string>();
  const kept = new Map<string, number>();
  for (const k of ['5-1', '5-3', '5-4'] as const) {
    const c = NAME_COLS[k]!;
    for (const r of input[k]) {
      const n = trim(r[c.name]);
      if (!n || !hasNoCorpNumber(r[c.corp])) continue;
      if (keep(n)) kept.set(n, (kept.get(n) ?? 0) + 1);
      else masked.add(n);
    }
  }

  // 自由記述の置き換えに使う名前（長い順。出現が多い語は除く）
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cand = [...masked].filter(n => [...n].length >= FREE_MIN_LENGTH).sort((a, b) => [...b].length - [...a].length);
  const freq = new Map<string, number>();
  if (cand.length > 0) {
    const pat0 = new RegExp(cand.map(esc).join('|'), 'g');
    for (const k of SPEND_KEYS) {
      for (const r of input[k]) for (const col of FREE_COLS[k]) for (const m of (r[col] ?? '').matchAll(pat0)) freq.set(m[0], (freq.get(m[0]) ?? 0) + 1);
    }
  }
  const generic = cand.filter(n => (freq.get(n) ?? 0) >= GENERIC_FREQUENCY);
  const genericSet = new Set(generic);
  const names = cand.filter(n => !genericSet.has(n));
  const pat = names.length > 0 ? new RegExp(names.map(esc).join('|'), 'g') : null;

  const stat: SpendRedactReport['stat'] = {};
  const tables = {} as Record<SpendKey, Rec[]>;
  for (const k of SPEND_KEYS) {
    const s = (stat[k] = { rows: 0, nameMaskedRows: 0, addrMasked: 0, freeCellsChanged: 0, freeReplacements: 0 });
    const c = NAME_COLS[k];
    tables[k] = input[k].map(src => {
      const row: Rec = { ...src };
      s.rows++;
      if (c && hasNoCorpNumber(row[c.corp])) {
        const n = trim(row[c.name]);
        if (n && masked.has(n)) {
          row[c.name] = REDACT_MARK;
          s.nameMaskedRows++;
        }
        for (const a of c.addr)
          if (trim(row[a])) {
            row[a] = REDACT_MARK;
            s.addrMasked++;
          }
      }
      for (const col of FREE_COLS[k]) {
        const v = row[col] ?? '';
        if (!v || !pat) continue;
        let n = 0;
        const nv = v.replace(pat, () => (n++, REDACT_MARK));
        if (n > 0) {
          row[col] = nv;
          s.freeCellsChanged++;
          s.freeReplacements += n;
        }
      }
      return row;
    });
  }
  const keptNames = [...kept].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return {
    tables,
    keptNames,
    report: {
      marker: REDACT_MARK,
      maskedDistinctNames: masked.size,
      freeTextNamesExcludedAsGeneric: generic.length,
      freeTextNamesUsed: names.length,
      corpNamesKeptByRule5: corpNames.size,
      keptDistinctNamesWithoutCorpNumber: kept.size,
      keptRowsWithoutCorpNumber: [...kept.values()].reduce((a, b) => a + b, 0),
      stat,
    },
  };
}
