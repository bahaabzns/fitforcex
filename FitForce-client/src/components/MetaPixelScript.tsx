'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function MetaPixelScript() {
  const [pixelId, setPixelId] = useState<string>('');
  const [hasValidPixelId, setHasValidPixelId] = useState(false);

  useEffect(() => {
    // Try to get pixel ID from environment (available at runtime)
    const envPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
    const isValid = envPixelId && /^\d{15,16}$/.test(envPixelId);
    
    setPixelId(envPixelId);
    setHasValidPixelId(isValid);

    if (!isValid && typeof window !== 'undefined') {
      console.error('❌ Meta Pixel Error: NEXT_PUBLIC_FB_PIXEL_ID is not set or invalid!');
      console.error('   Current value:', envPixelId || '(empty)');
      console.error('   Expected: 15-16 digit number');
      console.error('   Please set NEXT_PUBLIC_FB_PIXEL_ID in your environment variables and rebuild.');
    }
  }, []);

  if (!hasValidPixelId || !pixelId) {
    return (
      <div style={{ display: 'none' }} data-pixel-error="NEXT_PUBLIC_FB_PIXEL_ID not set">
        {/* Hidden element for debugging */}
      </div>
    );
  }

  return (
    <>
      {/* Meta Pixel Code - Using Next.js Script for reliable loading */}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== 'undefined') {
            if ((window as any).fbq) {
              console.log('✅ Meta Pixel loaded successfully');
              console.log('   Pixel ID:', pixelId);
            } else {
              console.error('❌ Meta Pixel script loaded but fbq function not available');
            }
          }
        }}
        onError={(e) => {
          console.error('❌ Meta Pixel script failed to load:', e);
        }}
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      {/* Noscript fallback for pixel detection - must be in body */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

