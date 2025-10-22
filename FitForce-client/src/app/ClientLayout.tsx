'use client';

import { ReactNode } from 'react';
import ProviderWrapper from './ProviderWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
import { usePerformanceMonitor } from '@/components/PerformanceMonitor';
import { useMetaPixel } from '@/hooks/useMetaPixel';

// Client component for performance monitoring and Meta Pixel
export default function ClientLayout({ children }: { children: ReactNode }) {
  usePerformanceMonitor();
  useMetaPixel(); // Initialize Meta Pixel on all pages
  
  return (
    <ErrorBoundary>
      <ProviderWrapper>
        {children}
      </ProviderWrapper>
    </ErrorBoundary>
  );
}

