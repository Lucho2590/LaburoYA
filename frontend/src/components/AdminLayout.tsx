'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AppRole } from '@/types';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userData, loading, signOut, setSecondaryRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [changingRole, setChangingRole] = useState(false);

  const isSuperuser = userData?.role === 'superuser';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user && userData?.role !== 'superuser') {
      router.push('/home');
    }
  }, [loading, user, userData, router]);

  if (loading || !isSuperuser) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const navItems = [
    {
      href: '/sudo',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: '/sudo/users',
      label: 'Usuarios',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      href: '/sudo/jobs',
      label: 'Ofertas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: '/sudo/matches',
      label: 'Matches',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleSecondaryRoleChange = async (role: AppRole) => {
    setChangingRole(true);
    try {
      await setSecondaryRole(role);
    } catch (error) {
      console.error('Error changing secondary role:', error);
    } finally {
      setChangingRole(false);
    }
  };

  return (
    <div className="min-h-screen theme-bg-primary flex">
      {/* Sidebar */}
      <aside className="w-64 theme-bg-secondary border-r theme-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b theme-border">
          <Link href="/sudo" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#E10600]">LaburoYA</span>
            <span className="text-xs px-2 py-1 bg-[#E10600] text-white rounded-full font-medium">
              Admin
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/sudo' && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#E10600] text-white'
                        : 'theme-text-secondary hover:theme-bg-card'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t theme-border">
          {/* Secondary Role Selector */}
          <div className="px-4 py-3 mb-3 theme-bg-card rounded-lg">
            <label className="block text-xs theme-text-muted mb-2">Mi rol en la app</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleSecondaryRoleChange('worker')}
                disabled={changingRole}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  userData?.secondaryRole === 'worker'
                    ? 'bg-blue-500 text-white'
                    : 'theme-bg-secondary theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Trabajador
              </button>
              <button
                onClick={() => handleSecondaryRoleChange('employer')}
                disabled={changingRole}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  userData?.secondaryRole === 'employer'
                    ? 'bg-green-500 text-white'
                    : 'theme-bg-secondary theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Empleador
              </button>
            </div>
            {userData?.secondaryRole && (
              <Link
                href="/home"
                className="block mt-2 text-center text-xs text-[#E10600] hover:underline"
              >
                Ir a la app como {userData.secondaryRole === 'worker' ? 'trabajador' : 'empleador'}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-[#E10600] rounded-full flex items-center justify-center text-white font-medium">
              {userData?.email?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium theme-text-primary truncate">
                {userData?.email || 'Superuser'}
              </p>
              <p className="text-xs theme-text-muted">Superuser</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2 text-[#667085] hover:text-[#E10600] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm">Cerrar sesion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 theme-bg-secondary border-b theme-border flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold theme-text-primary">
            {title || 'Panel de Administracion'}
          </h1>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg theme-bg-card hover:opacity-80 transition-opacity"
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

            {/* Back to App */}
            <Link
              href="/home"
              className="text-sm theme-text-secondary hover:theme-text-primary transition-colors"
            >
              Volver a la app
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
