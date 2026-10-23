import { useEffect, useState } from 'react';
import type { PageId } from './components/PageNavMenu.tsx';
import { MofPage } from './mof/MofPage.tsx';
import { TrendPage } from './trend/TrendPage.tsx';

/** `#/trend`（既定）、`#/mof` */
const pageOf = (): PageId => (window.location.hash === '#/mof' ? 'mof' : 'trend');

export function App() {
  const [page, setPage] = useState<PageId>(pageOf);
  useEffect(() => {
    const onHash = () => setPage(pageOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page === 'mof' ? <MofPage /> : <TrendPage />;
}
