import { useEffect, useState } from 'react';
import type { BudgetRequestTrendData } from '@nihon-no-yosan/core';
import { loadGzJson } from './data.ts';

export function App() {
  const [trend, setTrend] = useState<BudgetRequestTrendData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadGzJson<BudgetRequestTrendData>('trend/kou.json.gz').then(setTrend, (e: unknown) => setError(String(e)));
  }, []);
  return (
    <main>
      <h1>日本の予算</h1>
      <p>概算要求から当初予算・補正予算・決算までをつないで見る。画面は準備中。</p>
      {error && <p>データを読めません: {error}（<code>npm run build:data</code> で作る）</p>}
      {trend && <p>年度推移（項）: {trend.rows.length} 行</p>}
    </main>
  );
}
