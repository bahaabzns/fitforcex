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
import { setWorkspace, clearWorkspace } from '@/store/slices/workspaceSlice';
import { APP_CONFIG } from '@/lib/config';
import MessengerBadgeSync from './MessengerBadgeSync';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { miniDrawer, menuOrientation } = useConfig();
  const dispatch = useAppDispatch();
  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;

  // Detect workspace context from subdomain using cookies set by middleware
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Read workspace cookies set by middleware
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };

      const setCookie = (name: string, value: string) => {
        // Don't set domain - make cookies subdomain-specific only
        // This prevents workspace cookies from bleeding into the main domain
        document.cookie = `${name}=${value}; path=/; SameSite=Lax;`;
        console.log(`🍪 Client-side set cookie: ${name}=${value} (subdomain-specific)`);
      };

      const cookieWorkspaceId = getCookie('ff_workspace_id');
      const cookieSubdomain = getCookie('ff_workspace_subdomain');
      
      const host = window.location.host;
      const isMainDomain = host === APP_CONFIG.frontendDomain || host === 'localhost:3000';

      console.log('🔍 DashboardLayout Workspace Detection:', {
        host,
        isMainDomain,
        cookieWorkspaceId,
        cookieSubdomain,
        currentWorkspaceSubdomain: workspaceSubdomain,
        pathname: window.location.pathname,
        allCookies: document.cookie
      });

      // PRIORITY 1: If we have workspace cookies and Redux is empty or different, update Redux IMMEDIATELY
      if (cookieWorkspaceId && cookieSubdomain && cookieSubdomain !== workspaceSubdomain) {
        console.log('✅ Setting workspace context from cookies');
        dispatch(setWorkspace({ id: cookieWorkspaceId, subdomain: cookieSubdomain }));
      } 
      // PRIORITY 2: If we're on main domain and have workspace in Redux, clear it
      else if (isMainDomain && workspaceSubdomain && !cookieWorkspaceId) {
        console.log('🧹 Clearing workspace context (on main domain)');
        dispatch(clearWorkspace());
      }
      // PRIORITY 3: If on subdomain but no cookies, fetch workspace and set cookies client-side (middleware fallback)
      else if (!isMainDomain && !cookieWorkspaceId) {
        console.log('⚠️ On subdomain but cookies not set - fetching workspace client-side as fallback');
        
        // Fetch workspace data and set cookies client-side
        const fetchAndSetWorkspace = async () => {
          try {
            const response = await fetch(`${APP_CONFIG.apiUrl}/api/workspaces/resolve?host=${host}`);
            if (response.ok) {
              const data = await response.json();
              const workspace = data.workspace;
              
              console.log('✅ Fetched workspace client-side:', workspace);
              
              // Set cookies client-side
              setCookie('ff_workspace_id', workspace.id);
              setCookie('ff_workspace_subdomain', workspace.subdomain);
              
              // Update Redux
              dispatch(setWorkspace({ id: workspace.id, subdomain: workspace.subdomain }));
            } else {
              console.error('❌ Failed to fetch workspace, status:', response.status);
            }
          } catch (error) {
            console.error('❌ Error fetching workspace:', error);
          }
        };
        
        fetchAndSetWorkspace();
      }
    }
  }, [dispatch, workspaceSubdomain]); // Re-run when workspaceSubdomain changes

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
      <MessengerBadgeSync />
      {!isHorizontal ? <Drawer /> : <HorizontalBar />}

      <Box component="main" sx={{ width: `calc(100% - ${DRAWER_WIDTH}px)`, flexGrow: 1, p: { xs: 1, sm: 3 } }}>
        <Toolbar sx={{ mt: isHorizontal ? 8 : 'inherit', mb: isHorizontal ? 2 : 'inherit' }} />
        <Container
          maxWidth={false}
          sx={{
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
