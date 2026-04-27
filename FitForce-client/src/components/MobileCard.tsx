import { ReactNode } from 'react';
import { Card, CardContent, Stack, Typography, Box } from '@mui/material';

interface MobileCardItemProps {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

export function MobileCardItem({ label, value, fullWidth = false }: MobileCardItemProps) {
  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto', minWidth: fullWidth ? '100%' : 'auto' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
}

/**
 * Mobile-friendly card layout for displaying table data
 * Use with MobileCardItem components
 */
export default function MobileCard({ children, onClick }: MobileCardProps) {
  return (
    <Card
      sx={{
        mb: 2,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick
          ? {
              boxShadow: 2,
              transform: 'translateY(-2px)',
              transition: 'all 0.2s'
            }
          : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack spacing={2}>{children}</Stack>
      </CardContent>
    </Card>
  );
}
