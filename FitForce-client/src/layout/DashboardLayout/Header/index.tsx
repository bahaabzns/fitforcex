import { ReactNode, useMemo } from 'react';

// material-ui
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar, { AppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';

// project-imports
import AppBarStyled from './AppBarStyled';
import HeaderContent from './HeaderContent';
import IconButton from 'components/@extended/IconButton';

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
      bgcolor: alpha(theme.palette.background.default, 0.8),
      backdropFilter: 'blur(8px)',
      zIndex: 1200,
      width: isHorizontal ? '100%' : (downLG ? '100%' : `calc(100% - ${totalSidebarWidth}px)`),
      marginLeft: isHorizontal ? 0 : (downLG ? 0 : `${totalSidebarWidth}px`),
      transition: theme.transitions.create(['width', 'margin-left'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen
      })
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
