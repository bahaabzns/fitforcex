import { ReactNode, useMemo } from 'react';

// material-ui
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar, { AppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project-imports
import AppBarStyled from './AppBarStyled';
import HeaderContent from './HeaderContent';
import IconButton from 'components/@extended/IconButton';
import ClientSidebarToggle from '@/components/ClientSidebarToggle';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH, MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { usePathname } from 'next/navigation';

// assets
import { HambergerMenu } from '@wandersonalwes/iconsax-react';

// ==============================|| MAIN LAYOUT - HEADER ||============================== //

export default function Header() {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const pathname = usePathname();

  const { menuOrientation } = useConfig();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const { isOpen: clientSidebarOpen } = useClientSidebar();

  // Check if we're on a client detail page
  const isClientDetailPage = Boolean(pathname?.match(/^\/dashboard\/clients\/([^/]+)/));

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;
  
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

  // header content
  const headerContent = useMemo(() => <HeaderContent />, []);

  // common header
const mainHeader: ReactNode = (
    <Toolbar sx={{ px: { xs: 2, sm: 2.5, md: 4.5, lg: 8 } }}>
      {!isHorizontal ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={() => handlerDrawerOpen(!drawerOpen)}
            edge="start"
            color="secondary"
            variant="light"
            size="large"
            sx={(theme) => ({
              color: 'secondary.main',
              ...(drawerOpen
                ? { bgcolor: 'background.default' }
                : { bgcolor: 'secondary.200', ...theme.applyStyles('dark', { bgcolor: 'background.paper' }) }),
              ml: { xs: 0, lg: -2 },
              p: 1
            })}
          >
            <HambergerMenu />
          </IconButton>
          {!downLG && <ClientSidebarToggle />}
        </Box>
      ) : null}
      {headerContent}
      <div style={{ marginLeft: 'auto' }}>
      </div>
    </Toolbar>
  );

  // app-bar params
  const appBar: AppBarProps = {
    position: 'fixed',
    elevation: 0,
    sx: (theme) => ({
      // On mobile, use solid background (white in light mode, dark in dark mode)
      // On desktop, keep semi-transparent with blur effect
      bgcolor: downLG 
        ? theme.palette.background.paper
        : (theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.default, 0.95)
          : alpha(theme.palette.background.default, 0.8)),
      backdropFilter: downLG ? 'none' : 'blur(8px)',
      zIndex: 1200,
      width: isHorizontal ? '100%' : (downLG ? '100%' : `calc(100% - ${totalSidebarWidth}px)`),
      marginLeft: isHorizontal ? 0 : (downLG ? 0 : `${totalSidebarWidth}px`),
      transition: theme.transitions.create(['width', 'margin-left'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen
      }),
      color: 'text.primary'
    })
  };

  return (
    <>
      {!downLG ? (
        <AppBarStyled open={drawerOpen} {...appBar}>
          {mainHeader}
        </AppBarStyled>
      ) : (
        <AppBar {...appBar}>{mainHeader}</AppBar>
      )}
    </>
  );
}
