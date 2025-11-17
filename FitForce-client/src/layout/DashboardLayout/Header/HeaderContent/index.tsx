import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

// material-ui
import { Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';

// project-imports
import Localization from './Localization';
import MobileSection from './MobileSection';
import Notification from './Notification';
import Profile from './Profile';
import WorkspaceNavigator from './WorkspaceNavigator';
import ThemeToggle from './ThemeToggle';
import FullScreen from './FullScreen';
import ClientSidebarMobileToggle from '@/components/ClientSidebarMobileToggle';
import ClientLoginLink from './ClientLoginLink';
import SubscriptionDays from './SubscriptionDays';

import { MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import DrawerHeader from 'layout/DashboardLayout/Drawer/DrawerHeader';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const { menuOrientation } = useConfig();
  const pathname = usePathname();

  const downLG = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));
  
  // Check if we're on a client route - don't show workspace navigator for client routes
  const isClientRoute = pathname?.startsWith('/client');
  
  const localization = useMemo(() => <Localization />, []);

  return (
    <>
      {menuOrientation === MenuOrientation.HORIZONTAL && !downLG && <DrawerHeader open={true} />}
      {!downLG && !isClientRoute && <WorkspaceNavigator />}
      {downLG && <ClientSidebarMobileToggle />}
      {!downLG && !isClientRoute && <ClientLoginLink />}
      <Box sx={{ flexGrow: 1 }} />
      {!downLG && !isClientRoute && <SubscriptionDays />}
      {!downLG && <ThemeToggle />}
      {!downLG && <FullScreen />}
      {!downLG && localization}

      {!isClientRoute && <Notification />}
      {!downLG && !isClientRoute && <Profile />}
      {downLG && <MobileSection />}
    </>
  );
}
