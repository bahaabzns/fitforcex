'use client';

import { useEffect, ReactNode } from 'react';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project-imports
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import HorizontalBar from './Drawer/HorizontalBar';
import Breadcrumbs from 'components/@extended/Breadcrumbs';
import Loader from 'components/Loader';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH, MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import { useAppSelector, useAppDispatch } from '@/store';
import { setWorkspace } from '@/store/slices/workspaceSlice';
import { APP_CONFIG } from '@/lib/config';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { container, miniDrawer, menuOrientation } = useConfig();
  const dispatch = useAppDispatch();
  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;

  // Detect workspace context from subdomain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const parts = host.split('.');
      const isLocalhost = host.includes('localhost');
      const hasSubdomain = isLocalhost
        ? host.includes('localhost:3000') && parts.length >= 2 && parts[0] !== 'localhost'
        : parts.length > 2;

      if (hasSubdomain) {
        const subdomain = isLocalhost
          ? host.includes('localhost:3000') && parts.length >= 2
            ? parts[0]
            : null
          : parts.length > 2
            ? parts[0]
            : null;

        if (subdomain && subdomain !== workspaceSubdomain) {
          // Try to resolve workspace and set context
          const resolveWorkspace = async () => {
            try {
              const resolveUrl = new URL('/api/workspaces/resolve', APP_CONFIG.apiUrl);
              resolveUrl.searchParams.set('host', host);
              const response = await fetch(resolveUrl.toString(), { cache: 'no-store' });
              if (response.ok) {
                const data = await response.json();
                dispatch(setWorkspace({ id: data.workspace.id, subdomain }));
              }
            } catch (error) {
              console.log('Could not resolve workspace:', error);
            }
          };
          resolveWorkspace();
        }
      }
    }
  }, [dispatch, workspaceSubdomain]);

  // set media wise responsive drawer
  useEffect(() => {
    if (!miniDrawer) {
      handlerDrawerOpen(!downXL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downXL]);

  if (menuMasterLoading) return <Loader />;

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <Header />
      {!isHorizontal ? <Drawer /> : <HorizontalBar />}

      <Box component="main" sx={{ width: `calc(100% - ${DRAWER_WIDTH}px)`, flexGrow: 1, p: { xs: 1, sm: 3 } }}>
        <Toolbar sx={{ mt: isHorizontal ? 8 : 'inherit', mb: isHorizontal ? 2 : 'inherit' }} />
        <Container
          maxWidth={container && !downXL ? 'xl' : false}
          sx={{
            ...(container && !downXL && { px: { xs: 0, sm: 3 } }),
            position: 'relative',
            minHeight: 'calc(100vh - 124px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Breadcrumbs />
          {children}
          <Footer />
        </Container>
      </Box>
    </Box>
  );
}
