'use client';

import { ReactNode, useEffect } from 'react';
import { initMetaPixel } from '@/lib/pixel';

type Props = {
  children: ReactNode;
};

export default function PixelProvider({ children }: Props) {
  useEffect(() => {
    // Check if pixel is already initialized by MetaPixelScript
    // If not, initialize it (fallback for cases where script hasn't loaded)
    if (typeof window !== 'undefined' && !window.fbq) {
      // Pixel script should be loaded by MetaPixelScript component
      // But we'll initialize as fallback if needed
      initMetaPixel({ autoPageView: false }); // Don't track PageView again, already done by script
    }
  }, []);

  return <>{children}</>;
}


