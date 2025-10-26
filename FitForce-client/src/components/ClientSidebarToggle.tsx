'use client';

import { IconButton, Tooltip } from '@mui/material';
import { ArrowRight2, ArrowLeft2 } from '@wandersonalwes/iconsax-react';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { usePathname } from 'next/navigation';

// ==============================|| CLIENT SIDEBAR TOGGLE BUTTON ||============================== //

export default function ClientSidebarToggle() {
  const { isOpen, toggleSidebar } = useClientSidebar();
  const pathname = usePathname();

  // Only show on client detail pages
  const isClientDetailPage = pathname?.match(/^\/dashboard\/clients\/([^/]+)/) !== null;

  if (!isClientDetailPage) {
    return null;
  }

  return (
    <Tooltip title={isOpen ? 'Hide Client Sidebar' : 'Show Client Sidebar'} placement="right">
      <IconButton
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebar();
        }}
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

