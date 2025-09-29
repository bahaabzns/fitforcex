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
import { Menu as MenuIcon, CloseCircle } from '@wandersonalwes/iconsax-react';
import Link from 'next/link';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [open, setOpen] = useState(!isMobile);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  const links = [
    { href: `/dashboard/clients/${id}/overview`, label: 'Overview' },
    { href: `/dashboard/clients/${id}/nutrition`, label: 'Nutrition Maker' },
    { href: `/dashboard/clients/${id}/workout`, label: 'Workout Maker' },
    { href: `/dashboard/clients/${id}/subscription`, label: 'Subscription' }
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
      <List>
        {links.map((link) => {
          const active = pathname === link.href;
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
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark'
                    }
                  }
                }}
              >
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
          marginRight: open && !isMobile ? '280px' : 0
        }}
      >
        {children}
      </Box>

      {/* Toggle button - show when drawer is closed */}
      {!open && (
        <IconButton
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            top: 80,
            right: 16,
            zIndex: 1200,
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
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            top: 64, // Adjust based on your header height
            height: 'calc(100vh - 64px)'
          }
        }}
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
