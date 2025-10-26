'use client';

import { useEffect, useRef } from 'react';
import { Drawer, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { styled, CSSObject } from '@mui/material/styles';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Category, Apple, Activity, Card } from '@wandersonalwes/iconsax-react';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH, CLIENT_DRAWER_WIDTH } from 'config';
import { useGetMenuMaster } from 'api/menu';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';

// ==============================|| CLIENT SIDEBAR - MINI STYLED ||============================== //

const openedMixin = (theme: any): CSSObject => ({
  backgroundColor: theme.palette.background.default,
  width: CLIENT_DRAWER_WIDTH,
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

const ClientDrawerStyled = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  width: CLIENT_DRAWER_WIDTH,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme)
  })
}));

// ==============================|| CLIENT SIDEBAR DRAWER ||============================== //

export default function ClientSidebarDrawer() {
  const theme = useTheme();
  const pathname = usePathname();
  const downLG = useMediaQuery(theme.breakpoints.down('lg'));
  const { menuMaster } = useGetMenuMaster();
  const mainDrawerOpen = menuMaster?.isDashboardDrawerOpened ?? false;
  const { isOpen, setIsOpen } = useClientSidebar();
  const prevPathnameRef = useRef(pathname);

  // Extract client ID from pathname
  const clientIdMatch = pathname?.match(/^\/dashboard\/clients\/([^/]+)/);
  const isClientDetailPage = Boolean(clientIdMatch);
  const clientId = clientIdMatch?.[1];

  // Auto-close sidebar when navigating away from client detail pages
  useEffect(() => {
    const isNowClientPage = pathname?.match(/^\/dashboard\/clients\/([^/]+)/);
    const wasClientPage = prevPathnameRef.current?.match(/^\/dashboard\/clients\/([^/]+)/);
    
    // If we just left a client page and it's still open, close it
    if (wasClientPage && !isNowClientPage && isOpen) {
      setIsOpen(false);
    }
    
    // Update previous pathname
    prevPathnameRef.current = pathname;
  }, [pathname, isOpen, setIsOpen]);

  // Don't render if not on client detail page or on mobile
  if (!isClientDetailPage || downLG || !clientId || !isOpen) {
    return null;
  }

  const clientPages = [
    { href: `/dashboard/clients/${clientId}/overview`, label: 'Overview', icon: Category },
    { href: `/dashboard/clients/${clientId}/nutrition`, label: 'Nutrition', icon: Apple },
    { href: `/dashboard/clients/${clientId}/workout`, label: 'Workout', icon: Activity },
    { href: `/dashboard/clients/${clientId}/subscription`, label: 'Subscription', icon: Card }
  ];

  const leftPosition = mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH *3;

  return (
    <Box sx={{ position: 'relative' }}>
      <ClientDrawerStyled
        variant="permanent"
        open={isOpen}
        sx={{
          position: 'absolute',
          left: leftPosition - 270, // Adjust this value to move left (-40 = 40px closer to main sidebar)
          top: 0,
          height: '100vh',
          zIndex: 1199,
          '& .MuiDrawer-paper': {
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100vh',
            zIndex: 1199
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 64, px: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '1rem'
            }}
          >
            Client Pages
          </Typography>
        </Box>

        <Divider />

        {/* Navigation */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', py: 2 }}>
          <List sx={{ px: 1.25, py: 0 }}>
            {clientPages.map((page) => {
              const active = pathname === page.href;
              const Icon = page.icon;

              return (
                <ListItem key={page.href} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={page.href}
                    selected={active}
                    sx={(theme) => ({
                      borderRadius: 1,
                      py: 1.25,
                      px: 2,
                      '&:hover': {
                        bgcolor: 'secondary.200',
                        ...theme.applyStyles('dark', { bgcolor: 'divider' })
                      },
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
                      sx={{
                        minWidth: 40,
                        color: active ? 'primary.main' : 'secondary.main',
                        ...theme.applyStyles('dark', {
                          color: active ? 'primary.main' : 'secondary.400'
                        })
                      }}
                    >
                      <Icon variant="Bulk" size={22} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body1"
                          sx={{
                            color: active ? 'primary.main' : 'text.primary',
                            fontWeight: active ? 500 : 400,
                            fontSize: '0.875rem'
                          }}
                        >
                          {page.label}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </ClientDrawerStyled>
    </Box>
  );
}
