'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export default function MetaPixelScript() {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
  const hasValidPixelId = pixelId && /^\d{15,16}$/.test(pixelId);

  useEffect(() => {
    if (!hasValidPixelId && typeof window !== 'undefined') {
      console.warn('⚠️ Meta Pixel: NEXT_PUBLIC_FB_PIXEL_ID is not set or invalid. Pixel will not load.');
    }
  }, [hasValidPixelId]);

  if (!hasValidPixelId) {
    return null;
  }

  return (
    <>
      {/* Meta Pixel Code - Using Next.js Script for reliable loading */}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== 'undefined' && (window as any).fbq) {
            console.log('✅ Meta Pixel loaded successfully');
          }
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

