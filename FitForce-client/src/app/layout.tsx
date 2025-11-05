import { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';
import PixelTracker from './PixelTracker';

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
        {/* Meta Pixel is initialized via useMetaPixel hook in ClientLayout */}
      </head>
      <body>
        <PixelTracker />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
