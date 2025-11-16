'use client';

import { IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowRight2, ArrowLeft2 } from '@wandersonalwes/iconsax-react';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { usePathname } from 'next/navigation';

// ==============================|| CLIENT SIDEBAR TOGGLE BUTTON ||============================== //

export default function ClientSidebarToggle() {
  const { isOpen, toggleSidebar } = useClientSidebar();
  const pathname = usePathname();
  const theme = useTheme();
  const downLG = useMediaQuery(theme.breakpoints.down('lg'));

  // Only show on client detail pages
  const isClientDetailPage = pathname?.match(/^\/dashboard\/clients\/([^/]+)/) !== null;

  if (!isClientDetailPage) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSidebar();
  };

  // Use IconButton for both desktop and mobile (like phone layout)
  return (
    <Tooltip title={isOpen ? 'Hide Client Sidebar' : 'Show Client Sidebar'} placement={downLG ? "right" : "bottom"}>
      <IconButton
        onClick={handleClick}
        size="large"
        sx={(theme) => ({
          color: 'primary.main',
          bgcolor: 'primary.lighter',
          ml: downLG ? 1 : 1,
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
        {isOpen ? <ArrowLeft2 size={20} variant="Bulk" /> : <ArrowRight2 size={20} variant="Bulk" />}
      </IconButton>
    </Tooltip>
  );
}

