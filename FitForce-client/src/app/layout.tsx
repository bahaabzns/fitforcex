import { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';
import PixelProvider from './PixelProvider';

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
      </head>
      <body>
        <PixelProvider>
          <ClientLayout>{children}</ClientLayout>
        </PixelProvider>
      </body>
    </html>
  );
}
