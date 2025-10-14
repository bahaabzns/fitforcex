'use client';

import { ReactNode } from 'react';
import ProviderWrapper from './ProviderWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
import { usePerformanceMonitor } from '@/components/PerformanceMonitor';

// Client component for performance monitoring
export default function ClientLayout({ children }: { children: ReactNode }) {
  usePerformanceMonitor();
  
  return (
    <ErrorBoundary>
      <ProviderWrapper>
        {children}
      </ProviderWrapper>
    </ErrorBoundary>
  );
}

