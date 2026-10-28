import { useEffect, useState } from 'react';
import type { SiteAbout } from '@nihon-no-yosan/core';
import { PageNavMenu } from './components/PageNavMenu.tsx';
import { loadJson } from './data.ts';

const REPO = 'https://github.com/igomuni/nihon-no-yosan';

/** 出典と利用条件。画面の表示は、PDL1.0（公共データ利用規約 第1.0版）の「出典の記載」と「加工したことの記載」に合わせる */
export function AboutPage() {
  const [about, setAbout] = useState<SiteAbout | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadJson<SiteAbout>('about.json')
      .then(d => { if (alive) setAbout(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);
  const diet = about?.authorities.filter(a => a.status === 'diet-courts') ?? [];
  const pdl = about?.authorities.filter(a => a.status === 'pdl1.0') ?? [];
  const link = 'text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400';
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-start justify-between gap-3 px-3 pb-2 pt-3">
        <h1 className="text-base font-semibold">出典と利用条件</h1>
        <PageNavMenu current="about" />
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-12 text-sm leading-relaxed">
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">出典と加工</h2>
          <p>
            出典: 各府省・機関の歳出概算要求書、財務省「予算書・決算書データベース」（
            <a className={link} href="https://www.bb.mof.go.jp/" target="_blank" rel="noopener noreferrer">https://www.bb.mof.go.jp/</a>
            ）を加工して作成。
          </p>
          <p>
            このサイトの数値・表は、上の資料から読み取って、名前の揃え方・つなぎ方（項・事項・目）を決めて作った加工物です。国や各府省・機関が作成した、加工していない情報ではありません。
            読み取りやつなぎの誤りが含まれる可能性があります。金額は、各資料の原本（PDF の該当頁へのリンクを各画面に付けています）で確かめてください。
          </p>
          <p>
            加工の方法と、データの作り方は
            <a className={link} href={REPO} target="_blank" rel="noopener noreferrer">リポジトリ</a>
            に公開しています（コードは MIT ライセンス）。
          </p>
        </section>
        {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">一覧を読み込めませんでした: {error}</p>}
        {about && (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">利用条件（公共データ利用規約 第1.0版）</h2>
              <p>
                次の機関の資料は、各機関のサイトの利用規約により、
                <a className={link} href="https://www.digital.go.jp/resources/open_data/public_data_license_v1.0" target="_blank" rel="noopener noreferrer">公共データ利用規約（第1.0版）（PDL1.0）</a>
                に準拠した条件で利用できます。出典を記載し、加工したことを記載しています。
              </p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                {pdl.map(a => (
                  <li key={a.domain}>
                    <a className={link} href={a.termsUrl} target="_blank" rel="noopener noreferrer">{a.authority}</a>
                    <span className="ml-1 text-neutral-500">（{a.books} 書）</span>
                  </li>
                ))}
                <li>
                  <a className={link} href={about.budgetBook.termsUrl} target="_blank" rel="noopener noreferrer">{about.budgetBook.authority}</a>
                  <span className="ml-1 text-neutral-500">（予算書）</span>
                </li>
              </ul>
            </section>
            {diet.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="font-semibold">国会・裁判所の資料</h2>
                <p>
                  次の機関の規約は、著作権法で認められた利用（私的使用・引用など）に限ります。このサイトには、これらの資料から、名前・コード・金額・頁を表にしたものを載せています。
                  文章としての表現は載せていません。権利者の意向があれば取り下げます。
                </p>
                <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {diet.map(a => (
                    <li key={a.domain}>
                      <a className={link} href={a.termsUrl} target="_blank" rel="noopener noreferrer">{a.authority}</a>
                      <span className="ml-1 text-neutral-500">（{a.books} 書）</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {about.rs && (
              <section className="flex flex-col gap-2">
                <h2 className="font-semibold">行政事業レビュー（RS）</h2>
                <p>
                  出典: 行政事業レビュー見える化サイト（
                  <a className={link} href="https://rssystem.go.jp" target="_blank" rel="noopener noreferrer">https://rssystem.go.jp</a>
                  ）の CSV（レビューシート）を加工して作成。「RS」の画面の事業の一覧・予算額・執行額と、予算書の項・目へのつなぎは、このサイトの数値を読み取り、名前でそろえて作った加工物です。国や府省庁が作成した、加工していない情報ではありません。
                </p>
                <p>
                  利用条件は
                  <a className={link} href={about.rs.termsUrl} target="_blank" rel="noopener noreferrer">{about.rs.authority}の利用規約</a>
                  （PDL1.0 に準拠）。事業 {about.rs.jigyo.toLocaleString()} 件、予算年度 FY{about.rs.years[0]}〜FY{about.rs.years[about.rs.years.length - 1]}。RS の事業数はシートの数で、予算事業の数と一致しないことがあります。RS の合計は、予算書・決算書の数値と必ずしも一致しません。
                </p>
              </section>
            )}
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">取り込んだ資料</h2>
              <p>基準データ {about.dataset.version}: 概算要求書 {about.dataset.books} 書（FY2023〜FY2027）と、予算書の CSV。</p>
              <p className="text-neutral-500">利用条件を確認できていない機関（会計検査院・裁判官訴追委員会）の資料は、取り込んでいません。</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
