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

  // Override window.open and guard normal link clicks with a configurable block list.
  // This must be in useEffect to avoid server-side rendering issues.
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

    const isBlockedUrl = (urlString: string) => {
      try {
        const parsedUrl = new URL(urlString, window.location.href); // supports relative URLs
        const hostname = parsedUrl.hostname.toLowerCase();
        const protocol = parsedUrl.protocol;

        const isBlockedDomain = blockedDomains.some(
          (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
        );

        const isAllowedProtocol = allowedProtocols.includes(protocol);

        return {
          blockedDomain: isBlockedDomain,
          allowedProtocol: isAllowedProtocol,
          parsedHref: parsedUrl.href,
          hostname,
          protocol,
        };
      } catch {
        // If URL parsing fails, fail open rather than breaking legitimate flows
        return {
          blockedDomain: false,
          allowedProtocol: true,
          parsedHref: urlString,
          hostname: '',
          protocol: '',
        };
      }
    };

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

      const { blockedDomain, allowedProtocol, parsedHref, hostname, protocol } =
        isBlockedUrl(urlString);

      if (blockedDomain) {
        console.warn('Blocked window.open to blocked domain', hostname);
        return null;
      }

      if (!allowedProtocol) {
        console.warn('Blocked window.open due to protocol', protocol);
        return null;
      }

      return originalWindowOpen.call(window, parsedHref, target as any, features);
    };

    // Extra hardening: prevent normal <a> clicks from navigating to blocked domains.
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;

      const { blockedDomain, allowedProtocol, hostname, protocol } = isBlockedUrl(
        anchor.href
      );

      if (blockedDomain || !allowedProtocol) {
        console.warn(
          'Blocked navigation via link click',
          JSON.stringify({ hostname, protocol })
        );
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('click', clickHandler, true);

    // Cleanup: restore original window.open on unmount
    return () => {
      window.open = originalWindowOpen;
      document.removeEventListener('click', clickHandler, true);
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

