"use client";
import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface ResponsiveTableProps {
  children: ReactNode;
  minWidth?: number;
}

/**
 * Responsive table wrapper that enables horizontal scrolling on mobile
 * and adds touch-friendly scroll indicators
 */
export default function ResponsiveTable({ children, minWidth = 750 }: ResponsiveTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        width: '100%',
        // Ensure horizontal scrollbar is available when content overflows,
        // especially on mobile.
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
        display: 'block',
        maxWidth: '100%',
        minWidth: isMobile ? minWidth : 'auto',
        '& td, & th': {
          whiteSpace: isMobile ? 'nowrap' : 'normal'
        },
        // Custom scrollbar for better mobile UX
        '&::-webkit-scrollbar': {
          height: 8
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: theme.palette.grey[200]
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.grey[400],
          borderRadius: 4,
          '&:hover': {
            backgroundColor: theme.palette.grey[500]
          },
        },
        // Scroll shadow indicators
        ...(isMobile && {
          background:
            `linear-gradient(to right, white 30%, rgba(255,255,255,0)),
            linear-gradient(to right, rgba(255,255,255,0), white 70%) 0 100%,
            radial-gradient(farthest-side at 0% 50%, rgba(0,0,0,.2), rgba(0,0,0,0)),
            radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,.2), rgba(0,0,0,0)) 0 100%`,
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'white',
          backgroundSize: '40px 100%, 40px 100%, 14px 100%, 14px 100%',
          backgroundPosition: '0 0, 100%, 0 0, 100%',
          backgroundAttachment: 'local, local, scroll, scroll'
        }),
      }}
    >
      <Box sx={{ minWidth: isMobile ? minWidth : 'auto' }}>{children}</Box>
    </Box>
  );
}
