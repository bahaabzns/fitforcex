'use client';

import { ReactNode, useEffect } from 'react';
import { initMetaPixel } from '@/lib/pixel';

type Props = {
  children: ReactNode;
};

export default function PixelProvider({ children }: Props) {
  useEffect(() => {
    // Initialize Meta Pixel - this reads NEXT_PUBLIC_FB_PIXEL_ID at runtime
    // This is the same approach that worked in previous versions
    initMetaPixel({ autoPageView: true });
  }, []);

  return <>{children}</>;
}


