'use client';

import { IconButton, Tooltip } from '@mui/material';
import { Menu as MenuIcon } from '@wandersonalwes/iconsax-react';
import { useClientSidebarSafe } from '@/contexts/ClientSidebarContext';

export default function ClientMobileMenuButton() {
  const sidebarContext = useClientSidebarSafe();

  // Don't render if context is not available
  if (!sidebarContext) {
    return null;
  }

  const { toggleSidebar } = sidebarContext;

  return (
    <Tooltip title="Client Menu" placement="bottom">
      <IconButton
        onClick={toggleSidebar}
        edge="start"
        color="primary"
        variant="light"
        size="large"
        sx={(theme) => ({
          color: 'primary.main',
          bgcolor: 'primary.lighter',
          ...theme.applyStyles('dark', { 
            bgcolor: 'primary.darker',
            color: 'primary.light'
          }),
          ml: { xs: 0, lg: -2 },
          p: 1,
          border: '1px solid',
          borderColor: 'primary.main',
          '&:hover': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            transform: 'scale(1.05)',
            transition: 'all 0.2s ease-in-out'
          }
        })}
      >
        <MenuIcon />
      </IconButton>
    </Tooltip>
  );
}
