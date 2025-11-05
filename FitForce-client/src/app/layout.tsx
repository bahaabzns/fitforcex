import { ReactNode } from 'react';
import Script from 'next/script';
import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';
import PixelTracker from './PixelTracker';
import { FB_PIXEL_ID } from '@/lib/fbPixel';

export const metadata: Metadata = {
  title: 'FitForce',
  description: 'FitForce - Training, Nutrition, Clients. All-in-one fitness platform.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === 'production' && (
          <>
            <Script id="fb-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${FB_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img height="1" width="1" style={{ display: 'none' }} src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`} alt="" />
            </noscript>
          </>
        )}
      </head>
      <body>
        {process.env.NODE_ENV === 'production' && <PixelTracker />}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
