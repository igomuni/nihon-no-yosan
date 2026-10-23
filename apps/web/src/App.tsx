import { useEffect, useState } from 'react';
import { AboutPage } from './AboutPage.tsx';
import type { PageId } from './components/PageNavMenu.tsx';
import { LifecyclePage } from './lifecycle/LifecyclePage.tsx';
import { MofPage } from './mof/MofPage.tsx';
import { TrendPage } from './trend/TrendPage.tsx';

/** `#/trend`（既定）、`#/mof`、`#/lifecycle`、`#/about` */
const pageOf = (): PageId => {
  const h = window.location.hash;
  return h === '#/mof' ? 'mof' : h === '#/lifecycle' ? 'lifecycle' : h === '#/about' ? 'about' : 'trend';
};

export function App() {
  const [page, setPage] = useState<PageId>(pageOf);
  useEffect(() => {
    const onHash = () => setPage(pageOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page === 'mof' ? <MofPage /> : page === 'lifecycle' ? <LifecyclePage /> : page === 'about' ? <AboutPage /> : <TrendPage />;
}
