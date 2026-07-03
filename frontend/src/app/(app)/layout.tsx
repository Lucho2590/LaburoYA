'use client';

import { ReactNode } from 'react';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { CvAnalysisProvider } from '@/contexts/CvAnalysisContext';
import { AppShell } from '@/components/AppShell';
import { CvAnalysisWidget } from '@/components/CvAnalysisWidget';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PageTitleProvider>
      <CvAnalysisProvider>
        <AppShell>
          {children}
        </AppShell>
        <CvAnalysisWidget />
      </CvAnalysisProvider>
    </PageTitleProvider>
  );
}
