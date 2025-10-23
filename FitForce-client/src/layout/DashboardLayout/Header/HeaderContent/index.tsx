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
import ClientMobileMenuButton from '@/components/ClientMobileMenuButton';

import { MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import DrawerHeader from 'layout/DashboardLayout/Drawer/DrawerHeader';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const { menuOrientation } = useConfig();
  const pathname = usePathname();

  const downLG = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));

  const localization = useMemo(() => <Localization />, []);

  // Check if we're on a client page
  const isClientPage = pathname?.includes('/dashboard/clients/') && (
    pathname?.includes('/overview') || 
    pathname?.includes('/nutrition') ||
    pathname?.includes('/workout') ||
    pathname?.includes('/subscription')
  );

  return (
    <>
      {menuOrientation === MenuOrientation.HORIZONTAL && !downLG && <DrawerHeader open={true} />}
      {!downLG && <WorkspaceNavigator />}
      {downLG && isClientPage && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ClientMobileMenuButton />
        </Box>
      )}
      <Box sx={{ flexGrow: 1 }} />
      {!downLG && localization}

      <Notification />
      {!downLG && <Profile />}
      {downLG && <MobileSection />}
    </>
  );
}
