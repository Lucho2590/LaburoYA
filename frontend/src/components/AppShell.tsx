'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, sessionReady } = useAuth();
  const router = useRouter();

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

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (sessionReady && !user) {
      router.push('/');
    }
  }, [sessionReady, user, router]);

  // Solo esperamos a que Firebase resuelva la sesión (~100ms). NO esperamos a
  // /auth/me: el shell se renderiza con el cache optimista de userData y el
  // perfil (nombre/avatar) se completa en background.
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // If not authenticated, don't render the app (will redirect)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // Avoid hydration mismatch - render mobile first on server
  if (!mounted) {
    return (
      <MobileLayout useContext>
        {children}
      </MobileLayout>
    );
  }

  if (isDesktop) {
    return (
      <DesktopLayout useContext>
        {children}
      </DesktopLayout>
    );
  }

  return (
    <MobileLayout useContext>
      {children}
    </MobileLayout>
  );
}
