'use client';

import { useEffect, ReactNode, useState } from 'react';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project-imports
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import HorizontalBar from './Drawer/HorizontalBar';
import ClientSidebarDrawer from './ClientSidebarDrawer';
import ClientSidebarMobileDrawer from '@/components/ClientSidebarMobileDrawer';
import Loader from 'components/Loader';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import OnboardingWizard from '@/components/OnboardingWizard';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH, MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import { useAppSelector, useAppDispatch } from '@/store';
import { setWorkspace, clearWorkspace } from '@/store/slices/workspaceSlice';
import { APP_CONFIG } from '@/lib/config';
import MessengerBadgeSync from './MessengerBadgeSync';
import QueueBadgeSync from './QueueBadgeSync';
import TutorialVideoHelper from '@/components/TutorialVideoHelper';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspaceSubscription } from '@/hooks/useWorkspaceSubscription';
import api from '@/utils/axios';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { miniDrawer, menuOrientation } = useConfig();
  const dispatch = useAppDispatch();
  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened ?? false;
  const { isOpen: clientSidebarOpen } = useClientSidebar();

  // Onboarding state
  const [onboardingStatus, setOnboardingStatus] = useState<{
    isOnboarded: boolean;
  } | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  // Check if we're on a client detail page
  const isClientDetailPage = Boolean(pathname?.match(/^\/dashboard\/clients\/([^/]+)/));

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;
  
  // Fetch workspace subscription to enable feature-based UI
  useWorkspaceSubscription();

  // Check onboarding status - only on workspace subdomain
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!workspaceId || !workspaceSubdomain) {
        // Not on a workspace subdomain, skip onboarding check
        setOnboardingStatus({ isOnboarded: true });
        setOnboardingLoading(false);
        return;
      }

      // Only check onboarding if we're on a workspace subdomain
      const host = typeof window !== 'undefined' ? window.location.host : '';
      const isMainDomain = host === APP_CONFIG.frontendDomain || host === 'localhost:3000';
      
      if (isMainDomain) {
        // On main domain, skip onboarding check
        setOnboardingStatus({ isOnboarded: true });
        setOnboardingLoading(false);
        return;
      }

      try {
        setOnboardingLoading(true);
        const response = await api.get('/api/workspaces/onboarding/status', {
          headers: { 'x-workspace-id': workspaceId }
        });
        setOnboardingStatus(response.data);
      } catch (err: any) {
        console.error('Onboarding status check failed:', err);
        // If onboarding check fails, assume onboarded to not block access
        setOnboardingStatus({ isOnboarded: true });
      } finally {
        setOnboardingLoading(false);
      }
    };

    if (workspaceId && workspaceSubdomain) {
      checkOnboardingStatus();
    } else {
      // No workspace context, assume onboarded
      setOnboardingStatus({ isOnboarded: true });
      setOnboardingLoading(false);
    }
  }, [workspaceId, workspaceSubdomain]);

  // Prevent navigation to other pages during onboarding - only on workspace subdomain
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    const isMainDomain = host === APP_CONFIG.frontendDomain || host === 'localhost:3000';
    const isWorkspaceSubdomain = workspaceSubdomain && !isMainDomain;

    if (isWorkspaceSubdomain && onboardingStatus && !onboardingStatus.isOnboarded && pathname !== '/dashboard') {
      // Redirect to dashboard if trying to access other pages during onboarding
      router.replace('/dashboard');
    }
  }, [onboardingStatus, pathname, router, workspaceSubdomain]);

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

  if (menuMasterLoading) {
    return <Loader />;
  }

  // Only show onboarding loading/check on workspace subdomain
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const isMainDomain = host === APP_CONFIG.frontendDomain || host === 'localhost:3000';
  const isWorkspaceSubdomain = workspaceSubdomain && !isMainDomain;

  if (isWorkspaceSubdomain && onboardingLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">
            Checking onboarding status...
          </Typography>
        </Stack>
      </Box>
    );
  }

  // Show onboarding wizard if not onboarded - only on workspace subdomain
  if (isWorkspaceSubdomain && onboardingStatus && !onboardingStatus.isOnboarded && workspaceId) {
    return (
      <Box sx={{ width: '100%', minHeight: '100vh' }}>
        <OnboardingWizard workspaceId={workspaceId} />
      </Box>
    );
  }

  // Calculate drawer widths
  const mainDrawerWidth = downLG ? 0 : (drawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH);
  const clientSidebarWidth = 270; // CLIENT_DRAWER_WIDTH
  
  // Only account for client sidebar if we're on a client detail page AND it's open
  const shouldShowClientSidebar = isClientDetailPage && clientSidebarOpen;
  
  // Calculate total sidebar width
  const totalSidebarWidth = downLG ? 0 : (
    shouldShowClientSidebar 
      ? mainDrawerWidth + clientSidebarWidth
      : mainDrawerWidth
  );

  // Extra margin when main sidebar is closed and client sidebar is open on client pages
  const extraClientMargin = (!drawerOpen && shouldShowClientSidebar && !downLG) ? 60 : 0;

  return (
    <Box sx={{ display: 'flex', width: '100%', bgcolor: 'background.default', minHeight: '100vh' }}> 
      <Header />
      <MessengerBadgeSync />
      <QueueBadgeSync />
      <TutorialVideoHelper />
      {!isHorizontal ? <Drawer /> : <HorizontalBar />}
      <ClientSidebarDrawer />
      <ClientSidebarMobileDrawer />

      <Box component="main" sx={{ 
        flexGrow: 1, 
        p: 0,
        marginLeft: downLG ? 0 : `${ 0.5*totalSidebarWidth + extraClientMargin}px`,
        paddingLeft: downLG ? 2 : 0,
        bgcolor: 'background.default', // Ensure proper background color from theme
        minHeight: '100vh',
        transition: theme.transitions.create(['margin-left'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen
        })
      }}>
        <Toolbar sx={{ mt: isHorizontal ? 8 : 'inherit', mb: 0 }} />
        <Container
          maxWidth={false}
          sx={{
            position: 'relative',
            minHeight: 'calc(100vh - 124px)',
            display: 'flex',
            flexDirection: 'column',
            px: 0,
            bgcolor: 'background.default' // Ensure Container also has proper background
          }}
        >
          {children}
          <Footer />
        </Container>
      </Box>
    </Box>
  );
}
