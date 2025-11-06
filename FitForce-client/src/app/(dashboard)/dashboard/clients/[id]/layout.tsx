'use client';

import { ReactNode } from 'react';
import ClientLoginLink from '@/components/clients/ClientLoginLink';
import { Box } from '@mui/material';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ClientLoginLink />
      <Box sx={{ pt: 7 }}>{children}</Box>
    </>
  );
}
