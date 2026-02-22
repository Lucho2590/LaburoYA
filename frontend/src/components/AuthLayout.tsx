'use client';

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen theme-bg-primary md:flex md:items-center md:justify-center md:p-4">
      <div className="w-full md:max-w-md md:rounded-2xl md:theme-bg-secondary md:shadow-xl md:border md:theme-border">
        {children}
      </div>
    </div>
  );
}
