import { useEffect, useState } from 'react';
import { AboutPage } from './AboutPage.tsx';
import type { PageId } from './components/PageNavMenu.tsx';
import { MofPage } from './mof/MofPage.tsx';
import { TrendPage } from './trend/TrendPage.tsx';

/** `#/trend`（既定）、`#/mof`、`#/about` */
const pageOf = (): PageId => (window.location.hash === '#/mof' ? 'mof' : window.location.hash === '#/about' ? 'about' : 'trend');

export function App() {
  const [page, setPage] = useState<PageId>(pageOf);
  useEffect(() => {
    const onHash = () => setPage(pageOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page === 'mof' ? <MofPage /> : page === 'about' ? <AboutPage /> : <TrendPage />;
}
