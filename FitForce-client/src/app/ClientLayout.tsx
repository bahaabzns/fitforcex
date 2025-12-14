'use client';

import { ReactNode, useEffect } from 'react';
import ProviderWrapper from './ProviderWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
import { usePerformanceMonitor } from '@/components/PerformanceMonitor';

// Client component for performance monitoring and Meta Pixel
export default function ClientLayout({ children }: { children: ReactNode }) {
  // PerformanceMonitor now checks NODE_ENV internally and skips in dev mode
  // This improves dev server performance by avoiding heavy monitoring overhead
  usePerformanceMonitor();
  // Meta Pixel is initialized globally via PixelProvider in layout.tsx

  // Override window.open to block non-fitforce.io URLs
  // This must be in useEffect to avoid server-side rendering issues
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const originalWindowOpen = window.open;

    window.open = (url: string | URL | undefined, target?: string | Window | undefined, features?: string | undefined) => {
      if (url) {
        // Convert URL object to string if needed
        const urlString = typeof url === 'string' ? url : url.toString();
        
        if (urlString.includes('fitforce.io')) {
          return originalWindowOpen.call(window, url, target, features);
        }
      }

      console.warn('Blocked window.open to', url);
      return null;
    };

    // Cleanup: restore original window.open on unmount
    return () => {
      window.open = originalWindowOpen;
    };
  }, []);
  
  return (
    <ErrorBoundary>
      <ProviderWrapper>
        {children}
      </ProviderWrapper>
    </ErrorBoundary>
  );
}

