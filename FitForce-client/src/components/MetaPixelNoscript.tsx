'use client';

import { useEffect, useState } from 'react';

/**
 * Noscript fallback for Meta Pixel
 * This is required for Meta's pixel helper to detect the pixel
 */
export default function MetaPixelNoscript() {
  const [pixelId, setPixelId] = useState<string>('');

  useEffect(() => {
    // Get pixel ID at runtime (works even if not available at build time)
    const id = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
    if (id && /^\d{15,16}$/.test(id)) {
      setPixelId(id);
    }
  }, []);

  if (!pixelId) {
    return null;
  }

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}



