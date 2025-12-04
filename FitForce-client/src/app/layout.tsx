import { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';
import PixelProvider from './PixelProvider';
import MetaPixelScript from '@/components/MetaPixelScript';
import PixelDebug from '@/components/PixelDebug';

export const metadata: Metadata = {
  title: 'FitForce',
  description: 'FitForce - Training, Nutrition, Clients. All-in-one fitness platform.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg'
  }
};

// Get pixel ID for server-side rendering
const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';

export default function RootLayout({ children }: { children: ReactNode }) {
  const hasValidPixelId = pixelId && /^\d{15,16}$/.test(pixelId);

  return (
    <html lang="en">
      <head>
        {/* Match landing-page font loading so mobile uses Alexandria webfont */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* Meta Pixel Code - Directly in head for detection by Meta's pixel helper */}
        {hasValidPixelId && (
          <script
            id="meta-pixel-init"
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
        )}
      </head>
      <body>
        {/* Meta Pixel noscript - Must be in body for Next.js App Router */}
        {hasValidPixelId && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        {/* Meta Pixel Script - Backup using Next.js Script component */}
        <MetaPixelScript />
        {/* Debug component - only in development */}
        <PixelDebug />
        <PixelProvider>
          <ClientLayout>{children}</ClientLayout>
        </PixelProvider>
      </body>
    </html>
  );
}
