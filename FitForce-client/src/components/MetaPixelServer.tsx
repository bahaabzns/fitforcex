import Script from 'next/script';

/**
 * Server-rendered Meta Pixel Script component
 * Uses beforeInteractive to ensure script is in head for immediate execution
 * This ensures the pixel code is in the initial HTML for Meta Pixel Helper detection
 */
export function MetaPixelScript() {
  // Try to get pixel ID from environment
  // In Next.js server components, process.env is available at runtime
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
  const hasValidPixelId = pixelId && /^\d{15,16}$/.test(pixelId);

  if (!hasValidPixelId) {
    // Log for debugging (only in server-side, won't show in browser)
    if (typeof window === 'undefined') {
      console.warn('[Meta Pixel] NEXT_PUBLIC_FB_PIXEL_ID not set or invalid:', pixelId || '(empty)');
    }
    return null;
  }

  return (
    <Script
      id="meta-pixel-server"
      strategy="beforeInteractive"
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
  );
}

/**
 * Server-rendered Meta Pixel Noscript component (for body)
 * MUST be in body for Meta Pixel Helper to detect it
 */
export function MetaPixelNoscript() {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
  const hasValidPixelId = pixelId && /^\d{15,16}$/.test(pixelId);

  if (!hasValidPixelId) {
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

