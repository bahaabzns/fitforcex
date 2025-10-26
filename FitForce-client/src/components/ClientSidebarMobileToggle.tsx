'use client';

import { IconButton, Tooltip } from '@mui/material';
import { Menu as MenuIcon } from '@wandersonalwes/iconsax-react';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { usePathname } from 'next/navigation';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// ==============================|| CLIENT SIDEBAR MOBILE TOGGLE BUTTON ||============================== //

export default function ClientSidebarMobileToggle() {
  const { toggleSidebar } = useClientSidebar();
  const pathname = usePathname();
  const theme = useTheme();
  const downLG = useMediaQuery(theme.breakpoints.down('lg'));

  // Only show on client detail pages on mobile
  const isClientDetailPage = pathname?.match(/^\/dashboard\/clients\/([^/]+)/) !== null;

  if (!isClientDetailPage || !downLG) {
    return null;
  }

  return (
    <Tooltip title="Client Menu" placement="bottom">
      <IconButton
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebar();
        }}
        size="large"
        sx={(theme) => ({
          color: 'primary.main',
          bgcolor: 'primary.lighter',
          ml: 1,
          p: 1,
          '&:hover': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText'
          },
          ...theme.applyStyles('dark', {
            bgcolor: 'primary.darker',
            color: 'primary.light',
            '&:hover': {
              bgcolor: 'primary.light',
              color: 'primary.darker'
            }
          })
        })}
      >
        <MenuIcon variant="Bulk" />
      </IconButton>
    </Tooltip>
  );
}

