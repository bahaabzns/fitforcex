'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Menu as MenuIcon, CloseCircle, Category, Apple, Activity, Card } from '@wandersonalwes/iconsax-react';
import Link from 'next/link';
import { handlerDrawerOpen, useGetMenuMaster } from '@/api/menu';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from '@/config';

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
    { href: `/dashboard/clients/${id}/nutrition`, label: 'Nutrition Maker', icon: Apple },
    { href: `/dashboard/clients/${id}/workout`, label: 'Workout Maker', icon: Activity },
    { href: `/dashboard/clients/${id}/subscription`, label: 'Subscription', icon: Card }
  ];

  const drawerContent = (
    <Box sx={{ width: 280, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          Client Sections
        </Typography>
        <IconButton
          onClick={() => setOpen(false)}
          size="small"
          sx={{ 
            color: 'text.secondary',
            '&:hover': {
              color: 'error.main'
            }
          }}
        >
          <CloseCircle size={20} />
        </IconButton>
      </Box>
      <List dense>
        {links.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <ListItem key={link.href} disablePadding>
              <ListItemButton
                component={Link}
                href={link.href}
                selected={active}
                onClick={() => {
                  if (isMobile) setOpen(false);
                }}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  px: 1.25,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark'
                    }
                  }
                }}
              >
                {Icon && <Icon size={18} style={{ marginRight: 8, opacity: 0.9 }} />}
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

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
          marginLeft: open && !isMobile ? 
            `${(mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH) + 280}px` : 
            `${mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH}px`
        }}
      >
        {children}
      </Box>

      {/* Toggle button - show when drawer is closed */}
      {!open && (
        <IconButton
          onClick={() => {
            setOpen(true);
            // Close main dashboard drawer when opening client sections
            if (mainDrawerOpen) handlerDrawerOpen(false);
          }}
          sx={{
            position: 'fixed',
            top: 16, // align with header toggle row
            left: (mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH) + 16, // place just after the main sidebar
            zIndex: 1201, // Higher than main drawer to appear above it
            backgroundColor: 'background.paper',
            boxShadow: 2
          }}
        >
          <MenuIcon size={20} />
        </IconButton>
      )}

      {/* Drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          zIndex: 1200, // Same as main drawer
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            top: 64, // Adjust based on your header height
            height: 'calc(100vh - 64px)',
            left: mainDrawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH, // Position after main sidebar
            zIndex: 1200
          }
        }}
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
