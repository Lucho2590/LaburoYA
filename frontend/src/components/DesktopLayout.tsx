'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationBell } from '@/components/NotificationBell';

interface DesktopLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
}

export function DesktopLayout({
  children,
  title,
  showBack = false,
  backHref = '/home',
  onBack,
}: DesktopLayoutProps) {
  const pathname = usePathname();
  const { userData, getEffectiveAppRole, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const effectiveRole = getEffectiveAppRole();
  const isWorker = effectiveRole === 'worker';
  const isSuperuser = userData?.role === 'superuser';

  const navItems = [
    {
      href: '/home',
      label: 'Inicio',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/discover',
      label: isWorker ? 'Ofertas' : 'Candidatos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      href: '/matches',
      label: 'Matches',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/chats',
      label: 'Chats',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      href: isWorker ? '/worker/profile' : '/employer/profile',
      label: 'Perfil',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  // Add jobs tab for employers
  if (!isWorker && effectiveRole === 'employer') {
    navItems.splice(2, 0, {
      href: '/employer/jobs',
      label: 'Ofertas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    });
  }

  return (
    <div className="min-h-screen theme-bg-primary flex">
      {/* Sidebar */}
      <aside className="w-64 theme-bg-secondary border-r theme-border flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b theme-border">
          <Link href="/home" className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent">
              LaburoYA
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#E10600]/10 text-[#E10600]'
                    : 'theme-text-secondary hover:theme-bg-card'
                }`}
              >
                {item.icon}
                <span className={`font-medium ${isActive ? 'text-[#E10600]' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Admin link for superusers */}
          {isSuperuser && (
            <Link
              href="/sudo"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                pathname.startsWith('/sudo')
                  ? 'bg-[#E10600]/10 text-[#E10600]'
                  : 'theme-text-secondary hover:theme-bg-card'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">Admin</span>
            </Link>
          )}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t theme-border space-y-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl theme-text-secondary hover:theme-bg-card transition-all"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-[#FFB703]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            <span className="font-medium">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="theme-bg-secondary border-b theme-border sticky top-0 z-40">
          <div className="flex items-center justify-between px-8 h-16">
            <div className="flex items-center gap-4">
              {showBack && (
                onBack ? (
                  <button onClick={onBack} className="p-2 -ml-2 hover:theme-bg-card rounded-lg transition-colors">
                    <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                ) : (
                  <Link href={backHref} className="p-2 -ml-2 hover:theme-bg-card rounded-lg transition-colors">
                    <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                )
              )}
              {title && (
                <h1 className="text-xl font-semibold theme-text-primary">{title}</h1>
              )}
            </div>

            {/* User info */}
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell />

              <span className="theme-text-secondary text-sm">
                {userData?.nickname || userData?.firstName || userData?.email}
              </span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] flex items-center justify-center text-white text-sm font-medium">
                {(userData?.firstName?.[0] || userData?.email?.[0] || '?').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
