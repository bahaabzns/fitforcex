'use client';

import { ReactNode, useEffect } from 'react';
import { initMetaPixel } from '@/lib/pixel';

type Props = {
  children: ReactNode;
};

export default function PixelProvider({ children }: Props) {
  useEffect(() => {
    // Initialize with auto PageView so the pixel runs with just the Pixel ID
    initMetaPixel({ autoPageView: true });
  }, []);

  return <>{children}</>;
}


