'use client';

import { ReactNode } from 'react';

// material-ui
import { useTheme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project-imports
import Avatar from 'components/@extended/Avatar';

// ==============================|| STATISTICS - ECOMMERCE DATA CARD ||============================== //

interface EcommerceDataCardProps {
  title: string;
  count: string;
  percentage?: ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  iconPrimary?: ReactNode;
  children?: ReactNode;
}

export default function EcommerceDataCard({
  color = 'primary',
  title,
  count,
  percentage,
  iconPrimary,
  children
}: EcommerceDataCardProps) {
  const theme = useTheme();

  const getColorValue = () => {
    switch (color) {
      case 'primary':
        return theme.palette.primary.main;
      case 'secondary':
        return theme.palette.secondary.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'info':
        return theme.palette.info.main;
      case 'success':
        return theme.palette.success.main;
      default:
        return theme.palette.primary.main;
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              variant="rounded"
              sx={{
                bgcolor: `${getColorValue()}15`,
                color: getColorValue(),
                borderRadius: 1.5,
                width: 40,
                height: 40
              }}
            >
              {iconPrimary}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                {title}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {count}
              </Typography>
            </Box>
          </Stack>
          {percentage && (
            <Box sx={{ textAlign: 'right' }}>
              {percentage}
            </Box>
          )}
        </Stack>
        {children && (
          <Box sx={{ mt: 2 }}>
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
