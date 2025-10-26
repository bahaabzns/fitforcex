import { useMemo } from 'react';

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
import ClientSidebarMobileToggle from '@/components/ClientSidebarMobileToggle';

import { MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import DrawerHeader from 'layout/DashboardLayout/Drawer/DrawerHeader';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const { menuOrientation } = useConfig();

  const downLG = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));

  const localization = useMemo(() => <Localization />, []);

  return (
    <>
      {menuOrientation === MenuOrientation.HORIZONTAL && !downLG && <DrawerHeader open={true} />}
      {!downLG && <WorkspaceNavigator />}
      {downLG && <ClientSidebarMobileToggle />}
      <Box sx={{ flexGrow: 1 }} />
      {!downLG && localization}

      <Notification />
      {!downLG && <Profile />}
      {downLG && <MobileSection />}
    </>
  );
}
