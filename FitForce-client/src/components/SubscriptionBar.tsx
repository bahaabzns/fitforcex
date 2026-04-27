'use client';

import { useState, useEffect } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAppSelector } from '@/store';
import { usePathname } from 'next/navigation';
import api from '@/utils/axios';

interface SubscriptionData {
  id: string;
  status: string;
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  createdAt?: string;
}

export default function SubscriptionBar() {
  const theme = useTheme();
  const pathname = usePathname();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Don't show on subscription management pages
  const isSubscriptionPage = pathname?.includes('/subscription') || pathname?.includes('/workspaces/subscription');

  useEffect(() => {
    if (!workspaceId || isSubscriptionPage) {
      setSubscription(null);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data } = await api.get(`/api/workspaces/${workspaceId}/subscription`);
        const sub = data.subscription;
        if (sub && sub.status === 'active') {
          setSubscription(sub);
          calculateRemainingDays(sub);
        } else {
          setSubscription(null);
        }
      } catch (err: any) {
        // 404/402 means no subscription - hide bar
        const status = err?.response?.status;
        if (status === 404 || status === 402) {
          setSubscription(null);
        }
      }
    };

    fetchSubscription();
    
    // Refresh every hour
    const interval = setInterval(fetchSubscription, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [workspaceId, isSubscriptionPage]);

  const calculateRemainingDays = (sub: SubscriptionData) => {
    const startDateStr = sub.startDate;
    const endDateStr = sub.endDate || sub.renewalDate;
    
    if (!startDateStr || !endDateStr) {
      setDaysRemaining(null);
      return;
    }
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const now = new Date();
    
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const remaining = endDate.getTime() - now.getTime();
    
    const progressValue = total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;
    const days = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
    
    setProgress(progressValue);
    setDaysRemaining(days);
  };

  // Don't show if no subscription, no remaining days info, or on subscription page
  if (!subscription || daysRemaining === null || isSubscriptionPage) {
    return null;
  }

  // Determine color based on remaining days
  const getBarColor = () => {
    if (daysRemaining <= 7) return theme.palette.error.main;
    if (daysRemaining <= 30) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        height: 40,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        boxShadow: theme.palette.mode === 'dark' ? '0 -2px 8px rgba(0,0,0,0.3)' : '0 -2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100%',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          '& .MuiLinearProgress-bar': {
            bgcolor: getBarColor(),
            opacity: theme.palette.mode === 'dark' ? 0.3 : 0.2
          }
        }}
      />
      <Typography
        variant="body2"
        sx={{
          position: 'relative',
          zIndex: 1,
          fontWeight: 600,
          color: 'text.primary',
          mx: 'auto',
          textAlign: 'center'
        }}
      >
        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
      </Typography>
    </Box>
  );
}

