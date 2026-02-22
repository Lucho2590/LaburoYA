'use client';

import { ReactNode, useState, useEffect } from 'react';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  hideNav?: boolean;
}

export function AppLayout({
  children,
  title,
  showBack = false,
  backHref = '/home',
  onBack,
  hideNav = false,
}: AppLayoutProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    // Check initial
    checkIsDesktop();

    // Listen for resize
    window.addEventListener('resize', checkIsDesktop);

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Avoid hydration mismatch - render mobile first on server
  if (!mounted) {
    return (
      <MobileLayout
        title={title}
        showBack={showBack}
        backHref={backHref}
        onBack={onBack}
        hideNav={hideNav}
      >
        {children}
      </MobileLayout>
    );
  }

  if (isDesktop) {
    return (
      <DesktopLayout
        title={title}
        showBack={showBack}
        backHref={backHref}
        onBack={onBack}
      >
        {children}
      </DesktopLayout>
    );
  }

  return (
    <MobileLayout
      title={title}
      showBack={showBack}
      backHref={backHref}
      onBack={onBack}
      hideNav={hideNav}
    >
      {children}
    </MobileLayout>
  );
}
