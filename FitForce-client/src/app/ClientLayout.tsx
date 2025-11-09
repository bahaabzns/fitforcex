'use client';

import { ReactNode } from 'react';
import ProviderWrapper from './ProviderWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
import { usePerformanceMonitor } from '@/components/PerformanceMonitor';

// Client component for performance monitoring and Meta Pixel
export default function ClientLayout({ children }: { children: ReactNode }) {
  // PerformanceMonitor now checks NODE_ENV internally and skips in dev mode
  // This improves dev server performance by avoiding heavy monitoring overhead
  usePerformanceMonitor();
  // Meta Pixel is initialized globally via PixelProvider in layout.tsx
  
  return (
    <ErrorBoundary>
      <ProviderWrapper>
        {children}
      </ProviderWrapper>
    </ErrorBoundary>
  );
}

