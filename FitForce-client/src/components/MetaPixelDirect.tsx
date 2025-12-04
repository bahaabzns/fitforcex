import Script from 'next/script';

/**
 * Direct Meta Pixel injection component
 * This component injects the pixel code directly into the HTML
 * Works regardless of build-time vs runtime env vars
 */

const PIXEL_ID = '748502508209787'; // Direct pixel ID for production

export function MetaPixelDirectScript() {
  // Try env var first, fallback to hardcoded for production
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || PIXEL_ID;
  const hasValidPixelId = pixelId && /^\d{15,16}$/.test(pixelId);

  if (!hasValidPixelId) {
    return null;
  }

  return (
    <>
      {/* Use Script component with beforeInteractive for head injection */}
      <Script
        id="meta-pixel-direct"
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
    </>
  );
}

export function MetaPixelDirectNoscript() {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || PIXEL_ID;
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

