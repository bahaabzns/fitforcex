'use client';

import { Drawer, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Category, Apple, Activity, Card } from '@wandersonalwes/iconsax-react';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { DRAWER_WIDTH } from 'config';
import { handlerDrawerOpen } from 'api/menu';

// ==============================|| CLIENT SIDEBAR MOBILE DRAWER ||============================== //

const CLIENT_DRAWER_WIDTH = 280;

export default function ClientSidebarMobileDrawer() {
  const theme = useTheme();
  const pathname = usePathname();
  const downLG = useMediaQuery(theme.breakpoints.down('lg'));
  const { isOpen, setIsOpen } = useClientSidebar();

  // Extract client ID from pathname
  const clientIdMatch = pathname?.match(/^\/dashboard\/clients\/([^/]+)/);
  const isClientDetailPage = Boolean(clientIdMatch);
  const clientId = clientIdMatch?.[1];

  // Don't render if not on client detail page or not mobile
  if (!isClientDetailPage || !downLG || !clientId) {
    return null;
  }

  const clientPages = [
    { href: `/dashboard/clients/${clientId}/overview`, label: 'Overview', icon: Category },
    { href: `/dashboard/clients/${clientId}/nutrition`, label: 'Nutrition', icon: Apple },
    { href: `/dashboard/clients/${clientId}/workout`, label: 'Workout', icon: Activity },
    { href: `/dashboard/clients/${clientId}/subscription`, label: 'Subscription', icon: Card }
  ];

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={isOpen}
      onClose={handleClose}
      ModalProps={{
        keepMounted: true // Better open performance on mobile
      }}
      sx={{ display: { xs: 'block', lg: 'none' } }}
      slotProps={{
        paper: {
          sx: (theme) => ({
            width: CLIENT_DRAWER_WIDTH,
            boxSizing: 'border-box',
            // Solid background: white in light mode, dark in dark mode (not transparent)
            bgcolor: '#fff',
            borderRight: '1px dashed',
            borderRightColor: theme.palette.secondary[400],
            boxShadow: theme.customShadows.z1,
            ...theme.applyStyles('dark', {
              bgcolor: theme.palette.secondary.lighter || '#131920',
              borderRightColor: theme.palette.secondary[200]
            })
          })
        }
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        bgcolor: '#fff',
        ...theme.applyStyles('dark', {
          bgcolor: theme.palette.secondary.lighter || '#131920'
        })
      }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, px: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '1.125rem'
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
                    onClick={handleClose}
                    sx={(theme) => ({
                      borderRadius: 1,
                      py: 1.25,
                      px: 2,
                      mx: 1.25,
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
      </Box>
    </Drawer>
  );
}

