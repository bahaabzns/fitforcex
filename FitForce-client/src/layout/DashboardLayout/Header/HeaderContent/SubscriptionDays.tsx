'use client';

import { useState, useEffect } from 'react';
import { Chip } from '@mui/material';
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

export default function HeaderSubscriptionDays() {
  const theme = useTheme();
  const pathname = usePathname();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Don't show on subscription management pages
  const isSubscriptionPage = pathname?.includes('/subscription') || pathname?.includes('/workspaces/subscription');

  useEffect(() => {
    if (!workspaceId || isSubscriptionPage) {
      setDaysRemaining(null);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data } = await api.get(`/api/workspaces/${workspaceId}/subscription`);
        const sub = data.subscription;
        if (sub && sub.status === 'active') {
          calculateRemainingDays(sub);
        } else {
          setDaysRemaining(null);
        }
      } catch (err: any) {
        // 404/402 means no subscription - hide
        const status = err?.response?.status;
        if (status === 404 || status === 402) {
          setDaysRemaining(null);
        }
      }
    };

    fetchSubscription();
    
    // Refresh every hour
    const interval = setInterval(fetchSubscription, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [workspaceId, isSubscriptionPage]);

  const calculateRemainingDays = (sub: SubscriptionData) => {
    const startDateStr = sub.startDate || sub.createdAt;
    const endDateStr = sub.endDate || sub.renewalDate;
    
    if (!startDateStr || !endDateStr) {
      setDaysRemaining(null);
      return;
    }
    
    const endDate = new Date(endDateStr);
    const now = new Date();
    const remaining = endDate.getTime() - now.getTime();
    const days = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
    
    setDaysRemaining(days);
  };

  // Don't show if no subscription or no remaining days info
  if (!daysRemaining || daysRemaining === null || isSubscriptionPage) {
    return null;
  }

  // Determine color based on remaining days
  const getColor = (): 'default' | 'warning' | 'error' => {
    if (daysRemaining <= 7) return 'error';
    if (daysRemaining <= 30) return 'warning';
    return 'default';
  };

  return (
    <Chip
      label={`${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`}
      color={getColor()}
      size="small"
      sx={{
        mr: 1,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24
      }}
    />
  );
}

