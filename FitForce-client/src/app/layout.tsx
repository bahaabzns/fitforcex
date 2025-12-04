import { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';
import PixelProvider from './PixelProvider';
import { MetaPixelDirectScript, MetaPixelDirectNoscript } from '@/components/MetaPixelDirect';

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
  // Debug: Check if server can read env vars (only runs on server, logs to dokku logs)
  if (typeof window === 'undefined') {
    const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
    console.log('[Meta Pixel Debug] NEXT_PUBLIC_FB_PIXEL_ID:', pixelId || '(NOT SET)');
    console.log('[Meta Pixel Debug] All NEXT_PUBLIC_* vars:', 
      Object.keys(process.env)
        .filter(k => k.startsWith('NEXT_PUBLIC_'))
        .reduce((acc, k) => ({ ...acc, [k]: process.env[k] }), {})
    );
  }

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
        {/* Preconnect to Facebook for faster pixel loading */}
        <link rel="preconnect" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        
        {/* Meta Pixel Script - Direct injection in head for immediate detection */}
        <MetaPixelDirectScript />
      </head>
      <body>
        {/* Meta Pixel noscript - MUST be in body for Meta Pixel Helper detection */}
        <MetaPixelDirectNoscript />
        <PixelProvider>
          <ClientLayout>{children}</ClientLayout>
        </PixelProvider>
      </body>
    </html>
  );
}
