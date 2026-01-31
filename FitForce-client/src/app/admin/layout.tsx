'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext';
import Loader from '@/components/Loader';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import adminTheme from '@/theme/adminTheme';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { PageTitleSetter } from '@/components/PageTitleSetter';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoading) return;

    // If on login page and already authenticated, redirect to admin home
    if (isLoginPage) {
      if (isAuthenticated) router.replace('/admin');
      return;
    }

    // For protected admin routes, redirect unauthenticated users to login
    if (!isAuthenticated) {
      router.replace('/admin/login');
    }
  }, [isAuthenticated, isLoading, isLoginPage, router]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Loader />
      </div>
    );
  }

  // Allow rendering the login page without protection
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';

  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <AdminAuthProvider>
        <PageTitleSetter />
        {!isLoginPage && (
          <Box sx={{ px: { xs: 2, md: 4 }, pt: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton aria-label="Back" onClick={() => router.back()}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="overline" color="text.secondary">Admin</Typography>
            </Stack>
          </Box>
        )}
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </AdminAuthProvider>
    </ThemeProvider>
  );
}
