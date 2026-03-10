'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PageTitleContextValue {
  title: string;
  showBack: boolean;
  backHref: string;
  onBack?: () => void;
  hideNav: boolean;
  setPageConfig: (config: {
    title?: string;
    showBack?: boolean;
    backHref?: string;
    onBack?: () => void;
    hideNav?: boolean;
  }) => void;
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [showBack, setShowBack] = useState(false);
  const [backHref, setBackHref] = useState('/home');
  const [onBack, setOnBack] = useState<(() => void) | undefined>(undefined);
  const [hideNav, setHideNav] = useState(false);

  const setPageConfig = useCallback((config: {
    title?: string;
    showBack?: boolean;
    backHref?: string;
    onBack?: () => void;
    hideNav?: boolean;
  }) => {
    if (config.title !== undefined) setTitle(config.title);
    if (config.showBack !== undefined) setShowBack(config.showBack);
    if (config.backHref !== undefined) setBackHref(config.backHref);
    if (config.onBack !== undefined) setOnBack(() => config.onBack);
    if (config.hideNav !== undefined) setHideNav(config.hideNav);
  }, []);

  return (
    <PageTitleContext.Provider
      value={{
        title,
        showBack,
        backHref,
        onBack,
        hideNav,
        setPageConfig,
      }}
    >
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error('usePageTitle must be used within PageTitleProvider');
  }
  return context;
}
