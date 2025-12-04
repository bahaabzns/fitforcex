'use client';

import { ReactNode, useEffect } from 'react';
import { initMetaPixel } from '@/lib/pixel';

type Props = {
  children: ReactNode;
};

export default function PixelProvider({ children }: Props) {
  useEffect(() => {
    // Fallback initialization: Only initialize if pixel wasn't already loaded
    // The main pixel script is now in layout.tsx head for better detection
    // This ensures pixel works even if the head script didn't load
    if (typeof window !== 'undefined' && !window.fbq) {
      initMetaPixel({ autoPageView: false }); // Don't auto-track PageView as it's already in head script
    }
  }, []);

  return <>{children}</>;
}


