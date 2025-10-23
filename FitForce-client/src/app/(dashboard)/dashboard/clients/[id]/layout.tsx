'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  useMediaQuery,
  Divider
} from '@mui/material';
import { useTheme, styled, CSSObject } from '@mui/material/styles';
import { Menu as MenuIcon, Category, Apple, Activity, Card } from '@wandersonalwes/iconsax-react';
import Link from 'next/link';
import { useGetMenuMaster } from '@/api/menu';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from '@/config';

// ==============================|| CLIENT DRAWER - MINI STYLED ||============================== //

const openedMixin = (theme: any): CSSObject => ({
  backgroundColor: theme.palette.background.default,
  width: 200,
  borderRight: '1px dashed',
  borderRightColor: theme.palette.secondary[400],
  boxShadow: 'none',
  ...theme.applyStyles('dark', {
    borderRightColor: theme.palette.secondary[200],
    boxShadow: theme.customShadows.z1
  }),
  overflowX: 'hidden',
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  })
});

const closedMixin = (theme: any): CSSObject => ({
  overflow: 'hidden',
  backgroundColor: theme.palette.background.default,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),
  overflowX: 'hidden',
  width: 60,
  borderRight: 'none',
  boxShadow: theme.customShadows.z1
});

const ClientDrawerStyled = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  width: 200,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme)
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme)
  })
}));

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [open, setOpen] = useState(!isMobile);
  const { menuMaster } = useGetMenuMaster();
  const mainDrawerOpen = menuMaster.isDashboardDrawerOpened;

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  const links = [
    { href: `/dashboard/clients/${id}/overview`, label: 'Overview', icon: Category },
    { href: `/dashboard/clients/${id}/nutrition`, label: 'Nutrition', icon: Apple },
    { href: `/dashboard/clients/${id}/workout`, label: 'Workout', icon: Activity },
    { href: `/dashboard/clients/${id}/subscription`, label: 'Subscription', icon: Card }
  ];

  // Drawer content component
  const drawerContent = useMemo(() => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: open ? 'space-between' : 'center',
        p: open ? 2 : 1,
        minHeight: 64
      }}>
        {open && (
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Client Sections
          </Typography>
        )}
        <IconButton
          onClick={() => setOpen(!open)}
          size="small"
          sx={{ 
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
              bgcolor: 'primary.lighter'
            }
          }}
        >
          <MenuIcon size={20} />
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, pt: 1 }}>
        <List dense sx={{ width: '100%' }}>
          {links.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            
            return (
              <ListItem key={link.href} disablePadding sx={{ px: open ? 1.25 : 0.5, mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  href={link.href}
                  selected={active}
                  onClick={() => {
                    if (isMobile) setOpen(false);
                  }}
                  sx={(theme) => ({
                    borderRadius: 1,
                    px: open ? 1.25 : 1,
                    py: 1,
                    minHeight: 44,
                    ...(open && {
                      mx: 0.5,
                      '&:hover': { 
                        bgcolor: 'secondary.200',
                        ...theme.applyStyles('dark', { bgcolor: 'divider' })
                      }
                    }),
                    ...(!open && {
                      justifyContent: 'center',
                      px: 1,
                      '&:hover': { 
                        bgcolor: 'secondary.200',
                        ...theme.applyStyles('dark', { bgcolor: 'divider' })
                      }
                    }),
                    ...(active && {
                      bgcolor: 'primary.lighter',
                      color: 'primary.main',
                      '&:hover': { 
                        bgcolor: 'primary.lighter',
                        ...theme.applyStyles('dark', { bgcolor: 'divider' })
                      }
                    })
                  })}
                >
                  <ListItemIcon
                    sx={(theme) => ({
                      minWidth: open ? 38 : 'auto',
                      color: active ? 'primary.main' : 'secondary.main',
                      ...theme.applyStyles('dark', { 
                        color: active ? 'primary.main' : 'secondary.400' 
                      }),
                      ...(!open && {
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        ...(active && {
                          bgcolor: 'primary.lighter',
                          ...theme.applyStyles('dark', { bgcolor: 'divider' })
                        })
                      })
                    })}
                  >
                    <Icon 
                      variant="Bulk" 
                      size={open ? 20 : 22} 
                    />
                  </ListItemIcon>
                  
                  {open && (
                    <ListItemText
                      primary={
                        <Typography
                          variant="h6"
                          sx={(theme) => ({
                            color: active ? 'primary.main' : 'secondary.main',
                            ...theme.applyStyles('dark', { 
                              color: active ? 'primary.main' : 'secondary.400' 
                            }),
                            fontWeight: active ? 500 : 400,
                            fontSize: '0.875rem'
                          })}
                        >
                          {link.label}
                        </Typography>
                      }
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  ), [open, pathname, id, isMobile]);

  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
          }),
          marginLeft: `${mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH}px`,
          marginRight: open && !isMobile ? `${open ? 200 : 60}px` : '0px'
        }}
      >
        {children}
      </Box>

      {/* Drawer */}
      {!isMobile ? (
        <ClientDrawerStyled 
          variant="permanent" 
          open={open}
          sx={{
            '& .MuiDrawer-paper': {
              top: 64,
              height: 'calc(100vh - 64px)',
              left: mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
              zIndex: 1200,
              overflowX: 'hidden',
              overflowY: 'auto'
            }
          }}
        >
          {drawerContent}
        </ClientDrawerStyled>
      ) : (
        <Drawer
          variant="temporary"
          anchor="left"
          open={open}
          onClose={() => setOpen(false)}
          sx={{
            zIndex: 1200,
            '& .MuiDrawer-paper': {
              width: 200,
              boxSizing: 'border-box',
              top: 64,
              height: 'calc(100vh - 64px)',
              left: mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
              zIndex: 1200,
              overflowX: 'hidden',
              overflowY: 'auto'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </Box>
  );
}
