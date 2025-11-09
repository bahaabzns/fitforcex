import { ReactNode } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import ClientLayout from './ClientLayout';
import PixelProvider from './PixelProvider';

const alexandria = localFont({
  src: '../../public/assets/fonts/Alexandria,Baloo_Bhaijaan_2,Changa/Alexandria/Alexandria-VariableFont_wght.ttf',
  display: 'swap',
  variable: '--font-alexandria'
});

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
    <html lang="en" className={alexandria.variable}>
      <head></head>
      <body className={alexandria.className}>
        <PixelProvider>
          <ClientLayout>{children}</ClientLayout>
        </PixelProvider>
      </body>
    </html>
  );
}
