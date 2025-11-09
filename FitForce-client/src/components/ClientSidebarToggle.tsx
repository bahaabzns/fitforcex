'use client';

import { IconButton, Tooltip, Button, useMediaQuery } from '@mui/material';
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

  // On desktop, use a Button instead of IconButton for better accessibility
  if (!downLG) {
    return (
      <Tooltip title={isOpen ? 'Hide Client Sidebar' : 'Show Client Sidebar'} placement="bottom">
        <Button
          onClick={handleClick}
          variant="outlined"
          size="small"
          startIcon={isOpen ? <ArrowLeft2 size={18} /> : <ArrowRight2 size={18} />}
          sx={(theme) => ({
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            fontSize: '0.75rem',
            fontWeight: 500,
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.lighter',
              borderColor: 'primary.dark',
              ...theme.applyStyles('dark', {
                bgcolor: 'primary.darker',
                borderColor: 'primary.light'
              })
            },
            ...theme.applyStyles('dark', {
              borderColor: 'primary.light',
              color: 'primary.light',
              '&:hover': {
                borderColor: 'primary.main',
                color: 'primary.main'
              }
            })
          })}
        >
          {isOpen ? 'Hide' : 'Show'}
        </Button>
      </Tooltip>
    );
  }

  // On mobile, keep the small IconButton
  return (
    <Tooltip title={isOpen ? 'Hide Client Sidebar' : 'Show Client Sidebar'} placement="right">
      <IconButton
        onClick={handleClick}
        size="small"
        sx={(theme) => ({
          width: 28,
          height: 28,
          p: 0.5,
          color: 'primary.main',
          '&:hover': {
            bgcolor: 'primary.lighter'
          },
          ...theme.applyStyles('dark', {
            color: 'primary.light',
            '&:hover': {
              bgcolor: 'primary.darker'
            }
          })
        })}
      >
        {isOpen ? <ArrowLeft2 size={18} /> : <ArrowRight2 size={18} />}
      </IconButton>
    </Tooltip>
  );
}

