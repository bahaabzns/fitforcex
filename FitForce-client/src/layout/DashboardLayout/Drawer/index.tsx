import { useMemo } from 'react';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

// project-imports
import DrawerHeader from './DrawerHeader';
import DrawerContent from './DrawerContent';
import MiniDrawerStyled from './MiniDrawerStyled';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH } from 'config';

// ==============================|| MAIN LAYOUT - DRAWER ||============================== //

interface Props {
  window?: () => Window;
}

export default function MainDrawer({ window }: Props) {
  const theme = useTheme();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  // responsive drawer container
  const container = window !== undefined ? () => window().document.body : undefined;

  // header content
  const drawerContent = useMemo(() => <DrawerContent />, []);
  const drawerHeader = useMemo(() => <DrawerHeader open={drawerOpen} />, [drawerOpen]);

  return (
    <Box component="nav" sx={{ flexShrink: { md: 0 }, zIndex: 1200 }} aria-label="mailbox folders">
      {!downLG ? (
        <MiniDrawerStyled variant="permanent" open={drawerOpen}>
          {drawerHeader}
          {drawerContent}
        </MiniDrawerStyled>
      ) : (
        <Drawer
          container={container}
          variant="temporary"
          open={drawerOpen}
          onClose={() => handlerDrawerOpen(!drawerOpen)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: drawerOpen ? 'block' : 'none', lg: 'none' } }}
          slotProps={{
            paper: {
              sx: (theme) => ({
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
                borderRight: '1px solid',
                borderColor: 'divider',
                backgroundImage: 'none',
                boxShadow: 'inherit',
                // Solid background: white in light mode, dark in dark mode (not transparent)
                bgcolor: '#fff',
                ...theme.applyStyles('dark', {
                  bgcolor: theme.palette.secondary.lighter || '#131920'
                })
              })
            }
          }}
        >
          <Box sx={{ 
            height: '100%', 
            bgcolor: '#fff',
            ...theme.applyStyles('dark', {
              bgcolor: theme.palette.secondary.lighter || '#131920'
            })
          }}>
            {drawerHeader}
            {drawerContent}
          </Box>
        </Drawer>
      )}
    </Box>
  );
}
