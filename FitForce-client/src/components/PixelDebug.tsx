'use client';

import { useEffect } from 'react';

/**
 * Debug component to verify pixel is loaded
 * Only renders in development mode
 */
export default function PixelDebug() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const checkPixel = () => {
        const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
        const hasFbq = typeof window !== 'undefined' && typeof (window as any).fbq === 'function';
        
        console.log('🔍 Meta Pixel Debug:', {
          pixelId: pixelId || 'NOT SET',
          pixelIdValid: pixelId ? /^\d{15,16}$/.test(pixelId) : false,
          fbqExists: hasFbq,
          windowFbq: typeof window !== 'undefined' ? (window as any).fbq : 'N/A'
        });

        if (!pixelId) {
          console.error('❌ NEXT_PUBLIC_FB_PIXEL_ID is not set in environment variables!');
        } else if (!/^\d{15,16}$/.test(pixelId)) {
          console.error('❌ NEXT_PUBLIC_FB_PIXEL_ID is invalid! Should be 15-16 digits.');
        } else if (!hasFbq) {
          console.warn('⚠️ Pixel ID is set but fbq function is not available yet. Pixel may still be loading...');
        } else {
          console.log('✅ Meta Pixel appears to be loaded correctly!');
        }
      };

      // Check immediately
      checkPixel();
      
      // Check again after a delay (in case pixel loads asynchronously)
      const timeout = setTimeout(checkPixel, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, []);

  return null;
}

