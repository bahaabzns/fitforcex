import { ReactNode } from 'react';

import type { Metadata } from 'next';

import './globals.css';

// project-imports
import ProviderWrapper from './ProviderWrapper';

export const metadata: Metadata = {
  title: 'Able Pro Material UI Next JS Dashboard Template',
  description:
    'Able Pro React Admin Template, built with Material UI, React, and React Router, offers a modern UI, seamless performance, and powerful customization for any web application.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProviderWrapper>{children}</ProviderWrapper>
      </body>
    </html>
  );
}
