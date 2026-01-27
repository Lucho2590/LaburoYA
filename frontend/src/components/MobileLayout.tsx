'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  hideNav?: boolean;
}

export function MobileLayout({
  children,
  title,
  showBack = false,
  backHref = '/home',
  hideNav = false
}: MobileLayoutProps) {
  const pathname = usePathname();
  const { userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isWorker = userData?.role === 'worker';

  const navItems = [
    {
      href: '/home',
      label: 'Inicio',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#E10600]' : 'theme-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/matches',
      label: 'Matches',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#E10600]' : 'theme-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/chats',
      label: 'Chats',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#E10600]' : 'theme-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      href: isWorker ? '/worker/profile' : '/employer/profile',
      label: 'Perfil',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#E10600]' : 'theme-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  // Add jobs tab for employers
  if (!isWorker && userData?.role === 'employer') {
    navItems.splice(2, 0, {
      href: '/employer/jobs',
      label: 'Ofertas',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#E10600]' : 'theme-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    });
  }

  return (
    <div className="min-h-screen theme-bg-primary flex flex-col">
      {/* Header */}
      <header className="theme-bg-secondary border-b theme-border sticky top-0 z-40 safe-area-top">
        <div className="flex items-center justify-between px-4 h-14">
          {showBack ? (
            <Link href={backHref} className="p-2 -ml-2 touch-manipulation">
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          ) : (
            <span className="text-xl font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent">LaburoYA</span>
          )}

          {title && (
            <h1 className="text-lg font-semibold theme-text-primary absolute left-1/2 -translate-x-1/2">
              {title}
            </h1>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg theme-bg-card active:scale-95 transition-transform"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-[#FFB703]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[#667085]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 theme-bg-secondary border-t theme-border safe-area-bottom z-50">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center flex-1 h-full touch-manipulation active:opacity-70"
                >
                  {item.icon(isActive)}
                  <span className={`text-xs mt-1 ${isActive ? 'text-[#E10600] font-medium' : 'theme-text-muted'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
