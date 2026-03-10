'use client';

import { ReactNode } from 'react';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { AppShell } from '@/components/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PageTitleProvider>
      <AppShell>
        {children}
      </AppShell>
    </PageTitleProvider>
  );
}
