'use client';

import { useTheme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';

// assets
import { Notification, Setting2 } from '@wandersonalwes/iconsax-react';

// ==============================|| DASHBOARD - WELCOME BANNER ||============================== //

export default function WelcomeBanner() {
  const theme = useTheme();

  return (
    <Card 
      sx={{ 
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Welcome back, John! 👋
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mb: 2 }}>
              Here's what's happening with your workspace today.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
              >
                View Analytics
              </Button>
              <Button 
                variant="outlined" 
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.3)', 
                  color: 'white',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.5)' }
                }}
              >
                Manage Workspace
              </Button>
            </Stack>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 600
              }}
            >
              JD
            </Avatar>
            <Stack direction="row" spacing={1}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <Notification size={20} />
              </Box>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <Setting2 size={20} />
              </Box>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
