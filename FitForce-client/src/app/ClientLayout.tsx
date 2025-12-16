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

  // Override window.open with a configurable block list (fixes global block on all non-fitforce.io URLs)
  // This must be in useEffect to avoid server-side rendering issues
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const originalWindowOpen = window.open;
    const blockedDomains =
      (process.env.NEXT_PUBLIC_BLOCKED_WINDOW_OPEN_DOMAINS || '')
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
    const allowedProtocols = ['http:', 'https:', 'about:', 'blob:', 'data:'];

    window.open = (
      url: string | URL | undefined,
      target?: string | Window | undefined,
      features?: string | undefined
    ) => {
      if (!url) {
        return originalWindowOpen.call(window, url as any, target as any, features);
      }

      // Convert URL object to string if needed
      const urlString = typeof url === 'string' ? url : url.toString();

      try {
        const parsedUrl = new URL(urlString, window.location.href); // supports relative URLs
        const hostname = parsedUrl.hostname.toLowerCase();
        const protocol = parsedUrl.protocol;

        const isBlockedDomain = blockedDomains.some(
          (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
        );

        const isAllowedProtocol = allowedProtocols.includes(protocol);

        if (isBlockedDomain) {
          console.warn('Blocked window.open to blocked domain', hostname);
          return null;
        }

        if (!isAllowedProtocol) {
          console.warn('Blocked window.open due to protocol', protocol);
          return null;
        }

        return originalWindowOpen.call(window, parsedUrl.href, target as any, features);
      } catch (error) {
        // If URL parsing fails, fail open rather than breaking legitimate flows
        console.warn('window.open URL parse failed, allowing by default', url);
        return originalWindowOpen.call(window, url as any, target as any, features);
      }
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

